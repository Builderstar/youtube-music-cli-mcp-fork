// Import playlists from local .m3u / .m3u8 files.
//
// Handling per entry (see project decision):
//   - Local file path entries  -> playable local Tracks (metadata via ffprobe)
//   - youtube.com / youtu.be URLs -> resolved to YouTube Tracks by videoId
//   - Anything else            -> matched via YouTube Music search using the
//                                 #EXTINF title (or the raw line) as the query
import {existsSync, readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getMusicService} from '../youtube-music/api.ts';
import {getLocalMusicService} from '../local-music/local-music.service.ts';
import {getConfigService} from '../config/config.service.ts';
import {logger} from '../logger/logger.service.ts';
import {
	hasAudioExtension,
	isLocalMediaPath,
	fileUrlToPath,
} from '../../utils/local-media.ts';
import type {Playlist, Track} from '../../types/youtube-music.types.ts';
import type {ImportProgress, ImportResult} from '../../types/import.types.ts';

type ProgressCallback = (progress: ImportProgress) => void;

interface M3UEntry {
	target: string; // URL or path line
	title?: string; // from #EXTINF
	duration?: number; // seconds, from #EXTINF
}

class M3UImportService {
	private readonly musicService = getMusicService();
	private readonly localMusicService = getLocalMusicService();

	parse(content: string): M3UEntry[] {
		const lines = content.split(/\r?\n/);
		const entries: M3UEntry[] = [];
		let pendingTitle: string | undefined;
		let pendingDuration: number | undefined;

		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line) continue;

			if (line.startsWith('#EXTINF:')) {
				const meta = line.substring('#EXTINF:'.length);
				const commaIndex = meta.indexOf(',');
				if (commaIndex >= 0) {
					const durationText = meta.substring(0, commaIndex).trim();
					const parsedDuration = Number.parseInt(durationText, 10);
					pendingDuration =
						!Number.isNaN(parsedDuration) && parsedDuration > 0
							? parsedDuration
							: undefined;
					pendingTitle = meta.substring(commaIndex + 1).trim() || undefined;
				}
				continue;
			}

			// Skip other directives (#EXTM3U, #PLAYLIST, comments).
			if (line.startsWith('#')) continue;

			entries.push({
				target: line,
				title: pendingTitle,
				duration: pendingDuration,
			});
			pendingTitle = undefined;
			pendingDuration = undefined;
		}

		return entries;
	}

	private extractVideoId(value: string): string | null {
		const vMatch = value.match(/[?&]v=([\w-]{11})/);
		if (vMatch?.[1]) return vMatch[1];
		const shortMatch = value.match(/youtu\.be\/([\w-]{11})/);
		if (shortMatch?.[1]) return shortMatch[1];
		return null;
	}

	private titleToTrack(title: string): {
		name: string;
		artist: string;
	} {
		const dashIndex = title.indexOf(' - ');
		if (dashIndex > 0) {
			return {
				artist: title.substring(0, dashIndex).trim(),
				name: title.substring(dashIndex + 3).trim(),
			};
		}
		return {artist: '', name: title.trim()};
	}

	private expandTilde(value: string): string {
		if (value === '~') return os.homedir();
		if (value.startsWith('~/') || value.startsWith('~\\')) {
			return path.join(os.homedir(), value.slice(2));
		}
		return value;
	}

	private resolveLocalPath(target: string, baseDir: string): string {
		const raw = fileUrlToPath(target);
		if (path.isAbsolute(raw)) return raw;
		return path.resolve(baseDir, raw);
	}

	/**
	 * Import an m3u/m3u8 file into a saved playlist.
	 */
	async importFromFile(
		filePath: string,
		customName: string | undefined,
		onProgress?: ProgressCallback,
	): Promise<ImportResult> {
		const startTime = Date.now();
		const expanded = this.expandTilde(fileUrlToPath(filePath.trim()));
		const resolvedPath = path.resolve(expanded);

		if (!existsSync(resolvedPath)) {
			throw new Error(`File not found: ${resolvedPath}`);
		}

		const ext = path.extname(resolvedPath).toLowerCase();
		if (ext !== '.m3u' && ext !== '.m3u8') {
			throw new Error('Only .m3u and .m3u8 files are supported.');
		}

		onProgress?.({
			status: 'fetching',
			current: 0,
			total: 0,
			message: 'Reading playlist file...',
		});

		const content = readFileSync(resolvedPath, 'utf-8');
		const entries = this.parse(content);
		const baseDir = path.dirname(resolvedPath);
		const total = entries.length;

		const tracks: Track[] = [];
		const errors: string[] = [];
		let matched = 0;
		let failed = 0;

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]!;
			onProgress?.({
				status: 'matching',
				current: i,
				total,
				currentTrack: entry.title ?? entry.target,
				message: `Processing ${i + 1}/${total}...`,
			});

			try {
				const track = await this.resolveEntry(entry, baseDir);
				if (track) {
					tracks.push(track);
					matched++;
				} else {
					failed++;
					errors.push(`No match for "${entry.title ?? entry.target}"`);
				}
			} catch (error) {
				failed++;
				errors.push(
					`${entry.title ?? entry.target}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}

		const playlistName =
			customName?.trim() ||
			path.basename(resolvedPath, path.extname(resolvedPath));

		onProgress?.({
			status: 'creating',
			current: total,
			total,
			message: 'Saving playlist...',
		});

		const playlistId = this.savePlaylist(playlistName, tracks);

		onProgress?.({
			status: 'completed',
			current: total,
			total,
			message: `Imported ${matched}/${total} tracks`,
		});

		logger.info('M3UImportService', 'Import complete', {
			file: resolvedPath,
			total,
			matched,
			failed,
		});

		return {
			playlistId,
			playlistName,
			source: 'm3u',
			total,
			matched,
			failed,
			matches: [],
			errors,
			duration: Date.now() - startTime,
		};
	}

	private async resolveEntry(
		entry: M3UEntry,
		baseDir: string,
	): Promise<Track | null> {
		const target = entry.target;

		// 1. YouTube URL -> resolve by videoId.
		const videoId = this.extractVideoId(target);
		if (videoId) {
			const track = await this.musicService.getTrack(videoId);
			if (track) return track;
			// Fall back to a minimal YouTube track so the entry is preserved.
			return {
				videoId,
				title: entry.title ?? videoId,
				artists: [],
				source: 'youtube',
			};
		}

		// 2. Local file path -> build a local Track.
		if (isLocalMediaPath(target) || hasAudioExtension(target)) {
			const localPath = this.resolveLocalPath(target, baseDir);
			if (existsSync(localPath)) {
				return this.localMusicService.buildTrack(localPath);
			}
			// Referenced local file is missing; skip it.
			return null;
		}

		// 3. Otherwise, search YouTube Music using the title/line.
		const query = entry.title || target;
		const parsed = this.titleToTrack(query);
		const searchQuery = parsed.artist
			? `${parsed.artist} ${parsed.name}`
			: parsed.name;
		const response = await this.musicService.search(searchQuery, {
			type: 'songs',
			limit: 1,
		});
		const first = response.results.find(r => r.type === 'song');
		if (first) {
			return first.data as Track;
		}

		return null;
	}

	private savePlaylist(name: string, tracks: Track[]): string {
		const configService = getConfigService();
		const playlist: Playlist = {
			playlistId: `m3u_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
			name,
			tracks,
		};
		const existing = configService.get('playlists') ?? [];
		configService.set('playlists', [...existing, playlist]);
		return playlist.playlistId;
	}
}

let m3uImportServiceInstance: M3UImportService | null = null;

export function getM3UImportService(): M3UImportService {
	if (!m3uImportServiceInstance) {
		m3uImportServiceInstance = new M3UImportService();
	}
	return m3uImportServiceInstance;
}
