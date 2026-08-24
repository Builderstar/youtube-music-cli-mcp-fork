import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {CONFIG_DIR} from '../../utils/constants.ts';
import {formatError} from '../../utils/error.ts';
import {logger} from '../logger/logger.service.ts';
import type {
	HistoryEntry,
	PersistedHistory,
} from '../../types/history.types.ts';

const HISTORY_FILE = join(CONFIG_DIR, 'history.json');
const SCHEMA_VERSION = 1;

const defaultHistory: PersistedHistory = {
	schemaVersion: SCHEMA_VERSION,
	entries: [],
	lastUpdated: new Date().toISOString(),
};

let saveLock = Promise.resolve();

export async function saveHistory(entries: HistoryEntry[]): Promise<void> {
	const currentLock = saveLock;
	let releaseLock: () => void = () => {};
	const newLock = new Promise<void>(resolve => {
		releaseLock = resolve;
	});
	saveLock = newLock;

	await currentLock.catch(() => {});

	try {
		if (!existsSync(CONFIG_DIR)) {
			await mkdir(CONFIG_DIR, {recursive: true});
		}

		const stateToSave: PersistedHistory = {
			...defaultHistory,
			entries,
			lastUpdated: new Date().toISOString(),
		};

		const tempFile = `${HISTORY_FILE}.tmp.${Date.now()}`;
		await writeFile(tempFile, JSON.stringify(stateToSave, null, 2), 'utf8');

		if (process.platform === 'win32' && existsSync(HISTORY_FILE)) {
			await import('node:fs/promises').then(fs => fs.unlink(HISTORY_FILE));
		}

		await import('node:fs/promises').then(fs =>
			fs.rename(tempFile, HISTORY_FILE),
		);

		logger.debug('HistoryService', 'Saved listening history', {
			count: entries.length,
		});
	} catch (error) {
		logger.error('HistoryService', 'Failed to save listening history', {
			error: formatError(error),
		});
	} finally {
		releaseLock();
	}
}

export async function loadHistory(): Promise<HistoryEntry[]> {
	try {
		if (!existsSync(HISTORY_FILE)) {
			logger.debug('HistoryService', 'No history file found');
			return [];
		}

		const data = await readFile(HISTORY_FILE, 'utf8');
		const persisted = JSON.parse(data) as PersistedHistory;

		if (persisted.schemaVersion !== SCHEMA_VERSION) {
			logger.warn('HistoryService', 'Schema version mismatch', {
				expected: SCHEMA_VERSION,
				found: persisted.schemaVersion,
			});
			return [];
		}

		if (!Array.isArray(persisted.entries)) {
			logger.warn('HistoryService', 'Invalid history format, resetting');
			return [];
		}

		logger.info('HistoryService', 'Loaded listening history', {
			count: persisted.entries.length,
			lastUpdated: persisted.lastUpdated,
		});

		return persisted.entries;
	} catch (error) {
		logger.error('HistoryService', 'Failed to load listening history', {
			error: formatError(error),
		});
		return [];
	}
}

export async function clearHistory(): Promise<void> {
	try {
		if (existsSync(HISTORY_FILE)) {
			await import('node:fs/promises').then(fs => fs.unlink(HISTORY_FILE));
			logger.info('HistoryService', 'Cleared listening history');
		}
	} catch (error) {
		logger.error('HistoryService', 'Failed to clear listening history', {
			error: formatError(error),
		});
	}
}
