(() => {
  'use strict';
  const channelId = 'UCWnTWOcecxIeXBY5UNfw16Q';
  const grid = document.getElementById('library-grid');
  const search = document.getElementById('library-search');
  const sort = document.getElementById('library-sort');
  const count = document.getElementById('library-count');
  const status = document.getElementById('library-status');
  const more = document.getElementById('library-more');
  if (!grid || !search || !sort || !count || !status || !more) return;

  let playlists = [];
  let shown = 18;
  const validVideo = /^[A-Za-z0-9_-]{11}$/;
  const validPlaylist = /^PL[A-Za-z0-9_-]{10,55}$/;

  const compare = (a, b) => {
    if (sort.value === 'name') return a.title.localeCompare(b.title);
    if (sort.value === 'episodes') return b.episodeCount - a.episodeCount ||
      a.title.localeCompare(b.title);
    const recentA = a.lastAdditionDetectedAt || '';
    const recentB = b.lastAdditionDetectedAt || '';
    if (recentA !== recentB) return recentA < recentB ? 1 : -1;
    return a.initialRank - b.initialRank;
  };

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function buildCard(item) {
    const article = make('article', 'library-card');
    const link = make('a', 'cartridge-link');
    const video = validVideo.test(item.firstVideoId || '') ?
      window.AsterCartridge?.playlistWatchURL(item.id, item.firstVideoId) : null;
    link.href = video || 'https://www.youtube.com/playlist?list=' + item.id;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.cartridgeLaunch = 'yes';
    link.setAttribute('aria-label', 'Start ' + item.title + ' on YouTube');

    const wrap = make('span', 'cartridge-image-wrap');
    wrap.setAttribute('aria-hidden', 'true');
    const shell = make('img', 'cartridge-shell');
    shell.src = 'assets/n64-cartridge-shell.png';
    shell.alt = '';
    shell.width = 1231; shell.height = 794;
    shell.loading = 'lazy';
    const label = make('span', 'cartridge-label-area');
    const picture = make('span', 'cartridge-picture');
    const thumb = make('img');
    const cover = validVideo.test(item.thumbnailVideoId || '') ?
      item.thumbnailVideoId : item.firstVideoId;
    if (validVideo.test(cover || '')) {
      thumb.src = 'https://i.ytimg.com/vi/' + cover + '/hqdefault.jpg';
    } else {
      thumb.src = 'assets/AsterHappy.PNG';
    }
    thumb.alt = '';
    thumb.loading = 'lazy';
    thumb.decoding = 'async';
    picture.appendChild(thumb);
    const platform = make('span', 'cartridge-platform');
    const logo = make('img');
    logo.src = 'assets/youtube-mark.svg';
    logo.alt = '';
    platform.append(logo, make('span', '', 'YouTube'));
    label.append(picture, platform);
    wrap.append(shell, label);
    link.appendChild(wrap);

    const copy = make('div', 'library-card-copy');
    copy.append(make('h3', '', item.title));
    const countText = item.episodeCount === 1 ? '1 video' :
      item.episodeCount + ' videos';
    const activity = item.lastAdditionDetectedAt ? ' · Recently added to' : '';
    copy.append(make('p', '', countText + activity));
    article.append(link, copy);
    return article;
  }

  function render() {
    const phrase = search.value.trim().toLocaleLowerCase();
    const filtered = playlists.filter(item =>
      item.title.toLocaleLowerCase().includes(phrase)).sort(compare);
    const visible = filtered.slice(0, shown);
    const frag = document.createDocumentFragment();
    for (const item of visible) frag.appendChild(buildCard(item));
    grid.replaceChildren(frag);
    window.AsterCartridge?.attach(grid);
    count.textContent = filtered.length + ' / ' + playlists.length + ' playlists';
    status.textContent = filtered.length ? '' : 'No playlists match your search.';
    more.hidden = filtered.length <= shown;
    more.textContent = 'Load more cartridges (' + (filtered.length - shown) + ' remaining) ↓';
  }

  const reset = () => { shown = 18; render(); };
  search.addEventListener('input', reset);
  sort.addEventListener('change', reset);
  more.addEventListener('click', () => { shown += 18; render(); });

  async function load() {
    try {
      const response = await fetch('data/series.json?t=' + Date.now(),
        {cache: 'no-store'});
      if (!response.ok) throw Error('Catalog download unavailable');
      const data = await response.json();
      if (data.channelId !== channelId || !Array.isArray(data.playlists))
        throw Error('Unexpected catalog identity');
      playlists = data.playlists.filter(item =>
        item && validPlaylist.test(item.id || '') &&
        typeof item.title === 'string' && item.title.trim() &&
        Number.isInteger(item.episodeCount) && item.episodeCount >= 0 &&
        Number.isInteger(item.initialRank));
      if (!playlists.length) throw Error('No verified public playlists');
      render();
    } catch (_) {
      status.replaceChildren();
      status.append('The live catalog is temporarily unavailable. ');
      const fallback = make('a', '', 'Browse playlists on YouTube ↗');
      fallback.href = 'https://www.youtube.com/@sirasterthecat/playlists';
      status.appendChild(fallback);
      count.textContent = 'Unavailable';
    }
  }
  load();
})();
