import {Box, Text} from 'ink';
import {useTheme} from '../../hooks/useTheme.ts';
import {useHistory} from '../../stores/history.store.tsx';
import {useTerminalSize} from '../../hooks/useTerminalSize.ts';
import {truncate} from '../../utils/format.ts';
import {useKeyBinding} from '../../hooks/useKeyboard.ts';
import {KEYBINDINGS} from '../../utils/constants.ts';
import {useNavigation} from '../../hooks/useNavigation.ts';

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short',
});

function formatTimestamp(iso: string) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return iso;
	}

	return DATE_FORMATTER.format(date);
}

export default function HistoryLayout() {
	const {theme} = useTheme();
	const {history} = useHistory();
	const {columns} = useTerminalSize();
	const {dispatch} = useNavigation();

	useKeyBinding(KEYBINDINGS.BACK, () => {
		dispatch({category: 'GO_BACK'});
	});

	const maxTitleLength = Math.max(30, columns - 20);

	return (
		<Box flexDirection="column" padding={1} gap={1}>
			<Box marginBottom={1}>
				<Text color={theme.colors.primary} bold>
					Recently Played
				</Text>
			</Box>

			{history.length === 0 ? (
				<Text color={theme.colors.dim}>No listening history yet.</Text>
			) : (
				history.map(entry => {
					const artists = entry.track.artists
						?.map(artist => artist.name)
						.join(', ')
						.trim();
					return (
						<Box
							key={`${entry.playedAt}-${entry.track.videoId}`}
							flexDirection="column"
							paddingY={1}
							borderStyle="round"
							borderColor={theme.colors.dim}
						>
							<Text color={theme.colors.secondary}>
								{formatTimestamp(entry.playedAt)}
							</Text>
							<Box>
								<Text color={theme.colors.text} bold>
									{truncate(entry.track.title, maxTitleLength)}
								</Text>
								<Text color={theme.colors.dim}>
									{artists ? ` • ${artists}` : ''}
								</Text>
							</Box>
							{entry.track.album?.name && (
								<Text color={theme.colors.dim}>
									Album: {entry.track.album.name}
								</Text>
							)}
						</Box>
					);
				})
			)}

			<Box marginTop={1}>
				<Text color={theme.colors.dim}>
					Esc to go back • Shift+H to reopen history
				</Text>
			</Box>
		</Box>
	);
}
