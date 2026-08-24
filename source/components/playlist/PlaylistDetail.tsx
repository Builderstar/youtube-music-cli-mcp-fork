// Playlist detail view - manage the tracks inside a single playlist.
import {Box, Text} from 'ink';
import {useCallback, useMemo, useState} from 'react';
import {useNavigation} from '../../hooks/useNavigation.ts';
import {useKeyBinding} from '../../hooks/useKeyboard.ts';
import {usePlayer} from '../../hooks/usePlayer.ts';
import {usePlaylist} from '../../hooks/usePlaylist.ts';
import {useTheme} from '../../hooks/useTheme.ts';
import {KEYBINDINGS} from '../../utils/constants.ts';
import {formatTime, truncate} from '../../utils/format.ts';
import {getDownloadService} from '../../services/download/download.service.ts';

export default function PlaylistDetail() {
	const {theme} = useTheme();
	const {play, setQueue} = usePlayer();
	const {state, dispatch} = useNavigation();
	const downloadService = getDownloadService();
	const {getPlaylist, removeTrackFromPlaylist, moveTrack} = usePlaylist();

	const playlist = useMemo(
		() =>
			state.activePlaylistId ? getPlaylist(state.activePlaylistId) : undefined,
		[getPlaylist, state.activePlaylistId],
	);

	const [selectedIndex, setSelectedIndex] = useState(0);
	const [status, setStatus] = useState<string | null>(null);
	const [isDownloading, setIsDownloading] = useState(false);

	const tracks = useMemo(() => playlist?.tracks ?? [], [playlist]);
	const clampedIndex = Math.min(selectedIndex, Math.max(0, tracks.length - 1));

	const navigateUp = useCallback(() => {
		setSelectedIndex(prev => Math.max(0, prev - 1));
	}, []);

	const navigateDown = useCallback(() => {
		setSelectedIndex(prev =>
			Math.min(Math.max(0, tracks.length - 1), prev + 1),
		);
	}, [tracks.length]);

	const playSelected = useCallback(() => {
		if (!playlist || tracks.length === 0) return;
		// Queue the whole playlist starting from the selected track.
		const ordered = [
			...tracks.slice(clampedIndex),
			...tracks.slice(0, clampedIndex),
		];
		setQueue(ordered);
		const first = ordered[0];
		if (first) play(first);
	}, [playlist, tracks, clampedIndex, setQueue, play]);

	const playAll = useCallback(() => {
		if (!playlist || tracks.length === 0) return;
		setQueue([...tracks]);
		const first = tracks[0];
		if (first) play(first);
		setStatus(`Playing "${playlist.name}" (${tracks.length} tracks)`);
	}, [playlist, tracks, setQueue, play]);

	const removeSelected = useCallback(() => {
		if (!playlist || tracks.length === 0) return;
		const track = tracks[clampedIndex];
		removeTrackFromPlaylist(playlist.playlistId, clampedIndex);
		setSelectedIndex(prev => Math.max(0, Math.min(prev, tracks.length - 2)));
		if (track) setStatus(`Removed "${track.title}"`);
	}, [playlist, tracks, clampedIndex, removeTrackFromPlaylist]);

	const moveUp = useCallback(() => {
		if (!playlist || clampedIndex <= 0) return;
		moveTrack(playlist.playlistId, clampedIndex, clampedIndex - 1);
		setSelectedIndex(clampedIndex - 1);
	}, [playlist, clampedIndex, moveTrack]);

	const moveDown = useCallback(() => {
		if (!playlist || clampedIndex >= tracks.length - 1) return;
		moveTrack(playlist.playlistId, clampedIndex, clampedIndex + 1);
		setSelectedIndex(clampedIndex + 1);
	}, [playlist, clampedIndex, tracks.length, moveTrack]);

	const handleBack = useCallback(() => {
		dispatch({category: 'GO_BACK'});
	}, [dispatch]);

	const handleDownload = useCallback(async () => {
		if (!playlist || isDownloading) return;
		const config = downloadService.getConfig();
		if (!config.enabled) {
			setStatus('Downloads are disabled. Enable them in Settings.');
			return;
		}
		const track = tracks[clampedIndex];
		if (!track) return;
		if (track.source === 'local') {
			setStatus('This track is already a local file.');
			return;
		}
		setStatus(`Downloading "${track.title}"...`);
		try {
			setIsDownloading(true);
			const summary = await downloadService.downloadTracks([track]);
			setStatus(
				`Downloaded ${summary.downloaded}, skipped ${summary.skipped}, failed ${summary.failed}.`,
			);
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : 'Failed to download track.',
			);
		} finally {
			setIsDownloading(false);
		}
	}, [playlist, tracks, clampedIndex, downloadService, isDownloading]);

	useKeyBinding(KEYBINDINGS.UP, navigateUp);
	useKeyBinding(KEYBINDINGS.DOWN, navigateDown);
	useKeyBinding(KEYBINDINGS.SELECT, playSelected);
	useKeyBinding(KEYBINDINGS.CREATE_MIX, playAll);
	useKeyBinding(KEYBINDINGS.REMOVE_FROM_PLAYLIST, removeSelected);
	useKeyBinding(KEYBINDINGS.MOVE_TRACK_UP, moveUp);
	useKeyBinding(KEYBINDINGS.MOVE_TRACK_DOWN, moveDown);
	useKeyBinding(KEYBINDINGS.BACK, handleBack);
	useKeyBinding(KEYBINDINGS.DOWNLOAD, () => {
		void handleDownload();
	});

	if (!playlist) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text color={theme.colors.dim}>Playlist not found.</Text>
				<Text color={theme.colors.dim}>
					<Text color={theme.colors.text}>Esc</Text> back
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Box
				borderStyle="double"
				borderColor={theme.colors.secondary}
				paddingX={1}
			>
				<Text bold color={theme.colors.primary}>
					{playlist.name}
				</Text>
				<Text color={theme.colors.dim}> · {tracks.length} tracks</Text>
			</Box>

			{tracks.length === 0 ? (
				<Text color={theme.colors.dim}>
					This playlist is empty. Add songs from search.
				</Text>
			) : (
				<Box flexDirection="column">
					{tracks.map((track, index) => {
						const isSelected = index === clampedIndex;
						const artistNames =
							track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
						const durationText =
							track.duration != null ? formatTime(track.duration) : '';
						const isLocal = track.source === 'local';
						return (
							<Box
								key={`${track.videoId}-${index}`}
								paddingX={1}
								backgroundColor={
									isSelected ? theme.colors.secondary : undefined
								}
							>
								<Text
									color={
										isSelected ? theme.colors.background : theme.colors.dim
									}
								>
									{String(index + 1).padStart(2, ' ')}.{' '}
								</Text>
								<Text
									color={
										isSelected ? theme.colors.background : theme.colors.text
									}
									bold={isSelected}
								>
									{truncate(track.title, 40)}
								</Text>
								<Text
									color={
										isSelected ? theme.colors.background : theme.colors.dim
									}
								>
									{'  '}
									{truncate(artistNames, 24)}
									{isLocal ? ' [local]' : ''}
									{durationText ? `  ${durationText}` : ''}
								</Text>
							</Box>
						);
					})}
				</Box>
			)}

			<Box marginTop={1} flexDirection="column">
				<Text color={theme.colors.dim}>
					<Text color={theme.colors.text}>Enter</Text> play from here |{' '}
					<Text color={theme.colors.text}>m</Text> play all |{' '}
					<Text color={theme.colors.text}>Shift+↑/↓</Text> reorder |{' '}
					<Text color={theme.colors.text}>d</Text> remove |{' '}
					<Text color={theme.colors.text}>Shift+D</Text> download |{' '}
					<Text color={theme.colors.text}>Esc</Text> back
				</Text>
				{status && <Text color={theme.colors.accent}>{status}</Text>}
			</Box>
		</Box>
	);
}
