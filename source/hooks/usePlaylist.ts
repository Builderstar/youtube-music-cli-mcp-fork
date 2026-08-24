// Playlist management hook
import {getConfigService} from '../services/config/config.service.ts';
import type {Playlist, Track} from '../types/youtube-music.types.ts';
import {useState, useCallback, useEffect} from 'react';

export type AddTrackResult = 'added' | 'duplicate';

export function usePlaylist() {
	const [playlists, setPlaylists] = useState<Playlist[]>([]);
	const configService = getConfigService();

	useEffect(() => {
		setPlaylists(configService.get('playlists'));
	}, []);

	const createPlaylist = useCallback(
		(name: string, tracks: Track[] = []) => {
			const newPlaylist: Playlist = {
				playlistId: Date.now().toString(),
				name,
				tracks: tracks.map(track => ({...track})),
			};

			const updatedPlaylists = [...playlists, newPlaylist];
			setPlaylists(updatedPlaylists);
			configService.set('playlists', updatedPlaylists);
			return newPlaylist;
		},
		[playlists, configService],
	);

	const deletePlaylist = useCallback(
		(playlistId: string) => {
			const updatedPlaylists = playlists.filter(
				p => p.playlistId !== playlistId,
			);
			setPlaylists(updatedPlaylists);
			configService.set('playlists', updatedPlaylists);
		},
		[playlists, configService],
	);

	const addTrackToPlaylist = useCallback(
		(playlistId: string, track: Track, force = false): AddTrackResult => {
			const playlistIndex = playlists.findIndex(
				p => p.playlistId === playlistId,
			);
			if (playlistIndex === -1) return 'added';

			const playlist = playlists[playlistIndex]!;
			const isDuplicate = playlist.tracks.some(
				t => t.videoId === track.videoId,
			);

			if (isDuplicate && !force) {
				return 'duplicate';
			}

			const updatedPlaylists = [...playlists];
			updatedPlaylists[playlistIndex]!.tracks.push(track);

			setPlaylists(updatedPlaylists);
			configService.set('playlists', updatedPlaylists);
			return 'added';
		},
		[playlists, configService],
	);

	const renamePlaylist = useCallback(
		(playlistId: string, newName: string) => {
			const updatedPlaylists = playlists.map(playlist =>
				playlist.playlistId === playlistId
					? {...playlist, name: newName}
					: playlist,
			);
			setPlaylists(updatedPlaylists);
			configService.set('playlists', updatedPlaylists);
		},
		[playlists, configService],
	);

	const removeTrackFromPlaylist = useCallback(
		(playlistId: string, trackIndex: number) => {
			const playlistIndex = playlists.findIndex(
				p => p.playlistId === playlistId,
			);
			if (playlistIndex === -1) return;

			const updatedPlaylists = [...playlists];
			updatedPlaylists[playlistIndex]!.tracks.splice(trackIndex, 1);

			setPlaylists(updatedPlaylists);
			configService.set('playlists', updatedPlaylists);
		},
		[playlists, configService],
	);

	const addTracksToPlaylist = useCallback(
		(playlistId: string, tracks: Track[], force = false): number => {
			const playlistIndex = playlists.findIndex(
				p => p.playlistId === playlistId,
			);
			if (playlistIndex === -1) return 0;

			const updatedPlaylists = [...playlists];
			const target = updatedPlaylists[playlistIndex]!;
			const existing = new Set(target.tracks.map(t => t.videoId));
			let added = 0;
			for (const track of tracks) {
				if (!force && existing.has(track.videoId)) continue;
				target.tracks.push(track);
				existing.add(track.videoId);
				added++;
			}

			setPlaylists(updatedPlaylists);
			configService.set('playlists', updatedPlaylists);
			return added;
		},
		[playlists, configService],
	);

	const moveTrack = useCallback(
		(playlistId: string, fromIndex: number, toIndex: number) => {
			const playlistIndex = playlists.findIndex(
				p => p.playlistId === playlistId,
			);
			if (playlistIndex === -1) return;

			const updatedPlaylists = [...playlists];
			const tracks = [...updatedPlaylists[playlistIndex]!.tracks];
			if (
				fromIndex < 0 ||
				fromIndex >= tracks.length ||
				toIndex < 0 ||
				toIndex >= tracks.length ||
				fromIndex === toIndex
			) {
				return;
			}

			const [moved] = tracks.splice(fromIndex, 1);
			if (!moved) return;
			tracks.splice(toIndex, 0, moved);
			updatedPlaylists[playlistIndex] = {
				...updatedPlaylists[playlistIndex]!,
				tracks,
			};

			setPlaylists(updatedPlaylists);
			configService.set('playlists', updatedPlaylists);
		},
		[playlists, configService],
	);

	const getPlaylist = useCallback(
		(playlistId: string): Playlist | undefined =>
			playlists.find(p => p.playlistId === playlistId),
		[playlists],
	);

	return {
		playlists,
		createPlaylist,
		deletePlaylist,
		renamePlaylist,
		addTrackToPlaylist,
		addTracksToPlaylist,
		removeTrackFromPlaylist,
		moveTrack,
		getPlaylist,
	};
}
