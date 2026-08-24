// Local Music view - browse and play audio files from configured directories.
import {Box, Text} from 'ink';
import {useCallback, useEffect, useState} from 'react';
import {useTheme} from '../../hooks/useTheme.ts';
import {useNavigation} from '../../hooks/useNavigation.ts';
import {usePlayer} from '../../hooks/usePlayer.ts';
import {useKeyBinding} from '../../hooks/useKeyboard.ts';
import {getLocalMusicService} from '../../services/local-music/local-music.service.ts';
import {KEYBINDINGS} from '../../utils/constants.ts';
import {formatTime, truncate} from '../../utils/format.ts';
import PlaylistPicker from '../playlist/PlaylistPicker.tsx';
import type {Track} from '../../types/youtube-music.types.ts';

const PAGE_SIZE = 15;

export default function LocalMusicLayout() {
	const {theme} = useTheme();
	const {dispatch} = useNavigation();
	const {play, setQueue} = usePlayer();
	const localMusicService = getLocalMusicService();

	const [tracks, setTracks] = useState<Track[]>([]);
	const [directories, setDirectories] = useState<string[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [pickerTrack, setPickerTrack] = useState<Track | null>(null);
	const [reloadToken, setReloadToken] = useState(0);

	const reload = useCallback(() => {
		setIsLoading(true);
		setError(null);
		setReloadToken(prev => prev + 1);
	}, []);

	useEffect(() => {
		let cancelled = false;
		localMusicService
			.scan()
			.then(result => {
				if (cancelled) return;
				setTracks(result.tracks);
				setDirectories(result.directories);
				setIsLoading(false);
				if (result.directories.length === 0) {
					setStatus(
						'No local music directory configured. Set one in Settings.',
					);
				}
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setError(
					err instanceof Error ? err.message : 'Failed to scan local music',
				);
				setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [localMusicService, reloadToken]);

	const clampedIndex = Math.min(selectedIndex, Math.max(0, tracks.length - 1));

	const navigateUp = useCallback(() => {
		if (pickerTrack) return;
		setSelectedIndex(prev => Math.max(0, prev - 1));
	}, [pickerTrack]);

	const navigateDown = useCallback(() => {
		if (pickerTrack) return;
		setSelectedIndex(prev =>
			Math.min(Math.max(0, tracks.length - 1), prev + 1),
		);
	}, [pickerTrack, tracks.length]);

	const playSelected = useCallback(() => {
		if (pickerTrack || tracks.length === 0) return;
		const ordered = [
			...tracks.slice(clampedIndex),
			...tracks.slice(0, clampedIndex),
		];
		setQueue(ordered);
		const first = ordered[0];
		if (first) play(first);
	}, [pickerTrack, tracks, clampedIndex, setQueue, play]);

	const openPicker = useCallback(() => {
		if (pickerTrack || tracks.length === 0) return;
		const track = tracks[clampedIndex];
		if (track) setPickerTrack(track);
	}, [pickerTrack, tracks, clampedIndex]);

	const handleBack = useCallback(() => {
		if (pickerTrack) return;
		dispatch({category: 'GO_BACK'});
	}, [pickerTrack, dispatch]);

	useKeyBinding(KEYBINDINGS.UP, navigateUp);
	useKeyBinding(KEYBINDINGS.DOWN, navigateDown);
	useKeyBinding(KEYBINDINGS.SELECT, playSelected);
	useKeyBinding(KEYBINDINGS.ADD_TO_PLAYLIST, openPicker);
	useKeyBinding(['r'], () => {
		if (!pickerTrack) reload();
	});
	useKeyBinding(KEYBINDINGS.BACK, handleBack);

	const page = Math.floor(clampedIndex / PAGE_SIZE);
	const start = page * PAGE_SIZE;
	const visible = tracks.slice(start, start + PAGE_SIZE);

	return (
		<Box flexDirection="column" gap={1}>
			<Box
				borderStyle="double"
				borderColor={theme.colors.secondary}
				paddingX={1}
			>
				<Text bold color={theme.colors.primary}>
					🎵 Local Music
				</Text>
				<Text color={theme.colors.dim}> · {tracks.length} tracks</Text>
			</Box>

			{directories.length > 0 && (
				<Text color={theme.colors.dim}>
					{directories.map(d => truncate(d, 50)).join('  |  ')}
				</Text>
			)}

			{pickerTrack ? (
				<PlaylistPicker
					track={pickerTrack}
					onDone={message => {
						setPickerTrack(null);
						if (message) setStatus(message);
					}}
				/>
			) : isLoading ? (
				<Text color={theme.colors.dim}>Scanning local music...</Text>
			) : error ? (
				<Text color={theme.colors.error}>{error}</Text>
			) : tracks.length === 0 ? (
				<Text color={theme.colors.dim}>
					No local audio files found. Configure a music directory in Settings or
					download some songs.
				</Text>
			) : (
				<Box flexDirection="column">
					{visible.map((track, i) => {
						const index = start + i;
						const isSelected = index === clampedIndex;
						const artistNames =
							track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
						const durationText =
							track.duration != null ? formatTime(track.duration) : '';
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
									{String(index + 1).padStart(3, ' ')}.{' '}
								</Text>
								<Text
									color={
										isSelected ? theme.colors.background : theme.colors.text
									}
									bold={isSelected}
								>
									{truncate(track.title, 38)}
								</Text>
								<Text
									color={
										isSelected ? theme.colors.background : theme.colors.dim
									}
								>
									{'  '}
									{truncate(artistNames, 22)}
									{durationText ? `  ${durationText}` : ''}
								</Text>
							</Box>
						);
					})}
				</Box>
			)}

			{!pickerTrack && (
				<Box marginTop={1} flexDirection="column">
					<Text color={theme.colors.dim}>
						<Text color={theme.colors.text}>Enter</Text> play |{' '}
						<Text color={theme.colors.text}>a</Text> add to playlist |{' '}
						<Text color={theme.colors.text}>r</Text> rescan |{' '}
						<Text color={theme.colors.text}>Esc</Text> back
					</Text>
					{status && <Text color={theme.colors.accent}>{status}</Text>}
				</Box>
			)}
		</Box>
	);
}
