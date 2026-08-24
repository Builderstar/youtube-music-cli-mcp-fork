// Lyrics service using LRCLIB API (https://lrclib.net)
// Free, no authentication required
import {logger} from '../logger/logger.service.ts';

export interface LyricLine {
	time: number; // seconds
	text: string;
}

export interface Lyrics {
	synced: LyricLine[] | null; // null if only plain lyrics
	plain: string | null;
}

const LRCLIB_BASE = 'https://lrclib.net/api';

class LyricsService {
	private static instance: LyricsService;
	private cache = new Map<string, Lyrics | null>();

	private constructor() {}

	static getInstance(): LyricsService {
		if (!LyricsService.instance) {
			LyricsService.instance = new LyricsService();
		}
		return LyricsService.instance;
	}

	/** Parse LRC format into timed lines */
	private parseLrc(lrc: string): LyricLine[] {
		const lines: LyricLine[] = [];
		const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

		for (const rawLine of lrc.split('\n')) {
			const match = lineRegex.exec(rawLine.trim());
			if (match) {
				const minutes = Number.parseInt(match[1]!, 10);
				const seconds = Number.parseInt(match[2]!, 10);
				const centiseconds = Number.parseInt(match[3]!.padEnd(3, '0'), 10);
				const time = minutes * 60 + seconds + centiseconds / 1000;
				const text = match[4]!.trim();
				lines.push({time, text});
			}
		}

		return lines.sort((a, b) => a.time - b.time);
	}

	async getLyrics(
		trackName: string,
		artistName: string,
		duration?: number,
	): Promise<Lyrics | null> {
		const cacheKey = `${trackName}::${artistName}`;
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey) ?? null;
		}

		try {
			const params = new URLSearchParams({
				track_name: trackName,
				artist_name: artistName,
				...(duration ? {duration: String(Math.round(duration))} : {}),
			});

			const response = await fetch(`${LRCLIB_BASE}/get?${params.toString()}`);

			if (!response.ok) {
				if (response.status === 404) {
					logger.debug('LyricsService', 'No lyrics found', {
						trackName,
						artistName,
					});
					this.cache.set(cacheKey, null);
					return null;
				}
				throw new Error(`LRCLIB API error: ${response.status}`);
			}

			const data = (await response.json()) as {
				syncedLyrics?: string;
				plainLyrics?: string;
			};

			const lyrics: Lyrics = {
				synced: data.syncedLyrics ? this.parseLrc(data.syncedLyrics) : null,
				plain: data.plainLyrics ?? null,
			};

			this.cache.set(cacheKey, lyrics);
			logger.info('LyricsService', 'Lyrics loaded', {
				trackName,
				hasSynced: !!lyrics.synced,
				hasPlain: !!lyrics.plain,
			});
			return lyrics;
		} catch (error) {
			logger.warn('LyricsService', 'Failed to fetch lyrics', {
				error: error instanceof Error ? error.message : String(error),
			});
			this.cache.set(cacheKey, null);
			return null;
		}
	}

	/** Get the current lyric line index based on playback position */
	getCurrentLineIndex(lines: LyricLine[], currentTime: number): number {
		let index = 0;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i]!.time <= currentTime) {
				index = i;
			} else {
				break;
			}
		}
		return index;
	}

	clearCache(): void {
		this.cache.clear();
	}
}

export const getLyricsService = (): LyricsService =>
	LyricsService.getInstance();
