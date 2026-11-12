/* Pure source adapters shared by the app and fixture tests. */
(function (scope) {
  const ROM =
    /\.(nes|fds|sfc|smc|gba|gb|gbc|md|gen|smd|bin|nds|3ds|cci|cxi|3dsx|iso|cso|chd|pbp|cue|zip|7z|z64|n64|v64|gg|sms|32x|rvz|gcm|wbfs|pce|a26|lnx|ngp|ngc|ws|wsc)$/i;
  const encodePath = (path) =>
    path.split('/').map(encodeURIComponent).join('/');
  function directOnly(entries, blocked = new Set()) {
    return entries.filter((e) => {
      if (
        e.kind !== 'direct' ||
        [true, 'true', 1, '1'].includes(e.private) ||
        e.requiresLogin ||
        blocked.has(e.url) ||
        !ROM.test(e.name || '') ||
        e.name.length > 230 ||
        /[\/\\\u0000-\u001f]/.test(e.name)
      )
        return false;
      try {
        return new URL(e.url).protocol === 'https:';
      } catch {
        return false;
      }
    });
  }
  function edge(doc, base) {
    return [...doc.querySelectorAll('details[data-name]')]
      .map((row) => {
        const a = row.querySelector('a[href^="/download/"]');
        if (!a) return null;
        const url = new URL(a.getAttribute('href'), base);
        if (url.hostname !== 'edgeemu.net' || url.protocol !== 'https:')
          return null;
        return {
          name: row.getAttribute('data-name'),
          url: url.href,
          kind: 'direct',
          provider: 'edge',
          sizeText:
            row.querySelector('span')?.textContent.split(',')[0].trim() || ''
        };
      })
      .filter(Boolean)
      .filter((e) => ROM.test(e.name));
  }
  function edgePages(doc, base) {
    return [
      ...new Set(
        [...doc.querySelectorAll('select[name="letter"] option[value]')]
          .map((o) => new URL(o.value, base))
          .filter(
            (u) =>
              u.protocol === 'https:' &&
              u.hostname === 'edgeemu.net' &&
              /^\/browse\/[^/]+\/[1a-z]$/.test(u.pathname)
          )
          .map((u) => u.href)
      )
    ].slice(0, 27);
  }
  const platformFor = (title) => {
    const s = title.toLowerCase();
    const rules = [
      ['gba', /game\s?boy advance|gba/],
      ['gbc', /game\s?boy color/],
      ['gb', /game\s?boy(?! advance| color)/],
      ['snes', /super nintendo|snes|super famicom/],
      ['nes', /nintendo entertainment|\bnes\b|famicom|family computer/],
      ['3ds', /3ds/],
      ['nds', /nintendo ds|\bnds\b/],
      ['n64', /nintendo 64|\bn64\b/],
      ['ps2', /playstation 2|\bps2\b/],
      ['psp', /playstation portable|\bpsp\b/],
      ['psx', /playstation(?! 3| 4| 5| vita)/],
      ['md', /mega drive|genesis/],
      ['gg', /game gear/],
      ['sms', /master system|mark iii/],
      ['32x', /32x/],
      ['dreamcast', /dreamcast/],
      ['saturn', /saturn/],
      ['segacd', /sega cd|mega.?cd/],
      ['gamecube', /gamecube/],
      ['wii', /nintendo wii(?! u)/],
      ['pce', /pc engine|turbografx/],
      ['arcade', /arcade|fbneo|mame/],
      ['atari2600', /atari.*2600/],
      ['lynx', /lynx/],
      ['ngp', /neo.?geo pocket/],
      ['wonderswan', /wonderswan/]
    ];
    return rules.find(([, re]) => re.test(s))?.[0] || '';
  };
  function archiveTarget(value) {
    const u = new URL(value);
    if (u.hostname !== 'archive.org' && !u.hostname.endsWith('.archive.org'))
      return null;
    const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (!['details', 'download'].includes(parts[0]) || !parts[1]) return null;
    return {
      id: parts[1],
      path: parts.slice(2).join('/'),
      zip: /\.zip\/$/i.test(u.pathname)
    };
  }
  function archiveFiles(metadata, id) {
    return (metadata.files || [])
      .filter((f) => ROM.test(f.name || ''))
      .map((f) => ({
        name: f.name.split('/').pop(),
        url:
          'https://archive.org/download/' +
          encodeURIComponent(id) +
          '/' +
          encodePath(f.name),
        size: Number(f.size) || 0,
        kind: 'direct',
        private: f.private === 'true' || f.private === true,
        md5: f.md5 || '',
        sha1: f.sha1 || ''
      }));
  }
  function archiveDirectory(metadata, id, path = '') {
    let files = archiveFiles(metadata, id);
    if (path) {
      const prefix = '/download/' + id + '/' + path;
      const exact = files.filter(
        (e) => decodeURIComponent(new URL(e.url).pathname) === prefix
      );
      if (exact.length) files = exact;
      else if (path.includes('.zip/') && ROM.test(path))
        files = [
          {
            name: path.split('/').pop(),
            url:
              'https://archive.org/download/' +
              encodeURIComponent(id) +
              '/' +
              encodePath(path),
            kind: 'direct',
            size: 0
          }
        ];
      else if (path.endsWith('/'))
        files = files.filter((e) =>
          decodeURIComponent(new URL(e.url).pathname).startsWith(prefix)
        );
      else files = [];
    }
    return files.map((e) =>
      e.size > 256 * 1048576 &&
      /\.zip$/i.test(e.name) &&
      (/collection|no.?intro|roms|full.?set/i.test(e.name) || files.length <= 2)
        ? {
            ...e,
            kind: 'folder',
            url: e.url + '/',
            sizeText: '打开合集内的游戏列表'
          }
        : e
    );
  }
  function minerva(doc, base) {
    return [...doc.querySelectorAll('.entry')]
      .map((row) => {
        const a = row.querySelector('a[href]');
        if (!a || a.textContent.trim() === '../') return null;
        const url = new URL(a.getAttribute('href'), base).href;
        return {
          name: a.textContent.trim(),
          url,
          sizeText: row.querySelector('span')?.textContent.trim() || '',
          kind: url.includes('/rom?') ? 'minerva' : 'folder'
        };
      })
      .filter(Boolean);
  }
  function directory(doc, base) {
    const seen = new Set();
    return [...doc.querySelectorAll('a[href]')]
      .map((a) => {
        const raw = a.getAttribute('href');
        if (!raw || raw.startsWith('#') || raw.startsWith('javascript:'))
          return null;
        let url;
        try {
          url = new URL(raw, base);
        } catch {
          return null;
        }
        if (url.protocol !== 'https:') return null;
        const name = a.textContent.trim();
        if (
          !name ||
          /^(\.\.\/?|parent directory|go to parent)/i.test(name) ||
          seen.has(url.href)
        )
          return null;
        seen.add(url.href);
        let decoded;
        try {
          decoded = decodeURIComponent(url.pathname);
        } catch {
          return null;
        }
        if (ROM.test(name) || ROM.test(decoded))
          return {
            name: ROM.test(name) ? name : decoded.split('/').pop(),
            url: url.href,
            kind: 'direct',
            sizeText: ''
          };
        if (/\.zip\/$/i.test(decoded))
          return { name, url: url.href, kind: 'folder', sizeText: '合集目录' };
        return null;
      })
      .filter(Boolean);
  }
  function sourceRows(doc, base) {
    return [...doc.querySelectorAll('tr')]
      .map((row) => {
        const first = row.querySelector('td');
        if (!first) return null;
        const links = [...row.querySelectorAll('a[href]')]
          .map((a) => ({
            label: a.textContent.trim(),
            url: new URL(a.getAttribute('href'), base).href
          }))
          .filter(
            (x) =>
              x.url.startsWith('https:') &&
              !x.url.startsWith('https://r-roms.github.io/')
          );
        return links.length ? { title: first.textContent.trim(), links } : null;
      })
      .filter(Boolean);
  }
  const api = {
    ROM,
    directOnly,
    edge,
    edgePages,
    encodePath,
    platformFor,
    archiveTarget,
    archiveFiles,
    archiveDirectory,
    minerva,
    directory,
    sourceRows
  };
  if (typeof module !== 'undefined') module.exports = api;
  scope.Catalog = api;
})(globalThis);
