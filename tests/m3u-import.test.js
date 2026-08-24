import test from 'ava';

test('m3u-import: parses EXTINF title and duration with targets', async t => {
	const {getM3UImportService} =
		await import('../source/services/import/m3u-import.service.ts');
	const service = getM3UImportService();
	const content = [
		'#EXTM3U',
		'#EXTINF:210,Artist - Title',
		'https://www.youtube.com/watch?v=abcdefghijk',
		'#EXTINF:-1,Local Song',
		'/home/user/music/local.mp3',
		'# a comment',
		'relative/path.flac',
	].join('\n');

	const entries = service.parse(content);
	t.is(entries.length, 3);

	t.is(entries[0].target, 'https://www.youtube.com/watch?v=abcdefghijk');
	t.is(entries[0].title, 'Artist - Title');
	t.is(entries[0].duration, 210);

	t.is(entries[1].target, '/home/user/music/local.mp3');
	t.is(entries[1].title, 'Local Song');
	t.is(entries[1].duration, undefined);

	t.is(entries[2].target, 'relative/path.flac');
	t.is(entries[2].title, undefined);
});

test('m3u-import: ignores blank lines and directives', async t => {
	const {getM3UImportService} =
		await import('../source/services/import/m3u-import.service.ts');
	const service = getM3UImportService();
	const content =
		'#EXTM3U\n\n#PLAYLIST:My List\n\nhttps://youtu.be/abcdefghijk\n';
	const entries = service.parse(content);
	t.is(entries.length, 1);
	t.is(entries[0].target, 'https://youtu.be/abcdefghijk');
});
