// Reusable overlay to pick a target playlist (or create a new one) for a track.
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import {useCallback, useState} from 'react';
import {useKeyBinding} from '../../hooks/useKeyboard.ts';
import {useKeyboardBlocker} from '../../hooks/useKeyboardBlocker.tsx';
import {usePlaylist} from '../../hooks/usePlaylist.ts';
import {useTheme} from '../../hooks/useTheme.ts';
import {KEYBINDINGS} from '../../utils/constants.ts';
import type {Track} from '../../types/youtube-music.types.ts';

interface PlaylistPickerProps {
	track: Track;
	onDone: (message: string | null) => void;
}

export default function PlaylistPicker({track, onDone}: PlaylistPickerProps) {
	const {theme} = useTheme();
	const {playlists, addTrackToPlaylist, createPlaylist} = usePlaylist();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [creating, setCreating] = useState(playlists.length === 0);
	const [newName, setNewName] = useState('');
	// Block all other (non-bypass) key handlers while the picker is open so the
	// underlying view and global shortcuts do not react to picker navigation.
	useKeyboardBlocker(true);

	// Rows: existing playlists + a synthetic "create new" entry at the end.
	const totalRows = playlists.length + 1;
	const createRowIndex = playlists.length;

	const navigateUp = useCallback(() => {
		if (creating) return;
		setSelectedIndex(prev => Math.max(0, prev - 1));
	}, [creating]);

	const navigateDown = useCallback(() => {
		if (creating) return;
		setSelectedIndex(prev => Math.min(totalRows - 1, prev + 1));
	}, [creating, totalRows]);

	const confirmSelection = useCallback(() => {
		if (creating) return;
		if (selectedIndex === createRowIndex) {
			setCreating(true);
			setNewName('');
			return;
		}
		const playlist = playlists[selectedIndex];
		if (!playlist) return;
		const result = addTrackToPlaylist(playlist.playlistId, track);
		if (result === 'duplicate') {
			onDone(`"${track.title}" is already in "${playlist.name}".`);
		} else {
			onDone(`Added "${track.title}" to "${playlist.name}".`);
		}
	}, [
		creating,
		selectedIndex,
		createRowIndex,
		playlists,
		addTrackToPlaylist,
		track,
		onDone,
	]);

	const handleCreateSubmit = useCallback(
		(value: string) => {
			const name = value.trim() || `Playlist ${playlists.length + 1}`;
			const playlist = createPlaylist(name, [track]);
			onDone(`Created "${playlist.name}" with "${track.title}".`);
		},
		[playlists.length, createPlaylist, track, onDone],
	);

	const handleCancel = useCallback(() => {
		if (creating && playlists.length > 0) {
			setCreating(false);
			return;
		}
		onDone(null);
	}, [creating, playlists.length, onDone]);

	useKeyBinding(KEYBINDINGS.UP, navigateUp, {bypassBlock: true});
	useKeyBinding(KEYBINDINGS.DOWN, navigateDown, {bypassBlock: true});
	useKeyBinding(KEYBINDINGS.SELECT, confirmSelection, {bypassBlock: true});
	useKeyBinding(KEYBINDINGS.BACK, handleCancel, {bypassBlock: true});

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.colors.accent}
			paddingX={1}
		>
			<Text bold color={theme.colors.primary}>
				Add to playlist
			</Text>
			<Text color={theme.colors.dim}>{track.title}</Text>
			<Box marginTop={1} flexDirection="column">
				{creating ? (
					<Box>
						<Text color={theme.colors.text}>New playlist: </Text>
						<TextInput
							value={newName}
							onChange={setNewName}
							onSubmit={handleCreateSubmit}
							placeholder="Playlist name"
							focus
						/>
					</Box>
				) : (
					<>
						{playlists.map((playlist, index) => {
							const isSelected = index === selectedIndex;
							return (
								<Text
									key={playlist.playlistId}
									color={isSelected ? theme.colors.accent : theme.colors.text}
									bold={isSelected}
								>
									{isSelected ? '▶ ' : '  '}
									{playlist.name}
									<Text color={theme.colors.dim}>
										{' '}
										({playlist.tracks.length})
									</Text>
								</Text>
							);
						})}
						<Text
							color={
								selectedIndex === createRowIndex
									? theme.colors.accent
									: theme.colors.dim
							}
							bold={selectedIndex === createRowIndex}
						>
							{selectedIndex === createRowIndex ? '▶ ' : '  '}+ Create new
							playlist
						</Text>
					</>
				)}
			</Box>
			<Box marginTop={1}>
				<Text color={theme.colors.dim}>
					{creating
						? 'Enter create · Esc cancel'
						: '↑/↓ select · Enter add · Esc cancel'}
				</Text>
			</Box>
		</Box>
	);
}
