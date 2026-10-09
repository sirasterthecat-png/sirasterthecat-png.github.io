(() => {
  'use strict';

  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const PLAYLIST_ID = /^PL[A-Za-z0-9_-]{10,55}$/;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;

  function playlistWatchURL(playlist, firstVideoId) {
    if (!PLAYLIST_ID.test(playlist) || !VIDEO_ID.test(firstVideoId)) return null;
    const url = new URL('https://www.youtube.com/watch');
    url.searchParams.set('v', firstVideoId);
    url.searchParams.set('list', playlist);
    url.searchParams.set('index', '1');
    url.searchParams.set('autoplay', '1');
    return url.href;
  }

  window.AsterCartridge = { playlistWatchURL };

  function setupLink(link) {
    if (link.dataset.bootBound === 'yes') return;
    link.dataset.bootBound = 'yes';
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          reduceMotion.matches || busy) return;
      const destination = link.href;
      if (!/^https:\/\/www\.youtube\.com\/(?:watch|playlist)\?/.test(destination)) return;
      event.preventDefault();
      busy = true;

      // Popups must be opened synchronously within the original user click.
      // Navigate the pre-opened tab only after the insertion animation.
      let newTab = null;
      try {
        newTab = window.open('about:blank', '_blank');
        if (newTab) newTab.opener = null;
        window.focus();
      } catch (_) { newTab = null; }

      const host = link.closest('.adventure-grid') ||
                   link.closest('.library-card') || link.parentElement;
      host.classList.add('is-booting');
      const overlay = document.createElement('div');
      overlay.className = 'cartridge-boot-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-label', 'Inserting cartridge into Nintendo 64');
      const scene = document.createElement('div');
      scene.className = 'boot-scene';
      const image = link.querySelector('.cartridge-image-wrap, .library-cartridge-art');
      const shell = document.createElement('div');
      shell.className = 'boot-cartridge';
      if (image) shell.appendChild(image.cloneNode(true));
      else {
        const fallback = document.createElement('img');
        fallback.src = 'assets/n64-cartridge-shell.png';
        fallback.alt = '';
        shell.appendChild(fallback);
      }
      const consoleEl = document.createElement('div');
      consoleEl.className = 'boot-console';
      consoleEl.setAttribute('aria-hidden', 'true');
      consoleEl.innerHTML =
        '<div class="boot-console-top"><div class="boot-slot"></div></div>' +
        '<div class="boot-console-front"><span class="boot-n64-mark">N64</span>' +
        '<span class="boot-power-light"></span><span class="boot-controller-ports">' +
        '<i></i><i></i><i></i><i></i></span></div>';
      const status = document.createElement('p');
      status.className = 'boot-caption';
      status.textContent = 'INSERTING GAME...';
      scene.append(consoleEl, shell, status);
      overlay.appendChild(scene);
      host.appendChild(overlay);

      window.setTimeout(() => {
        let launched = false;
        if (newTab && !newTab.closed) {
          try { newTab.location.replace(destination); launched = true; }
          catch (_) { launched = false; }
        }
        if (!launched) {
          // Popup blocked: offer a genuine click target rather than a fake
          // success message or a delayed blocked window.open call.
          status.replaceChildren();
          const fallback = document.createElement('a');
          fallback.href = destination;
          fallback.target = '_blank';
          fallback.rel = 'noopener noreferrer';
          fallback.textContent = 'PRESS START — OPEN YOUTUBE ↗';
          status.appendChild(fallback);
          fallback.addEventListener('click', () => {
            overlay.classList.add('boot-finished');
            window.setTimeout(() => {
              overlay.remove();
              host.classList.remove('is-booting');
            }, 420);
          }, { once: true });
          busy = false;
          return;
        }
        status.textContent = 'GAME START!';
        overlay.classList.add('boot-finished');
        window.setTimeout(() => {
          overlay.remove();
          host.classList.remove('is-booting');
          busy = false;
        }, 420);
      }, 1150);
    });
  }

  function attachCartridges(root = document) {
    root.querySelectorAll('a[data-cartridge-launch]').forEach(setupLink);
  }
  window.AsterCartridge.attach = attachCartridges;
  attachCartridges();

  // The homepage's current-series cartridge shares the same canonical data
  // used by the library; never mistake a playlist cover for its first video.
  const link = document.getElementById('cartridge-current');
  const cover = document.getElementById('cartridge-current-thumb');
  const heading = document.getElementById('cartridge-current-title');
  if (!link || !cover || !heading) return;
  const refresh = async () => {
    if (document.hidden) return;
    try {
      const responses = await Promise.all([
        fetch('data/latest.json?t=' + Date.now(), { cache: 'no-store' }),
        fetch('data/series.json?t=' + Date.now(), { cache: 'no-store' })
      ]);
      if (!responses[0].ok || !responses[1].ok) return;
      const [latest, catalog] = await Promise.all(responses.map(r => r.json()));
      const channel = 'UCWnTWOcecxIeXBY5UNfw16Q';
      if (latest.channelId !== channel || catalog.channelId !== channel ||
          !Array.isArray(catalog.playlists)) return;
      const playlist = latest.featuredPlaylist;
      if (!playlist || !PLAYLIST_ID.test(playlist.id) ||
          typeof playlist.title !== 'string') return;
      const record = catalog.playlists.find(item => item.id === playlist.id);
      const target = record && playlistWatchURL(playlist.id, record.firstVideoId);
      if (target) link.href = target;
      else if (PLAYLIST_ID.test(playlist.id)) {
        link.href = 'https://www.youtube.com/playlist?list=' + playlist.id;
      }
      link.setAttribute('aria-label', 'Start ' + playlist.title + ' playlist on YouTube');
      heading.textContent = playlist.title;
      const thumbId = (record && record.thumbnailVideoId) ||
                      playlist.thumbnailVideoId;
      if (VIDEO_ID.test(thumbId || '')) {
        const next = 'https://i.ytimg.com/vi/' + thumbId + '/hqdefault.jpg';
        if (cover.getAttribute('src') !== next) cover.src = next;
      }
    } catch (_) {
      // Keep the existing, verified fallback on network errors.
    }
  };
  refresh();
  window.setInterval(refresh, 300000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
})();
