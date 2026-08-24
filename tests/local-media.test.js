import test from 'ava';

test('local-media: detects absolute POSIX paths as local', async t => {
	const {isLocalMediaPath} = await import('../source/utils/local-media.ts');
	t.true(isLocalMediaPath('/home/user/song.mp3'));
	t.true(isLocalMediaPath('./relative/song.flac'));
	t.true(isLocalMediaPath('../up/song.opus'));
});

test('local-media: detects file:// URLs and Windows drive paths', async t => {
	const {isLocalMediaPath} = await import('../source/utils/local-media.ts');
	t.true(isLocalMediaPath('file:///home/user/song.mp3'));
	t.true(isLocalMediaPath('C:\\Music\\song.mp3'));
	t.true(isLocalMediaPath('C:/Music/song.mp3'));
});

test('local-media: does not treat http URLs or bare videoIds as local', async t => {
	const {isLocalMediaPath} = await import('../source/utils/local-media.ts');
	t.false(isLocalMediaPath('https://www.youtube.com/watch?v=abc123'));
	t.false(isLocalMediaPath('http://example.com/a.mp3'));
	t.false(isLocalMediaPath('dQw4w9WgXcQ'));
	t.false(isLocalMediaPath(''));
});

test('local-media: hasAudioExtension recognizes common formats', async t => {
	const {hasAudioExtension} = await import('../source/utils/local-media.ts');
	t.true(hasAudioExtension('a.mp3'));
	t.true(hasAudioExtension('a.M4A'));
	t.true(hasAudioExtension('a.flac'));
	t.false(hasAudioExtension('a.txt'));
	t.false(hasAudioExtension('a'));
});

test('local-media: fileUrlToPath strips file scheme', async t => {
	const {fileUrlToPath} = await import('../source/utils/local-media.ts');
	t.is(fileUrlToPath('file:///home/user/song.mp3'), '/home/user/song.mp3');
	t.is(fileUrlToPath('/already/plain.mp3'), '/already/plain.mp3');
});
