// Shared types for web UI (copied from source/types/)

export interface Track {
	videoId: string;
	title: string;
	artists: Artist[];
	album?: Album;
	duration?: number;
}

export interface Artist {
	artistId: string;
	name: string;
}

export interface Album {
	albumId: string;
	name: string;
	artists: Artist[];
}

export interface Playlist {
	playlistId: string;
	name: string;
	tracks: Track[];
}

export interface PlayerState {
	currentTrack: Track | null;
	isPlaying: boolean;
	volume: number;
	speed: number;
	progress: number;
	duration: number;
	queue: Track[];
	queuePosition: number;
	repeat: 'off' | 'all' | 'one';
	shuffle: boolean;
	autoplay: boolean;
	isLoading: boolean;
	error: string | null;
}

export interface PlayerAction {
	category:
		| 'PLAY'
		| 'PAUSE'
		| 'RESUME'
		| 'STOP'
		| 'NEXT'
		| 'PREVIOUS'
		| 'SEEK'
		| 'SET_VOLUME'
		| 'VOLUME_UP'
		| 'VOLUME_DOWN'
		| 'VOLUME_FINE_UP'
		| 'VOLUME_FINE_DOWN'
		| 'TOGGLE_SHUFFLE'
		| 'TOGGLE_REPEAT'
		| 'TOGGLE_AUTOPLAY'
		| 'SET_QUEUE'
		| 'ADD_TO_QUEUE'
		| 'REMOVE_FROM_QUEUE'
		| 'CLEAR_QUEUE'
		| 'SET_QUEUE_POSITION'
		| 'UPDATE_PROGRESS'
		| 'SET_DURATION'
		| 'TICK'
		| 'SET_LOADING'
		| 'SET_ERROR'
		| 'RESTORE_STATE'
		| 'SET_SPEED';
	track?: Track;
	position?: number;
	volume?: number;
	speed?: number;
	queue?: Track[];
	index?: number;
	progress?: number;
	duration?: number;
	loading?: boolean;
	error?: string | null;
	currentTrack?: Track | null;
	queuePosition?: number;
	shuffle?: boolean;
	repeat?: 'off' | 'all' | 'one';
}

export interface SearchResult {
	type: 'song' | 'album' | 'artist' | 'playlist';
	data: Track | Album | Artist | Playlist;
}

export interface ServerMessage {
	type:
		| 'state-update'
		| 'event'
		| 'error'
		| 'auth'
		| 'search-results'
		| 'config-update';
	state?: Partial<PlayerState>;
	event?: string;
	data?: unknown;
	error?: string;
	results?: SearchResult[];
	config?: Partial<Config>;
}

export interface ClientMessage {
	type: 'command' | 'auth-request' | 'search-request' | 'config-update';
	action?: PlayerAction;
	token?: string;
	query?: string;
	searchType?: 'all' | 'songs' | 'artists' | 'albums' | 'playlists';
	config?: Partial<Config>;
}

export interface Config {
	theme: string;
	volume: number;
	repeat: 'off' | 'all' | 'one';
	shuffle: boolean;
	streamQuality: 'low' | 'medium' | 'high';
	audioNormalization: boolean;
	notifications: boolean;
	discordRichPresence: boolean;
}

export interface ImportProgress {
	status:
		| 'idle'
		| 'fetching'
		| 'matching'
		| 'creating'
		| 'completed'
		| 'failed'
		| 'cancelled';
	current: number;
	total: number;
	currentTrack?: string;
	message: string;
}
