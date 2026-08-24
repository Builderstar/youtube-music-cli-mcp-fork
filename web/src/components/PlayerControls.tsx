interface Props {
	isPlaying: boolean;
	isLoading: boolean;
	shuffle: boolean;
	repeat: 'off' | 'all' | 'one';
	autoplay: boolean;
	onPlayPause: () => void;
	onNext: () => void;
	onPrevious: () => void;
	onToggleShuffle: () => void;
	onToggleRepeat: () => void;
	onToggleAutoplay: () => void;
}

export default function PlayerControls({
	isPlaying,
	isLoading,
	shuffle,
	repeat,
	autoplay,
	onPlayPause,
	onNext,
	onPrevious,
	onToggleShuffle,
	onToggleRepeat,
	onToggleAutoplay,
}: Props) {
	const controlButtonStyle = (active: boolean) => ({
		padding: '0.75rem',
		borderRadius: '50%',
		backgroundColor: active ? 'var(--color-primary)' : 'transparent',
		color: active ? 'white' : 'var(--color-text-dim)',
		border: '1px solid transparent',
		fontSize: '1.125rem',
		cursor: 'pointer',
		transition: 'all 0.2s',
		lineHeight: 1,
	});

	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				gap: '0.75rem',
			}}
		>
			<button
				onClick={onToggleShuffle}
				style={controlButtonStyle(shuffle)}
				title={shuffle ? 'Shuffle: On' : 'Shuffle: Off'}
			>
				🔀
			</button>

			<button
				onClick={onPrevious}
				style={{
					padding: '0.75rem',
					borderRadius: '50%',
					backgroundColor: 'var(--color-bg-secondary)',
					color: 'var(--color-text)',
					border: '1px solid var(--color-border)',
					fontSize: '1.125rem',
					cursor: 'pointer',
					transition: 'all 0.2s',
				}}
				title="Previous"
			>
				⏮
			</button>

			<button
				onClick={onPlayPause}
				disabled={isLoading}
				style={{
					width: '56px',
					height: '56px',
					borderRadius: '50%',
					backgroundColor: 'var(--color-primary)',
					color: 'white',
					fontSize: '1.5rem',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					cursor: isLoading ? 'not-allowed' : 'pointer',
					opacity: isLoading ? 0.6 : 1,
					transition: 'all 0.2s',
					border: 'none',
					boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
				}}
				title={isPlaying ? 'Pause' : 'Play'}
			>
				{isLoading ? '⏳' : isPlaying ? '⏸' : '▶'}
			</button>

			<button
				onClick={onNext}
				style={{
					padding: '0.75rem',
					borderRadius: '50%',
					backgroundColor: 'var(--color-bg-secondary)',
					color: 'var(--color-text)',
					border: '1px solid var(--color-border)',
					fontSize: '1.125rem',
					cursor: 'pointer',
					transition: 'all 0.2s',
				}}
				title="Next"
			>
				⏭
			</button>

			<button
				onClick={onToggleRepeat}
				style={{
					...controlButtonStyle(repeat !== 'off'),
					position: 'relative',
				}}
				title={`Repeat: ${repeat.toUpperCase()}`}
			>
				🔁
				{repeat === 'one' && (
					<span
						style={{
							position: 'absolute',
							bottom: '2px',
							right: '2px',
							fontSize: '0.55rem',
							fontWeight: 'bold',
							backgroundColor: 'var(--color-accent)',
							color: 'white',
							borderRadius: '50%',
							width: '12px',
							height: '12px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						1
					</span>
				)}
			</button>

			<button
				onClick={onToggleAutoplay}
				style={controlButtonStyle(autoplay)}
				title={autoplay ? 'Autoplay: On (Radio Mode)' : 'Autoplay: Off'}
			>
				∞
			</button>
		</div>
	);
}
