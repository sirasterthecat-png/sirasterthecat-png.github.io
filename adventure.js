(() => {
  'use strict';

  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const PLAYLIST_ID = /^PL[A-Za-z0-9_-]{10,55}$/;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const CONSOLE_ASSET = 'assets/n64-console-front.webp';
  const TIMING = Object.freeze({
    powerOn: 1200,
    launch: 1700,  // The "game ready" beat, half a second after power-on.
    powerOff: 3700,
    eject: 3820,
    fade: 4600,
    reset: 5040
  });
  let busy = false;

  // Preload the approved console art while the visitor is browsing.
  const consolePreload = new Image();
  consolePreload.src = CONSOLE_ASSET;

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

  const element = (tag, className) => {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  };

  function buildBootOverlay(link) {
    const overlay = element('div', 'cartridge-boot-overlay');
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'Inserting cartridge into Nintendo 64');
    const scene = element('div', 'boot-scene');
    const cartridge = element('div', 'boot-cartridge');

    const original = link.querySelector('.cartridge-image-wrap, .library-cartridge-art');
    if (original) cartridge.appendChild(original.cloneNode(true));
    else {
      const shell = element('img', 'boot-cartridge-shell');
      shell.src = 'assets/n64-cartridge-shell.png';
      shell.alt = '';
      cartridge.appendChild(shell);
    }

    const consoleElement = element('div', 'boot-console-visual');
    consoleElement.setAttribute('aria-hidden', 'true');
    const img = element('img', 'boot-console-image');
    img.src = CONSOLE_ASSET;
    img.alt = '';
    img.width = 1448;
    img.height = 1086;
    img.decoding = 'async';

    // These two details are independently animated over the approved artwork.
    const switchEl = element('span', 'boot-power-switch');
    const led = element('span', 'boot-power-led');
    // Anchor the cartridge to the console, so its X coordinate is precisely
    // the center of the visible slot at every viewport size.
    consoleElement.append(img, cartridge, switchEl, led);

    const caption = element('p', 'boot-caption');
    caption.textContent = 'INSERTING CARTRIDGE...';
    scene.append(consoleElement, caption);
    overlay.appendChild(scene);
    return { overlay, scene, caption };
  }

  function setupLink(link) {
    if (link.dataset.bootBound === 'yes') return;
    link.dataset.bootBound = 'yes';
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          reduceMotion.matches) return;
      if (busy) { event.preventDefault(); return; }
      const destination = link.href;
      if (!/^https:\/\/www\.youtube\.com\/(?:watch|playlist)\?/.test(destination)) return;
      event.preventDefault();
      busy = true;

      // Never create an early tab: browsers foreground it immediately and
      // hide the very animation the visitor chose to watch.

      const host = link.closest('.adventure-grid') ||
                   link.closest('.library-card') || link.parentElement;
      host.classList.add('is-booting');
      const { overlay, scene, caption } = buildBootOverlay(link);
      host.appendChild(overlay);

      const after = (ms, fn) => window.setTimeout(fn, ms);
      after(TIMING.powerOn, () => {
        scene.classList.add('boot-powered');
        caption.textContent = 'POWER ON';
      });
      after(TIMING.launch, () => {
        // The original 500ms power-on beat now changes the caption only.
        // Opening YouTube here would steal focus before ejection and fade.
        caption.textContent = 'GAME READY';
      });

      // Shutdown is intentionally visible on the original website, even
      // when the newly opened browser tab takes foreground focus.
      after(TIMING.powerOff, () => {
        scene.classList.remove('boot-powered');
        scene.classList.add('boot-powered-off');
        caption.textContent = 'POWER OFF';
      });
      after(TIMING.eject, () => {
        scene.classList.add('boot-eject');
        caption.textContent = 'EJECTING CARTRIDGE...';
      });
      after(TIMING.fade, () => overlay.classList.add('boot-finished'));
      after(TIMING.reset, () => {
        overlay.remove();
        host.classList.remove('is-booting');
        busy = false;

        // Only try to open YouTube after the entire insertion, power cycle,
        // ejection, and fade have completed. No tab exists before this point.
        // Delayed popups are sometimes blocked; preserve a real click fallback.
        let launched = false;
        try {
          const tab = window.open(destination, '_blank');
          if (tab && !tab.closed) {
            tab.opener = null;
            launched = true;
          }
        } catch (_) { launched = false; }

        if (!launched) {
          const previous = host.querySelector('.boot-blocked-note') ||
                           host.parentElement?.querySelector('.boot-blocked-note');
          if (previous) previous.remove();
          const note = element('p', 'boot-blocked-note');
          note.append('Animation complete. ');
          const fallback = element('a', 'boot-manual-link');
          fallback.href = destination;
          fallback.target = '_blank';
          fallback.rel = 'noopener noreferrer';
          fallback.textContent = 'Open YouTube ↗';
          note.appendChild(fallback);
          if (host.classList.contains('library-card')) host.appendChild(note);
          else host.after(note);
        }
      });
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
