(() => {
  'use strict';

  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const PLAYLIST_ID = /^PL[A-Za-z0-9_-]{10,55}$/;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const CONSOLE_ASSET = 'assets/n64-console-front.webp';
  const TIMING = Object.freeze({
    powerOn: 1200,
    launch: 1700,  // The "game ready" beat, half a second after power-on.
    // Reverse timings run only after a successful open or fallback click.
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
    const consoleElement = element('div', 'boot-console-visual');
    consoleElement.setAttribute('aria-hidden', 'true');

    // Reuse the same approved N64 art as two image layers. The upper/rear
    // image sits BEHIND the cartridge; the front shell masks insertion.
    const rear = element('img', 'boot-console-back');
    rear.src = CONSOLE_ASSET; rear.alt = '';
    rear.width = 700; rear.height = 525;
    const cavity = element('span', 'boot-slot-cavity');
    const cartridge = element('div', 'boot-cartridge');
    const original = link.querySelector('.cartridge-image-wrap, .library-cartridge-art');
    if (original) {
      const artwork = original.cloneNode(true);
      // Cloned lazy images are new loading candidates. Force the selected
      // video's real thumbnail into the tiny animation window immediately.
      const sources = original.querySelectorAll('img');
      artwork.querySelectorAll('img').forEach((img, i) => {
        img.loading = 'eager';
        img.decoding = 'sync';
        if (sources[i] && sources[i].currentSrc) {
          img.src = sources[i].currentSrc;
        }
      });
      cartridge.appendChild(artwork);
    } else {
      const shell = element('img', 'boot-cartridge-shell');
      shell.src = 'assets/n64-cartridge-shell.png';
      shell.alt = '';
      cartridge.appendChild(shell);
    }
    const front = element('img', 'boot-console-front');
    front.src = CONSOLE_ASSET; front.alt = '';
    front.width = 700; front.height = 525;
    // The flap itself is a pixel-accurate CSS crop of the approved light-gray
    // slot cover, animated as a small downward-folding hinged piece.
    const flap = element('span', 'boot-slot-flap');
    // Move the actual power-rocker artwork, including its POWER label,
    // rather than shifting an artificial tab across the stationary switch.
    const switchWell = element('span', 'boot-power-switch-well');
    const switchEl = element('img', 'boot-power-switch');
    switchEl.src = 'assets/n64-power-rocker.webp';
    switchEl.alt = '';
    switchEl.width = 108;
    switchEl.height = 128;
    switchEl.decoding = 'sync';
    const led = element('span', 'boot-power-led');
    consoleElement.append(rear, cavity, cartridge, front, flap,
                          switchWell, switchEl, led);
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
      const host = link.closest('.adventure-grid') ||
                   link.closest('.library-card') || link.parentElement;
      const old = host.querySelector('.boot-blocked-note') ||
                  host.parentElement?.querySelector('.boot-blocked-note');
      if (old) old.remove();
      host.classList.add('is-booting');
      const { overlay, scene, caption } = buildBootOverlay(link);
      host.appendChild(overlay);
      scene.classList.add('boot-inserting');
      const after = (ms, fn) => window.setTimeout(fn, ms);
      let reversing = false;

      const reverse = () => {
        if (reversing) return;
        reversing = true;
        scene.classList.remove('boot-powered');
        scene.classList.add('boot-powered-off');
        caption.textContent = 'POWER OFF';
        after(110, () => {
          scene.classList.remove('boot-inserting');
          scene.classList.add('boot-eject');
          caption.textContent = 'EJECTING CARTRIDGE...';
        });
        // Let the cartridge clear the entrance before closing the dust flap.
        after(770, () => scene.classList.remove('boot-slot-open'));
        after(1010, () => overlay.classList.add('boot-finished'));
        after(1430, () => {
          overlay.remove();
          host.classList.remove('is-booting');
          busy = false;
        });
      };

      after(610, () => scene.classList.add('boot-slot-open'));
      after(TIMING.powerOn, () => {
        scene.classList.add('boot-powered');
        caption.textContent = 'GAME READY';
      });
      after(TIMING.launch, () => {
        let launched = false;
        try {
          // No early blank tab. A truthy WindowProxy is a best-effort
          // indication of success, not confirmation of YouTube playback.
          // 'noopener' in window.open features can return null on success;
          // instead detach opener from an actual returned handle.
          const tab = window.open(destination, '_blank');
          if (tab && !tab.closed) {
            try { tab.opener = null; } catch (_) { /* browser-owned proxy */ }
            launched = true;
          }
        } catch (_) { launched = false; }

        if (launched) {
          after(430, reverse);
        } else {
          // Keep the powered-on console, open dust doors, and seated cart.
          // Only the requested link text is displayed.
          caption.replaceChildren();
          const fallback = element('a', 'boot-manual-link');
          fallback.href = destination;
          fallback.target = '_blank';
          fallback.rel = 'noopener noreferrer';
          fallback.textContent = 'Open YouTube';
          fallback.addEventListener('click', () => {
            // The native link opens directly from a real user gesture.
            after(120, reverse);
          }, { once: true });
          caption.appendChild(fallback);
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
