// Helpers for detecting and handling local audio files.
import path from 'node:path';

export const LOCAL_AUDIO_EXTENSIONS = [
	'.mp3',
	'.m4a',
	'.flac',
	'.opus',
	'.ogg',
	'.oga',
	'.wav',
	'.aac',
	'.wma',
	'.aiff',
	'.aif',
] as const;

export function hasAudioExtension(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return (LOCAL_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Returns true when the given string refers to a local filesystem media
 * source (an absolute/relative path or a file:// URL) rather than a remote
 * http(s) URL or a bare YouTube videoId.
 */
export function isLocalMediaPath(value: string): boolean {
	if (!value) return false;
	if (value.startsWith('file://')) return true;
	if (/^https?:\/\//i.test(value)) return false;

	// Windows drive path e.g. C:\music\song.mp3 or C:/music/song.mp3
	if (/^[a-zA-Z]:[\\/]/.test(value)) return true;

	// POSIX absolute path or explicit relative path
	if (
		value.startsWith('/') ||
		value.startsWith('./') ||
		value.startsWith('../')
	) {
		return true;
	}

	// UNC path
	if (value.startsWith('\\\\')) return true;

	// Otherwise, if it clearly points at an audio file and contains a path
	// separator, treat it as local.
	if (hasAudioExtension(value) && /[\\/]/.test(value)) return true;

	return false;
}

/** Normalize a file:// URL into a plain filesystem path. */
export function fileUrlToPath(value: string): string {
	if (!value.startsWith('file://')) return value;
	try {
		return new URL(value).pathname;
	} catch {
		return value.replace(/^file:\/\//, '');
	}
}
