// MPRIS service — Linux only, enables playerctl / media key support
// No-ops on non-Linux platforms
import {logger} from '../logger/logger.service.ts';

interface TrackInfo {
	title: string;
	artist: string;
	duration: number; // microseconds (MPRIS standard)
}

type MprisPlayer = {
	metadata: Record<string, unknown>;
	playbackStatus: string;
	canPlay: boolean;
	canPause: boolean;
	canGoNext: boolean;
	canGoPrevious: boolean;
	canSeek: boolean;
	on: (event: string, cb: (...args: unknown[]) => void) => void;
	objectPath: string;
};

type MprisModule = {
	createPlayer: (opts: {
		name: string;
		identity: string;
		supportedInterfaces: string[];
	}) => MprisPlayer;
};

type PlaybackCallbacks = {
	onPlay?: () => void;
	onPause?: () => void;
	onNext?: () => void;
	onPrevious?: () => void;
};

export class MprisService {
	private player: MprisPlayer | null = null;

	get isSupported(): boolean {
		return process.platform === 'linux';
	}

	async initialize(callbacks: PlaybackCallbacks = {}): Promise<void> {
		if (!this.isSupported) {
			logger.debug('MprisService', 'MPRIS not supported on this platform', {
				platform: process.platform,
			});
			return;
		}

		try {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			const mpris = (await import('mpris-service')) as unknown as MprisModule;
			this.player = mpris.createPlayer({
				name: 'youtube-music-cli',
				identity: 'YouTube Music CLI',
				supportedInterfaces: ['player'],
			});

			// Wire up MPRIS events to player callbacks
			if (callbacks.onPlay) this.player.on('play', callbacks.onPlay);
			if (callbacks.onPause) this.player.on('pause', callbacks.onPause);
			if (callbacks.onNext) this.player.on('next', callbacks.onNext);
			if (callbacks.onPrevious)
				this.player.on('previous', callbacks.onPrevious);

			this.player.canPlay = true;
			this.player.canPause = true;
			this.player.canGoNext = true;
			this.player.canGoPrevious = true;
			this.player.canSeek = false;

			logger.info('MprisService', 'MPRIS player initialized');
		} catch (error) {
			logger.warn('MprisService', 'Could not initialize MPRIS', {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	updateTrack(track: TrackInfo, isPlaying: boolean): void {
		if (!this.player) return;
		try {
			this.player.metadata = {
				'mpris:length': track.duration,
				'xesam:title': track.title,
				'xesam:artist': [track.artist],
			};
			this.player.playbackStatus = isPlaying ? 'Playing' : 'Paused';
		} catch {
			// Ignore MPRIS update errors
		}
	}

	setPlaying(playing: boolean): void {
		if (!this.player) return;
		try {
			this.player.playbackStatus = playing ? 'Playing' : 'Paused';
		} catch {
			// Ignore
		}
	}
}

let instance: MprisService | null = null;
export const getMprisService = (): MprisService => {
	if (!instance) instance = new MprisService();
	return instance;
};
