// MCP server exposing youtube-music-cli capabilities: playlist management,
// search, download, and playlist import/export. Runs over stdio and reuses the
// applet's own services so behaviour stays consistent with the CLI/TUI.
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';

// The playlist store is deliberately dependency-light (direct config file I/O)
// and safe to load eagerly. Everything else — especially the YouTube client
// (youtubei.js), which is heavy to parse and only needed by a few tools — is
// loaded lazily on first use. This keeps server startup fast and inert (no
// network, no heavy module evaluation) so it adds minimal pressure to the
// host process when it is spawned at session start.
import * as playlistStore from './playlist-store.ts';
import type {SearchResult, Track} from '../source/types/youtube-music.types.ts';

const lazyMusicService = async () =>
	(await import('../source/services/youtube-music/api.ts')).getMusicService();
const lazyDownloadService = async () =>
	(
		await import('../source/services/download/download.service.ts')
	).getDownloadService();
const lazyExportService = async () =>
	(
		await import('../source/services/export/export.service.ts')
	).getExportService();
const lazyImportService = async () =>
	(
		await import('../source/services/import/import.service.ts')
	).getImportService();
const lazyM3UImportService = async () =>
	(
		await import('../source/services/import/m3u-import.service.ts')
	).getM3UImportService();
const lazyLocalMusicService = async () =>
	(
		await import('../source/services/local-music/local-music.service.ts')
	).getLocalMusicService();

// ---------------------------------------------------------------------------
// Serializers (compact, model-friendly shapes)
// ---------------------------------------------------------------------------

function serializeTrack(track: Track) {
	return {
		videoId: track.videoId,
		title: track.title,
		artists: track.artists?.map(a => a.name) ?? [],
		album: track.album?.name,
		duration: track.duration,
		source: track.source ?? 'youtube',
		localPath: track.localPath,
	};
}

function serializeSearchResult(result: SearchResult) {
	const data = result.data as unknown as Record<string, unknown>;
	if (result.type === 'song') {
		return {type: result.type, ...serializeTrack(result.data as Track)};
	}
	return {
		type: result.type,
		id:
			(data['playlistId'] as string) ??
			(data['albumId'] as string) ??
			(data['artistId'] as string) ??
			undefined,
		name: (data['name'] as string) ?? (data['title'] as string) ?? 'Unknown',
	};
}

// Cap the size of any single tool response. Oversized payloads bloat the host
// client's context/memory; keeping responses bounded is a good practice and
// reduces memory pressure on the (Bun-based) host process.
const MAX_RESPONSE_BYTES = 256 * 1024;

function jsonContent(payload: unknown) {
	let text = JSON.stringify(payload, null, 2);
	if (Buffer.byteLength(text, 'utf-8') > MAX_RESPONSE_BYTES) {
		text =
			text.slice(0, MAX_RESPONSE_BYTES) +
			'\n... [response truncated: exceeded size limit; narrow your query or use pagination]';
	}
	return {
		content: [{type: 'text' as const, text}],
	};
}

function errorContent(message: string) {
	return {
		isError: true,
		content: [{type: 'text' as const, text: `Error: ${message}`}],
	};
}

async function guard<T>(
	fn: () => Promise<T> | T,
): Promise<ReturnType<typeof jsonContent> | ReturnType<typeof errorContent>> {
	try {
		const result = await fn();
		return jsonContent(result);
	} catch (error) {
		return errorContent(error instanceof Error ? error.message : String(error));
	}
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
	name: 'youtube-music-cli',
	version: '0.1.0',
});

// --- Playlist management ---------------------------------------------------

server.registerTool(
	'list_playlists',
	{
		title: 'List playlists',
		description:
			'List all saved playlists with their id, name, and track count.',
		inputSchema: {},
	},
	async () =>
		guard(() =>
			playlistStore.listPlaylists().map(p => ({
				playlistId: p.playlistId,
				name: p.name,
				trackCount: p.tracks.length,
			})),
		),
);

server.registerTool(
	'get_playlist',
	{
		title: 'Get playlist',
		description: 'Get a single playlist including all of its tracks.',
		inputSchema: {playlistId: z.string().describe('Playlist id')},
	},
	async ({playlistId}) =>
		guard(() => {
			const playlist = playlistStore.getPlaylist(playlistId);
			if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);
			return {
				playlistId: playlist.playlistId,
				name: playlist.name,
				tracks: playlist.tracks.map(serializeTrack),
			};
		}),
);

server.registerTool(
	'create_playlist',
	{
		title: 'Create playlist',
		description: 'Create a new empty playlist with the given name.',
		inputSchema: {name: z.string().min(1).describe('Playlist name')},
	},
	async ({name}) =>
		guard(() => {
			const playlist = playlistStore.createPlaylist(name);
			return {playlistId: playlist.playlistId, name: playlist.name};
		}),
);

server.registerTool(
	'rename_playlist',
	{
		title: 'Rename playlist',
		description: 'Rename an existing playlist.',
		inputSchema: {
			playlistId: z.string().describe('Playlist id'),
			name: z.string().min(1).describe('New playlist name'),
		},
	},
	async ({playlistId, name}) =>
		guard(() => {
			const updated = playlistStore.renamePlaylist(playlistId, name);
			if (!updated) throw new Error(`Playlist not found: ${playlistId}`);
			return {playlistId: updated.playlistId, name: updated.name};
		}),
);

server.registerTool(
	'delete_playlist',
	{
		title: 'Delete playlist',
		description: 'Delete a playlist by id.',
		inputSchema: {playlistId: z.string().describe('Playlist id')},
	},
	async ({playlistId}) =>
		guard(() => {
			const ok = playlistStore.deletePlaylist(playlistId);
			if (!ok) throw new Error(`Playlist not found: ${playlistId}`);
			return {deleted: true, playlistId};
		}),
);

server.registerTool(
	'add_song_to_playlist',
	{
		title: 'Add song to playlist',
		description:
			'Add a YouTube Music song to a playlist by its videoId. Optionally force-add duplicates.',
		inputSchema: {
			playlistId: z.string().describe('Target playlist id'),
			videoId: z.string().describe('YouTube Music videoId of the song'),
			force: z
				.boolean()
				.optional()
				.describe('Add even if the song already exists (default false)'),
		},
	},
	async ({playlistId, videoId, force}) =>
		guard(async () => {
			const musicService = await lazyMusicService();
			const track = await musicService.getTrack(videoId);
			if (!track) throw new Error(`Could not resolve videoId: ${videoId}`);
			const result = playlistStore.addTracksToPlaylist(
				playlistId,
				[track],
				force ?? false,
			);
			if (!result) throw new Error(`Playlist not found: ${playlistId}`);
			return {playlistId, ...result, track: serializeTrack(track)};
		}),
);

server.registerTool(
	'remove_track_from_playlist',
	{
		title: 'Remove track from playlist',
		description:
			'Remove a track from a playlist by its zero-based index within the playlist.',
		inputSchema: {
			playlistId: z.string().describe('Playlist id'),
			trackIndex: z
				.number()
				.int()
				.min(0)
				.describe('Zero-based index of the track to remove'),
		},
	},
	async ({playlistId, trackIndex}) =>
		guard(() => {
			const ok = playlistStore.removeTrackFromPlaylist(playlistId, trackIndex);
			if (!ok) throw new Error('Invalid playlist id or track index.');
			return {removed: true, playlistId, trackIndex};
		}),
);

server.registerTool(
	'reorder_playlist_track',
	{
		title: 'Reorder playlist track',
		description:
			'Move a track within a playlist from one zero-based index to another.',
		inputSchema: {
			playlistId: z.string().describe('Playlist id'),
			fromIndex: z.number().int().min(0).describe('Current index'),
			toIndex: z.number().int().min(0).describe('Destination index'),
		},
	},
	async ({playlistId, fromIndex, toIndex}) =>
		guard(() => {
			const ok = playlistStore.moveTrack(playlistId, fromIndex, toIndex);
			if (!ok) throw new Error('Invalid playlist id or indices.');
			return {reordered: true, playlistId, fromIndex, toIndex};
		}),
);

// --- Search ----------------------------------------------------------------

server.registerTool(
	'search',
	{
		title: 'Search YouTube Music',
		description:
			'Search YouTube Music for songs, albums, artists, or playlists.',
		inputSchema: {
			query: z.string().min(1).describe('Search query'),
			type: z
				.enum(['all', 'songs', 'albums', 'artists', 'playlists'])
				.optional()
				.describe('Result type filter (default all)'),
			limit: z
				.number()
				.int()
				.min(1)
				.max(50)
				.optional()
				.describe('Max results (default 20)'),
		},
	},
	async ({query, type, limit}) =>
		guard(async () => {
			const musicService = await lazyMusicService();
			const response = await musicService.search(query, {
				type: type ?? 'all',
				limit: limit ?? 20,
			});
			return {
				query,
				results: response.results.map(serializeSearchResult),
			};
		}),
);

// --- Download --------------------------------------------------------------

server.registerTool(
	'download_song',
	{
		title: 'Download song',
		description:
			'Download a single song to the configured downloads folder as mp3/m4a. Requires the Download feature to be enabled in the app settings and ffmpeg/yt-dlp installed.',
		inputSchema: {
			videoId: z.string().describe('YouTube Music videoId to download'),
		},
	},
	async ({videoId}) =>
		guard(async () => {
			const downloadService = await lazyDownloadService();
			const config = downloadService.getConfig();
			if (!config.enabled) {
				throw new Error(
					'Downloads are disabled. Enable the Download feature in the app settings first.',
				);
			}
			const musicService = await lazyMusicService();
			const track = await musicService.getTrack(videoId);
			if (!track) throw new Error(`Could not resolve videoId: ${videoId}`);
			const summary = await downloadService.downloadTracks([track]);
			return {videoId, title: track.title, ...summary};
		}),
);

server.registerTool(
	'download_playlist',
	{
		title: 'Download playlist',
		description:
			'Download every track in a saved playlist to the configured downloads folder.',
		inputSchema: {playlistId: z.string().describe('Playlist id to download')},
	},
	async ({playlistId}) =>
		guard(async () => {
			const downloadService = await lazyDownloadService();
			const config = downloadService.getConfig();
			if (!config.enabled) {
				throw new Error(
					'Downloads are disabled. Enable the Download feature in the app settings first.',
				);
			}
			const playlist = playlistStore.getPlaylist(playlistId);
			if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);
			const target = downloadService.resolvePlaylistTarget(playlist);
			if (target.tracks.length === 0) {
				throw new Error(`Playlist "${playlist.name}" has no tracks.`);
			}
			const summary = await downloadService.downloadTracks(target.tracks);
			return {playlistId, name: playlist.name, ...summary};
		}),
);

// --- Export / Import -------------------------------------------------------

server.registerTool(
	'export_playlist',
	{
		title: 'Export playlist',
		description:
			'Export a saved playlist to a file (json, m3u8, m3u, or both json+m3u8). Returns the written file paths.',
		inputSchema: {
			playlistId: z.string().describe('Playlist id to export'),
			format: z
				.enum(['json', 'm3u8', 'm3u', 'both'])
				.optional()
				.describe('Export format (default m3u8)'),
			outputDir: z
				.string()
				.optional()
				.describe('Optional output directory (defaults to app exports dir)'),
		},
	},
	async ({playlistId, format, outputDir}) =>
		guard(async () => {
			const playlist = playlistStore.getPlaylist(playlistId);
			if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);
			const exportService = await lazyExportService();
			const result = await exportService.exportPlaylist(playlist, {
				format: format ?? 'm3u8',
				outputDir,
			});
			if (!result.success) {
				throw new Error(result.error ?? 'Export failed.');
			}
			return {playlistName: result.playlistName, files: result.files};
		}),
);

server.registerTool(
	'import_m3u',
	{
		title: 'Import M3U/M3U8 playlist',
		description:
			'Import a local .m3u or .m3u8 file into a new saved playlist. Local file entries become local tracks; YouTube URLs resolve by videoId; other entries are matched via search.',
		inputSchema: {
			filePath: z.string().describe('Path to the .m3u/.m3u8 file'),
			name: z.string().optional().describe('Optional custom playlist name'),
		},
	},
	async ({filePath, name}) =>
		guard(async () => {
			const m3uImportService = await lazyM3UImportService();
			const result = await m3uImportService.importFromFile(filePath, name);
			return {
				playlistId: result.playlistId,
				playlistName: result.playlistName,
				total: result.total,
				matched: result.matched,
				failed: result.failed,
			};
		}),
);

server.registerTool(
	'import_online_playlist',
	{
		title: 'Import Spotify/YouTube playlist',
		description:
			'Import a playlist from a Spotify or YouTube URL/ID into a new saved playlist by matching tracks on YouTube Music.',
		inputSchema: {
			source: z.enum(['spotify', 'youtube']).describe('Import source'),
			urlOrId: z.string().describe('Playlist URL or ID'),
			name: z.string().optional().describe('Optional custom playlist name'),
		},
	},
	async ({source, urlOrId, name}) =>
		guard(async () => {
			const importService = await lazyImportService();
			const result = await importService.importPlaylist(source, urlOrId, name);
			return {
				playlistId: result.playlistId,
				playlistName: result.playlistName,
				source: result.source,
				total: result.total,
				matched: result.matched,
				failed: result.failed,
			};
		}),
);

// --- Local music -----------------------------------------------------------

server.registerTool(
	'list_local_music',
	{
		title: 'List local music',
		description:
			'Scan configured local music directories (and downloads folder) and list playable local tracks. Results are paginated to keep responses small.',
		inputSchema: {
			limit: z
				.number()
				.int()
				.min(1)
				.max(500)
				.optional()
				.describe('Max tracks to return (default 100)'),
			offset: z
				.number()
				.int()
				.min(0)
				.optional()
				.describe('Number of tracks to skip (default 0)'),
		},
	},
	async ({limit, offset}) =>
		guard(async () => {
			const localMusicService = await lazyLocalMusicService();
			const result = await localMusicService.scan();
			const start = offset ?? 0;
			const count = limit ?? 100;
			const page = result.tracks.slice(start, start + count);
			return {
				directories: result.directories,
				trackCount: result.tracks.length,
				offset: start,
				returned: page.length,
				hasMore: start + page.length < result.tracks.length,
				tracks: page.map(serializeTrack),
			};
		}),
);

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	// Never let a stray async error take the process down mid-session; log to
	// stderr (safe) so the stdio JSON-RPC stream on stdout stays intact.
	process.on('unhandledRejection', reason => {
		process.stderr.write(
			`Unhandled rejection: ${
				reason instanceof Error
					? (reason.stack ?? reason.message)
					: String(reason)
			}\n`,
		);
	});
	process.on('uncaughtException', error => {
		process.stderr.write(
			`Uncaught exception: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
		);
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);
	// Log to stderr so it does not corrupt the stdio JSON-RPC stream.
	process.stderr.write('youtube-music-cli MCP server running on stdio\n');
}

main().catch(error => {
	process.stderr.write(
		`Fatal MCP server error: ${
			error instanceof Error ? error.message : String(error)
		}\n`,
	);
	process.exit(1);
});
