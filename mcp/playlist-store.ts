// Direct, concurrency-safe playlist store for the MCP server.
//
// The TUI keeps config cached in memory, so the MCP server must not rely on a
// long-lived cached snapshot when mutating playlists (the user may be editing
// them in the TUI at the same time). Every mutation here re-reads config.json
// from disk, applies the change, and writes it back atomically.
import {
	existsSync,
	readFileSync,
	writeFileSync,
	renameSync,
	mkdirSync,
} from 'node:fs';
import path from 'node:path';
import {CONFIG_DIR, CONFIG_FILE} from '../source/utils/constants.ts';
import type {Playlist, Track} from '../source/types/youtube-music.types.ts';

type ConfigShape = {playlists?: Playlist[]} & Record<string, unknown>;

function readConfig(): ConfigShape {
	if (!existsSync(CONFIG_FILE)) return {playlists: []};
	try {
		const raw = readFileSync(CONFIG_FILE, 'utf-8');
		const parsed = JSON.parse(raw) as ConfigShape;
		if (!Array.isArray(parsed.playlists)) parsed.playlists = [];
		return parsed;
	} catch {
		return {playlists: []};
	}
}

function writeConfig(config: ConfigShape): void {
	mkdirSync(CONFIG_DIR, {recursive: true});
	const tempPath = path.join(CONFIG_DIR, `config.mcp.${process.pid}.tmp`);
	writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf-8');
	renameSync(tempPath, CONFIG_FILE);
}

export function listPlaylists(): Playlist[] {
	return readConfig().playlists ?? [];
}

export function getPlaylist(playlistId: string): Playlist | undefined {
	return listPlaylists().find(p => p.playlistId === playlistId);
}

function generateId(): string {
	return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createPlaylist(name: string, tracks: Track[] = []): Playlist {
	const config = readConfig();
	const playlist: Playlist = {
		playlistId: generateId(),
		name,
		tracks: tracks.map(t => ({...t})),
	};
	config.playlists = [...(config.playlists ?? []), playlist];
	writeConfig(config);
	return playlist;
}

export function renamePlaylist(
	playlistId: string,
	newName: string,
): Playlist | null {
	const config = readConfig();
	const playlists = config.playlists ?? [];
	const index = playlists.findIndex(p => p.playlistId === playlistId);
	if (index === -1) return null;
	playlists[index] = {...playlists[index]!, name: newName};
	config.playlists = playlists;
	writeConfig(config);
	return playlists[index]!;
}

export function deletePlaylist(playlistId: string): boolean {
	const config = readConfig();
	const playlists = config.playlists ?? [];
	const next = playlists.filter(p => p.playlistId !== playlistId);
	if (next.length === playlists.length) return false;
	config.playlists = next;
	writeConfig(config);
	return true;
}

export type AddResult = {added: number; duplicates: number};

export function addTracksToPlaylist(
	playlistId: string,
	tracks: Track[],
	force = false,
): AddResult | null {
	const config = readConfig();
	const playlists = config.playlists ?? [];
	const index = playlists.findIndex(p => p.playlistId === playlistId);
	if (index === -1) return null;

	const target = playlists[index]!;
	const existing = new Set(target.tracks.map(t => t.videoId));
	let added = 0;
	let duplicates = 0;
	for (const track of tracks) {
		if (!force && existing.has(track.videoId)) {
			duplicates++;
			continue;
		}
		target.tracks.push(track);
		existing.add(track.videoId);
		added++;
	}
	config.playlists = playlists;
	writeConfig(config);
	return {added, duplicates};
}

export function removeTrackFromPlaylist(
	playlistId: string,
	trackIndex: number,
): boolean {
	const config = readConfig();
	const playlists = config.playlists ?? [];
	const index = playlists.findIndex(p => p.playlistId === playlistId);
	if (index === -1) return false;
	const target = playlists[index]!;
	if (trackIndex < 0 || trackIndex >= target.tracks.length) return false;
	target.tracks.splice(trackIndex, 1);
	config.playlists = playlists;
	writeConfig(config);
	return true;
}

export function moveTrack(
	playlistId: string,
	fromIndex: number,
	toIndex: number,
): boolean {
	const config = readConfig();
	const playlists = config.playlists ?? [];
	const index = playlists.findIndex(p => p.playlistId === playlistId);
	if (index === -1) return false;
	const target = playlists[index]!;
	const {tracks} = target;
	if (
		fromIndex < 0 ||
		fromIndex >= tracks.length ||
		toIndex < 0 ||
		toIndex >= tracks.length ||
		fromIndex === toIndex
	) {
		return false;
	}
	const [moved] = tracks.splice(fromIndex, 1);
	if (!moved) return false;
	tracks.splice(toIndex, 0, moved);
	config.playlists = playlists;
	writeConfig(config);
	return true;
}
