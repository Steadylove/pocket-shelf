'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
const native = window.Pocket;
const paths = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  gamepad:
    '<path d="M8 7h8c4 0 7 11 4 12-2 1-4-4-5-4H9c-1 0-3 5-5 4C1 18 4 7 8 7Z"/><path d="M8 9v5m-2-2h4m6-1h.1m2 2h.1"/>',
  settings:
    '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3zM3 6V4h7l2 2h9v3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  refresh: '<path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
  pause: '<path d="M8 4v16M16 4v16"/>'
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.gamepad}</svg>`;
function icons(root = document) {
  $$('[data-icon]', root).forEach(
    (el) => (el.innerHTML = icon(el.dataset.icon))
  );
}
const PLATFORMS = [
  {
    id: 'nes',
    name: '红白机',
    sub: 'Nintendo Famicom / NES',
    code: 'FC',
    match: 'Nintendo - Nintendo Entertainment System (Headered)',
    color: '#ffaba6',
    bg: '#3b242c',
    line: '#61404b'
  },
  {
    id: 'snes',
    name: '超级任天堂',
    sub: 'Super Nintendo / Super Famicom',
    code: 'SFC',
    match: 'Nintendo - Super Nintendo Entertainment System',
    color: '#c8b4ff',
    bg: '#2c2542',
    line: '#504264'
  },
  {
    id: 'gba',
    name: 'Game Boy Advance',
    sub: 'Nintendo 掌机',
    code: 'GBA',
    match: 'Nintendo - Game Boy Advance',
    color: '#c3f38b',
    bg: '#283b2b',
    line: '#425b40'
  },
  {
    id: 'md',
    name: '世嘉 Mega Drive',
    sub: 'SEGA Genesis / 16-BIT',
    code: 'MD',
    match: 'Sega - Mega Drive - Genesis',
    color: '#80dce7',
    bg: '#1b3541',
    line: '#335765'
  },
  { id: 'gb', name: 'Game Boy', code: 'GB', match: 'Nintendo - Game Boy' },
  {
    id: 'gbc',
    name: 'Game Boy Color',
    code: 'GBC',
    match: 'Nintendo - Game Boy Color'
  },
  { id: 'nds', name: 'Nintendo DS', code: 'NDS', page: 'Nintendo DS' },
  { id: '3ds', name: 'Nintendo 3DS', code: '3DS', page: 'Nintendo 3DS' },
  { id: 'ps2', name: 'PlayStation 2', code: 'PS2', page: 'Sony Playstation 2' },
  {
    id: 'psp',
    name: 'PlayStation Portable',
    code: 'PSP',
    page: 'Sony Playstation Portable'
  },
  { id: 'psx', name: 'PlayStation', code: 'PS1', page: 'Sony Playstation' },
  {
    id: 'n64',
    name: 'Nintendo 64',
    code: 'N64',
    match: 'Nintendo - Nintendo 64 (BigEndian)'
  },
  { id: 'gg', name: 'Game Gear', code: 'GG', match: 'Sega - Game Gear' },
  {
    id: 'sms',
    name: 'Master System',
    code: 'SMS',
    match: 'Sega - Master System - Mark III'
  },
  { id: '32x', name: 'SEGA 32X', code: '32X', match: 'Sega - 32X' },
  { id: 'dreamcast', name: 'Dreamcast', code: 'DC', page: 'Sega Dreamcast' },
  { id: 'saturn', name: 'SEGA Saturn', code: 'SATURN', page: 'Sega Saturn' },
  { id: 'segacd', name: 'SEGA CD', code: 'SEGA CD', page: 'Sega CD' },
  { id: 'gamecube', name: 'GameCube', code: 'GC', page: 'Nintendo GameCube' },
  { id: 'wii', name: 'Nintendo Wii', code: 'WII', page: 'Nintendo Wii' },
  { id: 'pce', name: 'PC Engine', code: 'PCE' },
  { id: 'arcade', name: '街机', code: 'ARCADE', page: 'Arcade' },
  { id: 'atari2600', name: 'Atari 2600', code: '2600' },
  { id: 'lynx', name: 'Atari Lynx', code: 'LYNX' },
  { id: 'ngp', name: 'Neo Geo Pocket', code: 'NGP' },
  { id: 'wonderswan', name: 'WonderSwan', code: 'WS' }
];
const ALIASES = {
  魂斗罗: 'contra',
  马里奥: 'mario',
  玛丽: 'mario',
  超级玛丽: 'super mario',
  宝可梦: 'pokemon',
  口袋妖怪: 'pokemon',
  精灵宝可梦: 'pokemon',
  塞尔达: 'zelda',
  恶魔城: 'castlevania',
  索尼克: 'sonic',
  洛克人: 'mega man|rockman',
  火焰纹章: 'fire emblem',
  火纹: 'fire emblem',
  银河战士: 'metroid',
  星之卡比: 'kirby',
  卡比: 'kirby',
  最终幻想: 'final fantasy',
  黄金太阳: 'golden sun',
  逆转裁判: 'gyakuten saiban',
  合金弹头: 'metal slug',
  街霸: 'street fighter',
  街头霸王: 'street fighter',
  忍者龙剑传: 'ninja gaiden|ninja ryukenden',
  双截龙: 'double dragon',
  热血: 'kunio|nekketsu',
  战斧: 'golden axe',
  怒之铁拳: 'streets of rage|bare knuckle',
  梦幻之星: 'phantasy star',
  勇者斗恶龙: 'dragon quest|dragon warrior',
  重装机兵: 'metal max'
};
let seed = { providers: [], platforms: [], directories: {} };
let state = { root: '', tasks: [] },
  library = [];
let route = 'home',
  selectedPlatform = 'gba',
  current = null,
  entries = [],
  filtered = [],
  shown = 60,
  region = '',
  query = '',
  browseVersion = 0;
let stack = [],
  lastTaskSnapshot = '',
  pendingDownload = null;
const pending = new Map();
let seq = 0;
function request(method, arg, name) {
  return new Promise((resolve, reject) => {
    const id = String(++seq);
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('连接超时，请稍后重试'));
    }, 55000);
    pending.set(id, { resolve, reject, timer });
    if (method === 'library') native.library(id);
    else if (method === 'probe') native.probe(id, arg, name);
    else native.fetch(id, arg);
  });
}
window.nativeResult = (id, ok, result) => {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
  if (ok) p.resolve(result);
  else p.reject(new Error(result));
};
const get = (url) => request('fetch', url);
const checking = new Set();
const verified = new Map();
let unavailable = {};
try {
  unavailable = JSON.parse(localStorage.getItem('unavailable-direct') || '{}');
} catch {}
function blockedFiles() {
  return new Set(
    Object.keys(unavailable).filter((url) => unavailable[url] > Date.now())
  );
}
function visibleFiles(list) {
  return Catalog.directOnly(list, blockedFiles());
}
function availablePlatforms() {
  return PLATFORMS.filter((p) =>
    seed.platforms.some((r) => r.platform === p.id)
  );
}
function platformSources(id) {
  return seed.platforms.filter((r) => r.platform === id);
}

function showToast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(
    () => $('#toast').classList.remove('visible'),
    4200
  );
}
window.showToast = showToast;
const bytes = (n) =>
  n >= 1073741824
    ? (n / 1073741824).toFixed(2) + ' GB'
    : n >= 1048576
      ? (n / 1048576).toFixed(1) + ' MB'
      : n >= 1024
        ? (n / 1024).toFixed(1) + ' KB'
        : n + ' B';
const platform = (id) =>
  PLATFORMS.find((p) => p.id === id) || {
    id,
    code: id.toUpperCase(),
    name: id
  };
function main(html, preserveScroll = false) {
  const panel = $('#main');
  const previousScroll = panel.scrollTop;
  panel.innerHTML = html;
  icons(panel);
  panel.scrollTop = preserveScroll ? previousScroll : 0;
}
function selectNav(value) {
  const selected =
    value === 'browse' ? 'home' : value === 'sourcePage' ? 'sources' : value;
  $$('#rail [data-nav]').forEach((b) => {
    const active = b.dataset.nav === selected;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#headerTitle').textContent =
    {
      home: '发现游戏',
      browse: '游戏目录',
      sources: '可用来源',
      sourcePage: '来源目录',
      downloads: '下载任务',
      library: '本地游戏',
      settings: '连接设置'
    }[value] || '口袋游戏库';
}
function navigate(value) {
  route = value;
  browseVersion++;
  stack = [];
  selectNav(value);
  $('#main').scrollTop = 0;
  if (value === 'home') home();
  if (value === 'sources') sources();
  if (value === 'downloads') transfers();
  if (value === 'library') {
    renderLibrary();
    refreshLibrary();
  }
  if (value === 'settings') settings();
}
function home() {
  const total = Object.values(seed.directories).reduce(
    (n, a) => n + visibleFiles(a).length,
    0
  );
  main(`
    <section class="home-intro">
      <div><h1>游戏目录</h1><p>按平台浏览与下载。</p></div>
      <button class="primary" id="browseHero">浏览游戏库 ${icon('arrow')}</button>
    </section>
    <div class="section-head"><h2>常用平台</h2><span class="section-meta">${total.toLocaleString()} 个版本条目</span></div>
    <section class="platform-grid" aria-label="常用游戏平台">${PLATFORMS.slice(
      0,
      4
    )
      .map((p) => {
        const url = platformSources(p.id)[0]?.url;
        const count = seed.directories[url]?.length;
        return `<button class="platform-card" data-platform="${p.id}">
        <span class="platform-top"><span class="code">${p.code}</span>${icon('arrow')}</span>
        <span class="platform-name">${esc(p.name)}</span>
        <span class="platform-description">${esc(p.sub)}</span>
        <span class="count">${count ? count.toLocaleString() + ' 个条目' : '在线目录'}</span>
      </button>`;
      })
      .join('')}</section>
    <div class="section-head secondary-head"><h2>更多平台</h2><button class="text-button" data-action="allSources">可用来源 ${icon('arrow')}</button></div>
    <div class="mini-platforms">${availablePlatforms()
      .filter((p) => !PLATFORMS.slice(0, 4).includes(p))
      .map(
        (p) =>
          `<button data-platform="${p.id}">${p.code}<span>${esc(p.name)}</span>${icon('arrow')}</button>`
      )
      .join('')}</div>
    <section class="connection-card">
      <div class="connection-symbol">${icon('folder')}</div>
      <div><h3>${state.root ? '游戏目录已连接' : '连接游戏目录'}</h3><p>${state.root ? 'ROMs · 下载后按平台自动归类' : '选择与 Omnidroid 共用的 ROMs 文件夹'}</p></div>
      <button id="connectHome" class="subtle">${state.root ? '本地游戏' : '连接目录'} ${icon('arrow')}</button>
    </section>
    <p class="source-note">已筛选免登录直链目录 · 下载前自动检测文件</p>`);
  $('#browseHero').onclick = () => openPlatform('gba');
  $$('[data-platform]').forEach(
    (b) => (b.onclick = () => openPlatform(b.dataset.platform))
  );
  $('[data-action="allSources"]').onclick = () => navigate('sources');
  $('#connectHome').onclick = () =>
    state.root ? navigate('library') : native.chooseFolder();
}
function openPlatform(id, provider) {
  selectedPlatform = id;
  stack = [];
  const choices = platformSources(id);
  const choice = choices.find((r) => r.provider === provider) || choices[0];
  if (!choice) {
    showToast('这个平台暂未收录免登录直链');
    return;
  }
  browse({ ...choice, title: platform(id).name, alternatives: choices });
}
function topLine(extra = '') {
  return `<div class="topline"><button class="back" id="backCatalog" aria-label="返回上级">${icon('back')}</button><span class="pill">${esc(platform(selectedPlatform).code)}</span><span class="pill">ROMs / ${esc(selectedPlatform)}</span><div class="spacer"></div>${extra}</div>`;
}
function sourceName(url) {
  const host = new URL(url).hostname;
  return host === 'edgeemu.net'
    ? 'Edge Emulation · 免登录直链'
    : host === 'buildbot.libretro.com'
      ? 'Libretro · 公共内容直链'
      : host;
}
async function loadEdge(target, version) {
  const doc = new DOMParser().parseFromString(
    await get(target.url),
    'text/html'
  );
  const pages = Catalog.edgePages(doc, target.url);
  if (!pages.length) return Catalog.edge(doc, target.url);
  let next = 0,
    finished = 0,
    failures = 0;
  const all = [];
  async function worker() {
    while (next < pages.length && version === browseVersion) {
      const url = pages[next++];
      try {
        const html = await get(url);
        all.push(
          ...Catalog.edge(
            new DOMParser().parseFromString(html, 'text/html'),
            url
          )
        );
      } catch {
        failures++;
      }
      finished++;
      if (version === browseVersion && $('#catalogInfo'))
        $('#catalogInfo').textContent =
          `读取免登录目录 ${finished} / ${pages.length}`;
    }
  }
  await Promise.all([worker(), worker()]);
  if (failures === pages.length)
    throw new Error('目录暂时无法连接，请稍后重试');
  if (failures && version === browseVersion)
    showToast(`${failures} 个分页未能读取，先显示已取得的目录`);
  return [...new Map(all.map((e) => [e.url, e])).values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
function browseHeader() {
  main(
    `${topLine(`<button id="sourceOptions" class="subtle">下载来源</button>`)}<div class="catalog-head"><div><span class="eyebrow source-badge">${esc(sourceName(current.url))}</span><h1>${esc(current.title || platform(selectedPlatform).name)}</h1><p id="catalogInfo">正在读取在线目录…</p></div><button id="refreshCatalog" class="subtle" aria-label="刷新游戏目录">${icon('refresh')}</button></div><label class="searchbar">${icon('search')}<input id="gameSearch" type="search" aria-label="搜索当前游戏目录" placeholder="搜索游戏，支持魂斗罗、宝可梦等常见中文名" value="${esc(query)}"></label><div class="filters" id="regionFilters">${[
      ['', '全部地区'],
      ['USA', '美版'],
      ['Japan', '日版'],
      ['Europe', '欧版'],
      ['China|Taiwan|Zh', '中文地区']
    ]
      .map(
        ([r, label]) =>
          `<button data-region="${r}" class="${region === r ? 'selected' : ''}">${label}</button>`
      )
      .join(
        ''
      )}<span class="result-count" id="resultCount"></span></div><div id="games"><div class="loading"><span class="spinner"></span>正在读取目录</div></div><div class="list-footer" id="listFooter"></div>`
  );
  $('#backCatalog').onclick = goBack;
  $('#sourceOptions').onclick = sourceOptions;
  $('#refreshCatalog').onclick = () => browse(current, true, true);
  $('#gameSearch').oninput = (e) => {
    query = e.target.value;
    shown = 60;
    filterGames();
  };
  $$('[data-region]').forEach(
    (b) =>
      (b.onclick = () => {
        region = b.dataset.region;
        shown = 60;
        $$('[data-region]').forEach((x) =>
          x.classList.toggle('selected', x === b)
        );
        filterGames();
      })
  );
}
async function browse(target, force = false, keep = false) {
  const version = ++browseVersion;
  if (!keep) {
    if (current && route === 'browse')
      stack.push({ current, query, region, shown });
    query = '';
    region = '';
    shown = 60;
  }
  current = target;
  entries = [];
  selectedPlatform = target.platform || selectedPlatform;
  route = 'browse';
  selectNav(route);
  browseHeader();
  const cached = seed.directories[target.url];
  if (force) {
    for (const entry of cached || []) {
      delete unavailable[entry.url];
      verified.delete(entry.url);
    }
    try {
      localStorage.setItem('unavailable-direct', JSON.stringify(unavailable));
    } catch {}
  }
  if (cached && !force) {
    entries = visibleFiles(cached);
    filterGames();
    $('#catalogInfo').textContent =
      `免登录目录 · ${entries.length.toLocaleString()} 个条目 · 下载前自动检测`;
    return;
  }
  try {
    let result;
    if (target.provider === 'edge') result = await loadEdge(target, version);
    else {
      const text = await get(target.url);
      result = Catalog.directory(
        new DOMParser().parseFromString(text, 'text/html'),
        target.url
      ).map((e) => ({ ...e, provider: target.provider }));
    }
    if (version !== browseVersion) return;
    if (!result.length)
      throw new Error(
        '这个目录暂时没有可直接下载的文件，请稍后重试或选择另一个来源。'
      );
    entries = visibleFiles(result);
    seed.directories[target.url] = entries;
    filterGames();
    $('#catalogInfo').textContent =
      `已更新免登录目录 · ${entries.length.toLocaleString()} 个条目 · 下载前自动检测`;
  } catch (e) {
    if (version !== browseVersion) return;
    $('#catalogInfo').textContent = '目录暂时不可用';
    $('#games').innerHTML =
      `<div class="empty"><h3>这个来源暂时没有连上</h3><p>${esc(e.message)}</p><button id="retryCatalog" class="primary">重试</button> <button id="chooseOtherSource">选择其他来源</button>${cached ? '<br><button id="cachedCatalog">使用已有目录快照</button>' : ''}</div>`;
    $('#retryCatalog').onclick = () => browse(target, true, true);
    $('#chooseOtherSource').onclick = sourceOptions;
    if ($('#cachedCatalog'))
      $('#cachedCatalog').onclick = () => {
        entries = visibleFiles(cached);
        filterGames();
        $('#catalogInfo').textContent = '已使用目录快照 ' + seed.updated;
      };
  }
}
function filterGames() {
  const terms = (ALIASES[query.trim()] || query.trim())
    .toLowerCase()
    .split('|')
    .filter(Boolean);
  filtered = entries.filter(
    (e) =>
      (!terms.length || terms.some((q) => e.name.toLowerCase().includes(q))) &&
      (!region || new RegExp(region, 'i').test(e.name))
  );
  $('#resultCount').textContent = filtered.length.toLocaleString() + ' 个结果';
  renderGames();
}
function titleOf(name) {
  return name
    .replace(
      /\.(zip|7z|nes|sfc|smc|gba|gb|gbc|md|gen|bin|nds|3ds|iso|chd|rvz)$/i,
      ''
    )
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
}
function renderGames() {
  const visible = filtered.slice(0, shown);
  if (!visible.length) {
    $('#games').innerHTML = entries.length
      ? '<div class="empty"><h3>没有匹配的游戏</h3><p>试试英文名称，或切换地区与来源。</p></div>'
      : '<div class="empty"><h3>暂无可用直链</h3><p>失效或受限链接已隐藏，可选择其他来源，或稍后刷新重试。</p></div>';
    $('#listFooter').innerHTML = '';
    return;
  }
  $('#games').innerHTML = `<div class="game-list">${visible
    .map((e, i) => {
      const folder = e.kind === 'folder';
      const tags = [...e.name.matchAll(/\(([^)]+)\)/g)].map((x) => x[1]);
      const done = state.tasks.some(
        (t) => t.url === e.url && t.status === 'done'
      );
      const isChecking = checking.has(e.url);
      const active = state.tasks.some(
        (t) =>
          t.url === e.url &&
          ['queued', 'downloading', 'importing'].includes(t.status)
      );
      return `<article class="game-row"><div class="game-tile" style="--tile:${platform(selectedPlatform).bg || '#264657'}">${folder ? icon('folder') : esc(titleOf(e.name).slice(0, 2).toUpperCase())}</div><div class="game-info"><a href="#detail" class="game-title" data-detail="${i}">${esc(titleOf(e.name))}</a><div class="game-meta"><span>${esc(tags[0] || platform(selectedPlatform).code)}</span>${e.size || e.sizeText ? `<span>${esc(e.size ? bytes(e.size) : e.sizeText)}</span>` : ''}<span>${verified.has(e.url) ? '已检测直链' : '免登录直链'}</span></div></div><button class="download-button" data-download="${i}" ${active || isChecking ? 'disabled' : ''}>${icon(folder ? 'arrow' : done ? 'check' : 'download')}${isChecking ? '检测中' : done ? '已导入' : active ? '下载中' : '下载'}</button></article>`;
    })
    .join('')}</div>`;
  $$('[data-download]').forEach(
    (b) =>
      (b.onclick = () => {
        const e = visible[Number(b.dataset.download)];
        if (e.kind === 'folder')
          browse({ ...current, url: e.url, title: titleOf(e.name) });
        else enqueue(e);
      })
  );
  $$('[data-detail]').forEach(
    (b) =>
      (b.onclick = (event) => {
        event.preventDefault();
        detail(visible[Number(b.dataset.detail)]);
      })
  );
  $('#listFooter').innerHTML =
    `<div>已显示 ${visible.length.toLocaleString()} / ${filtered.length.toLocaleString()} 个条目</div>${shown < filtered.length ? '<button id="loadMore">继续加载 60 个</button>' : ''}`;
  if ($('#loadMore'))
    $('#loadMore').onclick = () => {
      shown += 60;
      renderGames();
    };
}
function modal(html) {
  $('#modalBody').innerHTML = html;
  icons($('#modalBody'));
  if (!$('#modal').open) $('#modal').showModal();
}
function closeModal() {
  $('#modal').close();
}
function detail(e) {
  if (e.kind === 'folder') {
    browse({ ...current, url: e.url, title: titleOf(e.name) });
    return;
  }
  modal(
    `<span class="eyebrow">${esc(platform(selectedPlatform).code)} / GAME FILE</span><h2>${esc(titleOf(e.name))}</h2><div class="detail">${esc(e.name)}<br>${esc(e.size ? bytes(e.size) : e.sizeText || '')}<br>保存到：ROMs/${esc(selectedPlatform)}<br>来源：${esc(sourceName(e.url))}</div><p>下载前会检查实际文件。完成后自动导入对应平台目录，由 Omnidroid 识别。</p><div class="actions"><button class="primary" id="detailDownload">${icon('download')}下载并导入</button></div>`
  );
  $('#detailDownload').onclick = () => {
    closeModal();
    enqueue(e);
  };
}
async function enqueue(entry) {
  if (!Catalog.directOnly([entry]).length) {
    showToast('此链接不支持免登录直链下载');
    return;
  }
  if (!selectedPlatform) {
    showToast('请先选择目标平台');
    return;
  }
  if (!state.root) {
    pendingDownload = { ...entry, platform: selectedPlatform };
    modal(
      '<h2>连接现有的游戏目录</h2><p>选择手机内部存储中的 <strong>ROMs</strong> 文件夹，与 Omnidroid 使用同一目录。只需连接一次。</p><div class="actions"><button class="primary" id="connectDownload">选择 ROMs 文件夹</button></div>'
    );
    $('#connectDownload').onclick = () => {
      closeModal();
      native.chooseFolder();
    };
    return;
  }
  if (checking.has(entry.url)) return;
  checking.add(entry.url);
  if (route === 'browse' && $('#games')) renderGames();
  try {
    let check = verified.get(entry.url);
    if (!check || check.expires < Date.now()) {
      check = JSON.parse(await request('probe', entry.url, entry.name));
      if (!check.available) {
        if (check.block) {
          unavailable[entry.url] = Date.now() + 6 * 60 * 60 * 1000;
          try {
            localStorage.setItem(
              'unavailable-direct',
              JSON.stringify(unavailable)
            );
          } catch {}
          entries = visibleFiles(entries);
          if (route === 'browse' && $('#games')) filterGames();
          showToast('该链接当前不能直接下载，已从目录隐藏');
        } else showToast(check.reason || '连接检查失败，请稍后重试');
        return;
      }
      check.expires = Date.now() + 5 * 60 * 1000;
      verified.set(entry.url, check);
    }
    native.download(
      JSON.stringify({
        ...entry,
        size: check.size || entry.size || 0,
        kind: 'direct',
        platform: entry.platform || selectedPlatform
      })
    );
    setTimeout(poll, 250);
  } catch (e) {
    showToast(e.message || '连接检查失败，请稍后重试');
  } finally {
    checking.delete(entry.url);
    if (route === 'browse' && $('#games')) renderGames();
  }
}

function sourceOptions() {
  const choices = platformSources(selectedPlatform);
  modal(
    `<h2>下载来源</h2><p>仅列出已筛选的免登录直链目录。每个文件会在下载前单独检测。</p>${choices.map((x, i) => `<button class="source-card" data-alt="${i}">${icon('globe')}<div><h3>${esc(sourceName(x.url))}</h3><small>${x.provider === 'edge' ? '经典主机游戏目录' : '公共游戏与演示内容'}</small></div>${icon('arrow')}</button>`).join('')}`
  );
  $$('[data-alt]').forEach(
    (b) =>
      (b.onclick = () => {
        const choice = choices[Number(b.dataset.alt)];
        closeModal();
        openPlatform(selectedPlatform, choice.provider);
      })
  );
}
function sources() {
  main(
    `<div class="catalog-head"><div><h1>可用来源</h1><p>只保留免登录直链目录，文件在下载前自动检测。</p></div><button id="refreshSources" class="subtle">${icon('refresh')}检测</button></div><div class="section-head"><p id="sourceSummary">${seed.providers.length} 个精选来源 · 目录抽检 ${seed.updated}</p></div><div class="source-grid" id="sourceGrid"></div>`
  );
  function paint(q = '') {
    const providers = seed.providers.filter((p) =>
      (
        p.name +
        ' ' +
        p.description +
        ' ' +
        seed.platforms
          .filter((r) => r.provider === p.id)
          .map((r) => platform(r.platform).name)
          .join(' ')
      )
        .toLowerCase()
        .includes(q.toLowerCase())
    );
    $('#sourceGrid').innerHTML = providers
      .map(
        (p) =>
          `<button class="source-card" data-provider="${p.id}">${icon('globe')}<div><h3>${esc(p.name)}</h3><small>${esc(p.description)}</small><small id="provider-${p.id}">支持 ${seed.platforms.filter((r) => r.provider === p.id).length} 个平台 · 下载前检测</small></div>${icon('arrow')}</button>`
      )
      .join('');
    $$('[data-provider]').forEach(
      (b) =>
        (b.onclick = () =>
          sourcePage(seed.providers.find((p) => p.id === b.dataset.provider)))
    );
  }
  paint();
  $('#refreshSources').onclick = async () => {
    const button = $('#refreshSources');
    button.disabled = true;
    for (const provider of seed.providers) {
      const samples = (provider.checks || []).slice(0, 4);
      let ok = 0;
      await Promise.all(
        samples.map(async (sample) => {
          try {
            const name = decodeURIComponent(
              new URL(sample.url).pathname.split('/').pop()
            );
            const result = JSON.parse(await request('probe', sample.url, name));
            if (result.available) ok++;
          } catch {}
        })
      );
      const label = $(`#provider-${provider.id}`);
      if (label)
        label.textContent = samples.length
          ? `本次样本检测 ${ok} / ${samples.length} 可下载`
          : '下载时逐个检测';
    }
    if ($('#sourceSummary'))
      $('#sourceSummary').textContent =
        '检测完成 · 抽样结果不代表全部文件始终可用';
    button.disabled = false;
  };
}
function sourcePage(provider) {
  route = 'sourcePage';
  browseVersion++;
  selectNav(route);
  current = null;
  const rows = seed.platforms.filter((r) => r.provider === provider.id);
  main(
    `<div class="topline"><button class="back" id="sourceBack" aria-label="返回可用来源">${icon('back')}</button><span class="pill">免登录 HTTPS 直链</span></div><div class="catalog-head"><div><h1>${esc(provider.name)}</h1><p>${esc(provider.description)}</p></div></div><div class="source-grid">${rows.map((r) => `<button class="source-card" data-source-platform="${r.platform}">${icon('gamepad')}<div><h3>${esc(platform(r.platform).name)}</h3><small>${seed.directories[r.url] ? visibleFiles(seed.directories[r.url]).length.toLocaleString() + ' 个目录条目' : '在线读取目录'}</small></div>${icon('arrow')}</button>`).join('')}</div>`
  );
  $('#sourceBack').onclick = () => navigate('sources');
  $$('[data-source-platform]').forEach(
    (b) =>
      (b.onclick = () => openPlatform(b.dataset.sourcePlatform, provider.id))
  );
}
function transfers() {
  const active = state.tasks.filter((t) =>
    ['downloading', 'queued', 'importing'].includes(t.status)
  ).length;
  main(
    `<div class="catalog-head"><div><h1>下载任务</h1><p>${active} 个进行中 · 下载完成后自动导入对应平台目录</p></div></div><div id="transfers"></div>`
  );
  paintTransfers();
}
function paintTransfers() {
  if (!$('#transfers')) return;
  $('#transfers').innerHTML = state.tasks.length
    ? [...state.tasks]
        .reverse()
        .map(
          (t) =>
            `<article class="transfer"><div class="transfer-top"><div class="transfer-title"><h3>${esc(t.name)}</h3><p>${esc(platform(t.platform).code)} · ROMs/${esc(t.platform)} · ${t.kind === 'minerva' ? 'BT 单文件' : 'HTTPS 直链'}</p></div>${t.status === 'done' ? `<button class="primary compact" data-play="${esc(t.uri)}">${icon('play')}开玩</button>` : `<button data-task="${esc(t.id)}" data-command="${['paused', 'error'].includes(t.status) ? 'resume' : 'pause'}">${icon(['paused', 'error'].includes(t.status) ? 'play' : 'pause')}${['paused', 'error'].includes(t.status) ? '继续' : '暂停'}</button>`}</div><progress ${t.total > 0 ? `max="${t.total}" value="${t.downloaded}"` : t.status === 'done' ? 'max="1" value="1"' : ''}></progress><div class="transfer-meta"><span class="${t.status === 'error' ? 'error' : t.status === 'done' ? 'done-label' : ''}">${esc(t.message)}</span><span>${bytes(t.downloaded || 0)}${t.total ? ' / ' + bytes(t.total) : ''}</span></div></article>`
        )
        .join('')
    : `<div class="empty"><h3>暂无下载任务</h3><p>在游戏目录里点击“下载”，任务会出现在这里。</p><button id="emptyBrowse" class="primary">去发现游戏</button></div>`;
  $$('[data-task]').forEach(
    (b) =>
      (b.onclick = () => {
        native.task(b.dataset.task, b.dataset.command);
        setTimeout(poll, 200);
      })
  );
  $$('[data-play]').forEach(
    (b) => (b.onclick = () => native.play(b.dataset.play))
  );
  if ($('#emptyBrowse')) $('#emptyBrowse').onclick = () => navigate('home');
}
async function refreshLibrary() {
  try {
    state = JSON.parse(native.state());
    if (!state.root) return;
    library = JSON.parse(await request('library'));
    if (route === 'library') renderLibrary(true);
  } catch (e) {
    if (route === 'library') showToast(e.message);
  }
}
window.refreshLibrary = refreshLibrary;
function renderLibrary(preserveScroll = false) {
  main(
    `<div class="catalog-head"><div><h1>本地游戏</h1><p>${library.length} 个本地游戏 · 直接交给 Omnidroid 启动</p></div><button id="refreshLibrary" class="subtle" aria-label="刷新本地游戏">${icon('refresh')}</button></div>${!state.root ? '<div class="empty"><h3>先连接 ROMs 文件夹</h3><p>连接后可以看到手机里已有的游戏。</p><button class="primary" id="connectLibrary">选择 ROMs</button></div>' : library.length ? `<div class="library-grid">${library.map((e, i) => `<article class="game-row"><div class="game-tile">${esc(platform(e.platform).code)}</div><div class="game-info"><h3 class="game-title">${esc(titleOf(e.name))}</h3><div class="game-meta"><span>${esc(platform(e.platform).code)}</span><span>${bytes(e.size)}</span></div></div><button class="download-button" data-local="${i}">${icon('play')}开玩</button></article>`).join('')}</div>` : '<div class="empty"><h3>暂无本地游戏</h3><p>下载的游戏会放入 ROMs 的对应平台目录。</p></div>'}<div class="notice">${icon('info')}<div>下载后可在这里直接开玩。若要在 Omnidroid 的大厅显示新游戏，进入 Omnidroid 重新扫描 ROMs 文件夹。</div></div>`,
    preserveScroll
  );
  $('#refreshLibrary').onclick = refreshLibrary;
  if ($('#connectLibrary'))
    $('#connectLibrary').onclick = () => native.chooseFolder();
  $$('[data-local]').forEach(
    (b) => (b.onclick = () => native.play(library[Number(b.dataset.local)].uri))
  );
}
function settings() {
  main(
    `<section class="settings-block"><h2>与 Omnidroid 共用游戏库</h2><p>目录：<strong>${state.root ? '内部存储 / ROMs · 已连接' : '尚未连接'}</strong><br>只申请你选定文件夹的读写权限。通知只用于显示下载进度，拒绝通知不影响前台使用。</p><button class="primary" id="chooseFolder">${icon('folder')}${state.root ? '重新连接目录' : '连接 ROMs 文件夹'}</button><div class="mapping">${PLATFORMS.slice(
      0,
      12
    )
      .map((p) => `<span><b>${p.code}</b>ROMs/${p.id}</span>`)
      .join(
        ''
      )}</div></section><section class="settings-block"><h2>已有下载链接？</h2><p>粘贴实际 ROM、ZIP 或 7z 的 HTTPS 文件链接，选择平台后下载导入。仅支持实际游戏文件链接，下载前会自动检测。</p><label class="form-label" for="customUrl">游戏文件链接</label><div class="inline-form"><input id="customUrl" type="url" placeholder="https://…/game.gba" aria-label="游戏文件 HTTPS 链接"><select id="customPlatform" aria-label="目标平台">${PLATFORMS.map((p) => `<option value="${p.id}" ${p.id === 'gba' ? 'selected' : ''}>${p.code}</option>`).join('')}</select><button id="customDownload" class="primary">下载导入</button></div></section><section class="settings-block"><h2>来源与开源组件</h2><p>口袋游戏库 1.2 · 专为你的 Omnidroid 游戏目录制作。<br>默认来源：Edge Emulation / Libretro 公共内容<br>BT 内核：FrostWire jlibtorrent 2.0.15.3 / libtorrent<br>本工具不包含游戏本体、BIOS 或解密密钥，也不改变原站的访问限制。不同平台能否运行仍取决于 Omnidroid 内核与文件格式。</p><button id="aboutSource" class="subtle">来源说明</button> <button id="aboutEngine" class="subtle">BT 内核源码</button></section>`
  );
  $('#chooseFolder').onclick = () => native.chooseFolder();
  $('#aboutSource').onclick = () => navigate('sources');
  $('#aboutEngine').onclick = () =>
    native.openSite('https://github.com/frostwire/frostwire-jlibtorrent');
  $('#customDownload').onclick = () => {
    try {
      const url = new URL($('#customUrl').value.trim());
      let name = decodeURIComponent(url.pathname.split('/').pop());
      if (!Catalog.ROM.test(name))
        throw new Error('链接末尾应是游戏文件名，例如 game.gba 或 game.zip');
      selectedPlatform = $('#customPlatform').value;
      enqueue({ name, url: url.href, kind: 'direct' });
    } catch (e) {
      showToast(e.message || '请填写有效的 HTTPS 游戏链接');
    }
  };
}
function goBack() {
  if (stack.length) {
    const last = stack.pop();
    query = last.query;
    region = last.region;
    shown = last.shown;
    browse(last.current, false, true);
  } else navigate('home');
}
window.handleBack = () => {
  if ($('#modal').open) {
    closeModal();
    return true;
  }
  if (route === 'browse') {
    goBack();
    return true;
  }
  if (route !== 'home') {
    navigate('home');
    return true;
  }
  return false;
};
function poll() {
  try {
    const oldRoot = state.root;
    const snapshot = native.state();
    state = JSON.parse(snapshot);
    const n = state.tasks.filter((t) =>
      ['queued', 'downloading', 'importing'].includes(t.status)
    ).length;
    $('#taskCount').textContent = n || '';
    $('#folderStatus span:last-child').textContent = state.root
      ? 'ROMs 已连接'
      : '连接 ROMs';
    if (snapshot !== lastTaskSnapshot) {
      if (route === 'downloads') paintTransfers();
      if (route === 'browse' && $('#games') && entries.length) renderGames();
      lastTaskSnapshot = snapshot;
    }
    if (oldRoot !== state.root) {
      if (route === 'settings') settings();
      if (route === 'home') home();
      if (pendingDownload && state.root) {
        const e = pendingDownload;
        pendingDownload = null;
        enqueue(e);
      }
      refreshLibrary();
    }
  } catch (e) {
    console.error(e);
  }
}
async function boot() {
  icons();
  $$('#rail [data-nav]').forEach(
    (b) => (b.onclick = () => navigate(b.dataset.nav))
  );
  $('.brand').onclick = (e) => {
    e.preventDefault();
    navigate('home');
  };
  $('#folderStatus').onclick = () => native.chooseFolder();
  $('#openOmni').onclick = () => native.openOmni();
  $('#closeModal').onclick = closeModal;
  $('#modal').addEventListener('click', (e) => {
    if (e.target === $('#modal')) {
      const r = e.target.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        closeModal();
    }
  });
  try {
    seed = await fetch('direct.json').then((r) => r.json());
    state = JSON.parse(native.state());
    navigate('home');
    poll();
    refreshLibrary();
    setInterval(poll, 1200);
  } catch (e) {
    main(
      `<div class="empty"><h3>游戏库未能打开</h3><p>${esc(e.message)}</p></div>`
    );
  }
}
boot();
