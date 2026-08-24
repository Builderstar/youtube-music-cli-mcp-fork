import {useTheme} from '../hooks/useTheme';

interface Props {
	isConnected: boolean;
	currentView?: 'player' | 'search' | 'settings';
	onNavigate?: (view: 'player' | 'search' | 'settings') => void;
}

export default function NavigationBar({
	isConnected,
	currentView = 'player',
	onNavigate,
}: Props) {
	const {theme, toggleTheme} = useTheme();

	const navButtonStyle = (active: boolean) => ({
		padding: '0.5rem 1rem',
		borderRadius: '8px',
		backgroundColor: active ? 'var(--color-primary)' : 'var(--color-bg)',
		border: '1px solid var(--color-border)',
		color: active ? 'white' : 'var(--color-text)',
		fontSize: '0.875rem',
		cursor: 'pointer',
		transition: 'all 0.2s',
	});

	return (
		<header
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				padding: '1rem 2rem',
				borderBottom: '1px solid var(--color-border)',
				backgroundColor: 'var(--color-bg-secondary)',
			}}
		>
			<div style={{display: 'flex', alignItems: 'center', gap: '1.5rem'}}>
				<div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
					<div
						style={{
							width: '32px',
							height: '32px',
							background:
								'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
							borderRadius: '8px',
						}}
					/>
					<div>
						<h1 style={{fontSize: '1.125rem', fontWeight: 600}}>
							YouTube Music CLI
						</h1>
						<span
							style={{
								fontSize: '0.75rem',
								color: 'var(--color-text-dim)',
							}}
						>
							Web UI
						</span>
					</div>
				</div>

				{onNavigate && (
					<nav style={{display: 'flex', gap: '0.5rem'}}>
						<button
							onClick={() => onNavigate('player')}
							style={navButtonStyle(currentView === 'player')}
						>
							Player
						</button>
						<button
							onClick={() => onNavigate('search')}
							style={navButtonStyle(currentView === 'search')}
						>
							Search
						</button>
						<button
							onClick={() => onNavigate('settings')}
							style={navButtonStyle(currentView === 'settings')}
						>
							Settings
						</button>
					</nav>
				)}
			</div>

			<div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						fontSize: '0.875rem',
					}}
				>
					<div
						style={{
							width: '8px',
							height: '8px',
							borderRadius: '50%',
							backgroundColor: isConnected
								? 'var(--color-success)'
								: 'var(--color-error)',
						}}
					/>
					<span style={{color: 'var(--color-text-dim)'}}>
						{isConnected ? 'Connected' : 'Connecting...'}
					</span>
				</div>

				<button
					onClick={toggleTheme}
					style={{
						padding: '0.5rem 1rem',
						borderRadius: '8px',
						backgroundColor: 'var(--color-bg)',
						border: '1px solid var(--color-border)',
						color: 'var(--color-text)',
						fontSize: '0.875rem',
					}}
				>
					{theme === 'dark' ? '☀️' : '🌙'}
				</button>
			</div>
		</header>
	);
}
