import type {Track} from '../types';

interface Props {
	queue: Track[];
	queuePosition: number;
	onSelectTrack: (index: number) => void;
	onRemoveTrack: (index: number) => void;
}

export default function QueueList({
	queue,
	queuePosition,
	onSelectTrack,
	onRemoveTrack,
}: Props) {
	if (queue.length === 0) {
		return (
			<div
				style={{
					textAlign: 'center',
					padding: '2rem',
					color: 'var(--color-text-dim)',
				}}
			>
				Queue is empty
			</div>
		);
	}

	return (
		<div>
			<h3
				style={{
					fontSize: '1rem',
					marginBottom: '1rem',
					color: 'var(--color-text-dim)',
				}}
			>
				Queue ({queue.length})
			</h3>

			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: '0.5rem',
					maxHeight: '400px',
					overflowY: 'auto',
				}}
			>
				{queue.map((track, index) => (
					<div
						key={track.videoId}
						onClick={() => onSelectTrack(index)}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '1rem',
							padding: '0.75rem',
							borderRadius: '8px',
							backgroundColor:
								index === queuePosition
									? 'var(--color-bg-secondary)'
									: 'transparent',
							cursor: 'pointer',
							transition: 'background-color 0.2s',
						}}
					>
						<span
							style={{
								minWidth: '24px',
								textAlign: 'center',
								fontSize: '0.875rem',
								color:
									index === queuePosition
										? 'var(--color-primary)'
										: 'var(--color-text-dim)',
							}}
						>
							{index === queuePosition ? '▶' : index + 1}
						</span>

						<div style={{flex: 1, minWidth: 0}}>
							<div
								style={{
									fontSize: '0.875rem',
									fontWeight: index === queuePosition ? 600 : 400,
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
								}}
							>
								{track.title}
							</div>
							<div
								style={{
									fontSize: '0.75rem',
									color: 'var(--color-text-dim)',
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
								}}
							>
								{track.artists.map(a => a.name).join(', ')}
							</div>
						</div>

						{track.duration && (
							<span
								style={{fontSize: '0.75rem', color: 'var(--color-text-dim)'}}
							>
								{Math.floor(track.duration / 60)}:
								{(track.duration % 60).toString().padStart(2, '0')}
							</span>
						)}

						<button
							onClick={e => {
								e.stopPropagation();
								onRemoveTrack(index);
							}}
							style={{
								padding: '0.25rem 0.5rem',
								fontSize: '0.75rem',
								color: 'var(--color-text-dim)',
								opacity: 0,
								transition: 'opacity 0.2s',
							}}
							onMouseEnter={e => {
								e.currentTarget.style.opacity = '1';
							}}
							onMouseLeave={e => {
								e.currentTarget.style.opacity = '0';
							}}
						>
							✕
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
