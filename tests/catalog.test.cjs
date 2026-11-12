const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/catalog.js');

test('default catalog excludes login/private links, BT entries, whole folders and blocked files', () => {
  const direct = {
    name: 'Game.zip',
    url: 'https://edgeemu.net/download/test/Game.zip',
    kind: 'direct'
  };
  const rows = [
    direct,
    { ...direct, private: true },
    { ...direct, private: 'true' },
    { ...direct, requiresLogin: true },
    { ...direct, kind: 'minerva' },
    { ...direct, kind: 'folder' },
    { ...direct, url: 'http://example.com/Game.zip' },
    { ...direct, name: 'App.apk' },
    { ...direct, name: '../Game.zip' },
    { ...direct, url: 'https://example.com/blocked.zip' }
  ];
  assert.deepEqual(
    C.directOnly(rows, new Set(['https://example.com/blocked.zip'])),
    [direct]
  );
});

test('whole-platform ZIPs are browsed, and source links to one file do not fetch binary ROMs as HTML', () => {
  const metadata = {
    files: [
      { name: 'sets/GBA.zip', size: '14000000000' },
      { name: 'Other.gba', size: '1000' }
    ]
  };
  const pack = C.archiveDirectory(metadata, 'example', 'sets/GBA.zip');
  assert.equal(pack.length, 1);
  assert.equal(pack[0].kind, 'folder');
  assert.ok(pack[0].url.endsWith('/GBA.zip/'));
  const single = C.archiveDirectory(metadata, 'example', 'Other.gba');
  assert.equal(single.length, 1);
  assert.equal(single[0].kind, 'direct');
  const nested = C.archiveDirectory(
    metadata,
    'example',
    'sets/GBA.zip/One Game.gba'
  );
  assert.equal(nested.length, 1);
  assert.equal(nested[0].name, 'One Game.gba');
  assert.equal(
    C.archiveDirectory(metadata, 'example', 'missing.gba').length,
    0
  );
});

test('platform mapping keeps similar Nintendo and Sony systems separate', () => {
  for (const [name, folder] of [
    ['Nintendo - Game Boy Advance', 'gba'],
    ['Nintendo - Game Boy Color', 'gbc'],
    ['Nintendo - Game Boy', 'gb'],
    ['Nintendo - Super Nintendo Entertainment System', 'snes'],
    ['Nintendo - Nintendo Entertainment System (Headered)', 'nes'],
    ['Sony Playstation 2', 'ps2'],
    ['Sony Playstation Portable', 'psp'],
    ['Sony Playstation', 'psx'],
    ['Sony Playstation 3', ''],
    ['Sega - Mega Drive - Genesis', 'md'],
    ['Nintendo Wii U', ''],
    ['Nintendo Wii', 'wii']
  ])
    assert.equal(C.platformFor(name), folder, name);
});

test('Archive parsing preserves nested paths and URL-encodes game filenames', () => {
  const files = C.archiveFiles(
    {
      files: [
        { name: 'roms/A & B (USA).zip', size: '1234', private: 'true' },
        { name: 'collection_files.xml' },
        { name: 'pack_archive.torrent' },
        { name: 'cover.jpg' }
      ]
    },
    'sample-set'
  );
  assert.equal(files.length, 1);
  assert.equal(
    files[0].url,
    'https://archive.org/download/sample-set/roms/A%20%26%20B%20(USA).zip'
  );
  assert.equal(files[0].size, 1234);
  assert.equal(files[0].private, true);
});

test('Archive collection directories remain navigable and external hosts do not become Archive items', () => {
  assert.deepEqual(
    C.archiveTarget('https://archive.org/download/item/roms/Big%20Set.zip/'),
    { id: 'item', path: 'roms/Big Set.zip', zip: true }
  );
  assert.equal(
    C.archiveTarget('https://archive.org.evil.invalid/details/item'),
    null
  );
  assert.equal(C.archiveTarget('https://example.org/download/item'), null);
});

test('only ROM and supported archive extensions enter the download list', () => {
  for (const good of [
    'A.nes',
    'A.sfc',
    'A.GBA',
    'A.md',
    'A.3ds',
    'A.iso',
    'A.chd',
    'A.zip',
    'A.7z'
  ])
    assert.ok(C.ROM.test(good));
  for (const bad of [
    'setup.apk',
    'run.exe',
    'game.zip.html',
    'game.torrent',
    'keys.txt'
  ])
    assert.ok(!C.ROM.test(bad));
});
