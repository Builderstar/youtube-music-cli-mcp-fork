// Local music library service: scans configured directories for audio files,
// reads metadata via ffprobe (with filename fallback), and exposes them as
// playable Tracks with source === 'local'.
import {existsSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {getConfigService} from '../config/config.service.ts';
import {logger} from '../logger/logger.service.ts';
import {hasAudioExtension} from '../../utils/local-media.ts';
import type {Track} from '../../types/youtube-music.types.ts';

export interface LocalScanResult {
	tracks: Track[];
	directories: string[];
	scanned: number;
}

const MAX_SCAN_DEPTH = 8;

class LocalMusicService {
	private ffprobeChecked = false;
	private ffprobeAvailable = false;

	getDirectories(): string[] {
		const config = getConfigService();
		const dirs: string[] = [];

		const musicDir = (config.get('localMusicDirectory') ?? '').trim();
		if (musicDir) dirs.push(musicDir);

		const includeDownloads = config.get('localMusicIncludeDownloads') ?? true;
		if (includeDownloads) {
			const downloadDir = (config.get('downloadDirectory') ?? '').trim();
			if (downloadDir) dirs.push(downloadDir);
		}

		// De-duplicate and keep only existing directories.
		const seen = new Set<string>();
		const result: string[] = [];
		for (const dir of dirs) {
			const resolved = path.resolve(dir);
			if (seen.has(resolved)) continue;
			seen.add(resolved);
			if (existsSync(resolved) && statSync(resolved).isDirectory()) {
				result.push(resolved);
			}
		}

		return result;
	}

	/**
	 * Scan configured directories and return local tracks. Metadata is read via
	 * ffprobe when available; otherwise it falls back to filename parsing.
	 */
	async scan(): Promise<LocalScanResult> {
		const directories = this.getDirectories();
		const files: string[] = [];

		for (const dir of directories) {
			this.collectAudioFiles(dir, files, 0);
		}

		const uniqueFiles = Array.from(new Set(files)).sort((a, b) =>
			a.localeCompare(b),
		);

		const tracks: Track[] = [];
		for (const filePath of uniqueFiles) {
			tracks.push(await this.buildTrack(filePath));
		}

		logger.info('LocalMusicService', 'Scan complete', {
			directories: directories.length,
			tracks: tracks.length,
		});

		return {tracks, directories, scanned: uniqueFiles.length};
	}

	/** Build a single local Track from a file path (reads metadata). */
	async buildTrack(filePath: string): Promise<Track> {
		const absolute = path.resolve(filePath);
		const metadata = await this.readMetadata(absolute);
		const fallback = this.parseFilename(absolute);

		const title = metadata.title || fallback.title;
		const artistName = metadata.artist || fallback.artist;

		return {
			videoId: `local:${absolute}`,
			title,
			artists: [{artistId: `local-artist:${artistName}`, name: artistName}],
			album: metadata.album
				? {
						albumId: `local-album:${metadata.album}`,
						name: metadata.album,
						artists: [
							{artistId: `local-artist:${artistName}`, name: artistName},
						],
					}
				: undefined,
			duration: metadata.duration,
			source: 'local',
			localPath: absolute,
		};
	}

	private collectAudioFiles(dir: string, out: string[], depth: number): void {
		if (depth > MAX_SCAN_DEPTH) return;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch (error) {
			logger.warn('LocalMusicService', 'Failed to read directory', {
				dir,
				error: error instanceof Error ? error.message : String(error),
			});
			return;
		}

		for (const entry of entries) {
			if (entry.startsWith('.')) continue;
			const full = path.join(dir, entry);
			let stat;
			try {
				stat = statSync(full);
			} catch {
				continue;
			}

			if (stat.isDirectory()) {
				this.collectAudioFiles(full, out, depth + 1);
			} else if (stat.isFile() && hasAudioExtension(full)) {
				out.push(full);
			}
		}
	}

	private parseFilename(filePath: string): {title: string; artist: string} {
		const base = path.basename(filePath, path.extname(filePath));
		// Common pattern: "Artist - Title"
		const dashIndex = base.indexOf(' - ');
		if (dashIndex > 0) {
			const artist = base.substring(0, dashIndex).trim();
			const title = base.substring(dashIndex + 3).trim();
			if (artist && title) {
				return {title, artist};
			}
		}
		return {title: base.trim() || 'Unknown Title', artist: 'Unknown Artist'};
	}

	private async readMetadata(filePath: string): Promise<{
		title?: string;
		artist?: string;
		album?: string;
		duration?: number;
	}> {
		const available = await this.ensureFfprobe();
		if (!available) return {};

		try {
			const json = await this.runFfprobe(filePath);
			const parsed = JSON.parse(json) as {
				format?: {
					duration?: string;
					tags?: Record<string, string>;
				};
				streams?: Array<{tags?: Record<string, string>}>;
			};

			const tags = {
				...(parsed.streams?.[0]?.tags ?? {}),
				...(parsed.format?.tags ?? {}),
			};
			const lower: Record<string, string> = {};
			for (const [key, value] of Object.entries(tags)) {
				lower[key.toLowerCase()] = value;
			}

			const durationRaw = parsed.format?.duration;
			const duration = durationRaw
				? Math.round(Number(durationRaw))
				: undefined;

			return {
				title: lower['title'],
				artist: lower['artist'] || lower['album_artist'],
				album: lower['album'],
				duration:
					duration !== undefined && !Number.isNaN(duration)
						? duration
						: undefined,
			};
		} catch (error) {
			logger.debug('LocalMusicService', 'ffprobe metadata read failed', {
				filePath,
				error: error instanceof Error ? error.message : String(error),
			});
			return {};
		}
	}

	private async ensureFfprobe(): Promise<boolean> {
		if (this.ffprobeChecked) return this.ffprobeAvailable;
		this.ffprobeChecked = true;
		try {
			await new Promise<void>((resolve, reject) => {
				const proc = spawn('ffprobe', ['-version'], {windowsHide: true});
				proc.on('error', reject);
				proc.on('exit', code =>
					code === 0 ? resolve() : reject(new Error(`exit ${code}`)),
				);
			});
			this.ffprobeAvailable = true;
		} catch {
			this.ffprobeAvailable = false;
			logger.warn(
				'LocalMusicService',
				'ffprobe not available; using filename metadata only',
			);
		}
		return this.ffprobeAvailable;
	}

	private async runFfprobe(filePath: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const proc = spawn(
				'ffprobe',
				[
					'-v',
					'quiet',
					'-print_format',
					'json',
					'-show_format',
					'-show_streams',
					filePath,
				],
				{windowsHide: true},
			);
			let stdout = '';
			let stderr = '';
			proc.stdout.on('data', chunk => {
				stdout += String(chunk);
			});
			proc.stderr.on('data', chunk => {
				stderr += String(chunk);
			});
			proc.on('error', reject);
			proc.on('exit', code => {
				if (code === 0) {
					resolve(stdout);
				} else {
					reject(new Error(stderr.trim() || `ffprobe exited with ${code}`));
				}
			});
		});
	}
}

let localMusicServiceInstance: LocalMusicService | null = null;

export function getLocalMusicService(): LocalMusicService {
	if (!localMusicServiceInstance) {
		localMusicServiceInstance = new LocalMusicService();
	}
	return localMusicServiceInstance;
}
