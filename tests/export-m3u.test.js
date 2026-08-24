import test from 'ava';
import {mkdtempSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('export: writes plain .m3u with youtube and local entries', async t => {
	const {getExportService} =
		await import('../source/services/export/export.service.ts');
	const service = getExportService();
	const outputDir = mkdtempSync(path.join(tmpdir(), 'ymc-export-'));

	const playlist = {
		playlistId: 'p1',
		name: 'My Mix',
		tracks: [
			{
				videoId: 'abcdefghijk',
				title: 'Remote Song',
				artists: [{artistId: 'a1', name: 'Remote Artist'}],
				duration: 200,
			},
			{
				videoId: 'local:/music/song.mp3',
				title: 'Local Song',
				artists: [{artistId: 'a2', name: 'Local Artist'}],
				duration: 150,
				source: 'local',
				localPath: '/music/song.mp3',
			},
		],
	};

	const result = await service.exportPlaylist(playlist, {
		format: 'm3u',
		outputDir,
	});

	t.true(result.success);
	t.is(result.files.length, 1);
	const filePath = result.files[0];
	t.true(filePath.endsWith('.m3u'));
	t.true(existsSync(filePath));

	const content = readFileSync(filePath, 'utf-8');
	t.true(content.includes('#EXTM3U'));
	t.true(content.includes('#EXTINF:200,Remote Artist - Remote Song'));
	t.true(content.includes('https://www.youtube.com/watch?v=abcdefghijk'));
	t.true(content.includes('#EXTINF:150,Local Artist - Local Song'));
	t.true(content.includes('/music/song.mp3'));
});
