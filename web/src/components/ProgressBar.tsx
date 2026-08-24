import {useState, useRef, useEffect} from 'react';

interface Props {
	progress: number;
	duration: number;
	onSeek: (position: number) => void;
}

export default function ProgressBar({progress, duration, onSeek}: Props) {
	const [isDragging, setIsDragging] = useState(false);
	const [dragPosition, setDragPosition] = useState(0);
	const progressBarRef = useRef<HTMLDivElement>(null);

	const percentage = duration > 0 ? (progress / duration) * 100 : 0;
	const displayPercentage = isDragging
		? (dragPosition / duration) * 100
		: percentage;

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		setIsDragging(true);
		updatePosition(e);
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isDragging) {
			updatePosition(e);
		}
	};

	const updatePosition = (e: React.MouseEvent<HTMLDivElement>) => {
		const rect = progressBarRef.current?.getBoundingClientRect();
		if (!rect) return;

		const x = e.clientX - rect.left;
		const newPosition = (x / rect.width) * duration;
		setDragPosition(Math.max(0, Math.min(duration, newPosition)));
	};

	useEffect(() => {
		if (isDragging) {
			const handleGlobalMouseUp = () => {
				onSeek(dragPosition);
				setIsDragging(false);
			};
			const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
				const rect = progressBarRef.current?.getBoundingClientRect();
				if (rect) {
					const x = e.clientX - rect.left;
					const newPosition = (x / rect.width) * duration;
					setDragPosition(Math.max(0, Math.min(duration, newPosition)));
				}
			};

			document.addEventListener('mouseup', handleGlobalMouseUp);
			document.addEventListener('mousemove', handleGlobalMouseMove);

			return () => {
				document.removeEventListener('mouseup', handleGlobalMouseUp);
				document.removeEventListener('mousemove', handleGlobalMouseMove);
			};
		}
	}, [isDragging, dragPosition, duration, onSeek]);

	return (
		<div style={{width: '100%'}}>
			<div
				ref={progressBarRef}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				style={{
					position: 'relative',
					height: '6px',
					backgroundColor: 'var(--color-bg-secondary)',
					borderRadius: '3px',
					cursor: 'pointer',
					overflow: 'hidden',
				}}
			>
				<div
					style={{
						position: 'absolute',
						left: 0,
						top: 0,
						height: '100%',
						width: `${displayPercentage}%`,
						backgroundColor: 'var(--color-primary)',
						borderRadius: '3px',
						transition: isDragging ? 'none' : 'width 0.1s linear',
					}}
				/>
			</div>

			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					marginTop: '0.5rem',
					fontSize: '0.875rem',
					color: 'var(--color-text-dim)',
				}}
			>
				<span>{formatTime(isDragging ? dragPosition : progress)}</span>
				<span>{formatTime(duration)}</span>
			</div>
		</div>
	);
}
