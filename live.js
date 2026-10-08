(() => {
  'use strict';

  const CHANNEL_URL = 'https://www.youtube.com/@sirasterthecat/videos';
  const TWITCH_URL = 'https://www.twitch.tv/sirasterthecat';
  const safeVideoId = /^[a-zA-Z0-9_-]{11}$/;
  const videoGrid = document.getElementById('recent-videos');
  const shortsGrid = document.getElementById('recent-shorts');
  const updatedLabel = document.getElementById('youtube-updated');
  const shortsUpdatedLabel = document.getElementById('shorts-updated');
  const featuredLink = document.getElementById('featured-link');
  const featuredTitle = document.getElementById('featured-title');
  const featuredDescription = document.getElementById('featured-description');
  const featuredWatchLink = document.getElementById('featured-watch-link');
  const mobileMode = window.matchMedia('(hover: none), (pointer: coarse)');
  const mediaEntries = new Map();
  let visibleEntries = new Map();
  let activePreview = null;
  let pendingPreview = null;
  let pendingTimer = 0;
  let lastFeedSignature = '';

  const videoURL = (id, kind = 'longform') => kind === 'shorts'
    ? 'https://www.youtube.com/shorts/' + id
    : 'https://www.youtube.com/watch?v=' + id;
  // YouTube's oar2 image is portrait artwork for Shorts, not a stretched
  // landscape thumbnail. Fall back when it is unavailable for a new upload.
  const thumbnailURL = (id, kind = 'longform') =>
    'https://i.ytimg.com/vi/' + id + (kind === 'shorts' ? '/oar2.jpg' : '/hqdefault.jpg');

  const thumbImage = (record, kind = 'longform') => {
    const image = document.createElement('img');
    image.className = 'video-thumb-image';
    image.src = thumbnailURL(record.id, kind);
    if (kind === 'shorts') image.addEventListener('error', () => {
      image.src = thumbnailURL(record.id, 'longform');
    }, { once: true });
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    return image;
  };

  const clearPending = () => {
    window.clearTimeout(pendingTimer);
    pendingTimer = 0;
    pendingPreview = null;
  };

  const stopPreview = () => {
    clearPending();
    if (!activePreview) return;
    const overlay = activePreview.querySelector('.video-preview');
    if (overlay) overlay.replaceChildren();
    activePreview = null;
  };

  const startPreview = (surface) => {
    clearPending();
    if (document.hidden || activePreview === surface) return;
    if (activePreview) stopPreview();
    const id = surface.dataset.videoId;
    const holder = surface.querySelector('.video-preview');
    if (!holder || !safeVideoId.test(id || '')) return;

    const player = document.createElement('iframe');
    const url = new URL('https://www.youtube-nocookie.com/embed/' + id);
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('mute', '1');
    url.searchParams.set('playsinline', '1');
    url.searchParams.set('controls', '0');
    url.searchParams.set('rel', '0');
    player.src = url.href;
    player.title = 'Muted preview of ' + (surface.dataset.videoTitle || 'YouTube video');
    player.tabIndex = -1;
    player.setAttribute('aria-hidden', 'true');
    player.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    player.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    player.addEventListener('error', () => {
      if (activePreview === surface) stopPreview();
    }, { once: true });
    holder.appendChild(player);
    activePreview = surface;
  };

  const schedulePreview = (surface, delay) => {
    if (document.hidden || !surface || !surface.dataset.videoId) return;
    if (activePreview === surface || pendingPreview === surface) return;
    clearPending();
    pendingPreview = surface;
    pendingTimer = window.setTimeout(() => {
      if (pendingPreview === surface) startPreview(surface);
    }, delay);
  };

  let observer = null;
  const chooseMobilePreview = () => {
    if (!mobileMode.matches || document.hidden) return;
    const candidates = [...visibleEntries.entries()]
      .filter(([element, ratio]) => element.isConnected && ratio >= .72)
      .sort((a, b) => b[1] - a[1]);
    const best = candidates.length ? candidates[0][0] : null;
    if (activePreview && (!visibleEntries.has(activePreview) ||
        visibleEntries.get(activePreview) < .55 || (best && best !== activePreview))) {
      stopPreview();
    }
    if (best) schedulePreview(best, 1900);
    else clearPending();
  };

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleEntries.set(entry.target, entry.intersectionRatio);
        else visibleEntries.delete(entry.target);
      }
      chooseMobilePreview();
    }, { threshold: [0, .3, .55, .72, .85, 1] });
  }

  const attachPreview = (surface, record) => {
    surface.dataset.videoId = record.id;
    surface.dataset.videoTitle = record.title;
    const overlay = document.createElement('span');
    overlay.className = 'video-preview';
    overlay.setAttribute('aria-hidden', 'true');
    surface.appendChild(overlay);
    mediaEntries.set(surface, record.id);
    if (observer) observer.observe(surface);
    surface.addEventListener('pointerenter', (event) => {
      if (!mobileMode.matches && event.pointerType !== 'touch') schedulePreview(surface, 650);
    });
    surface.addEventListener('pointerleave', () => {
      if (pendingPreview === surface) clearPending();
      if (activePreview === surface && !mobileMode.matches) stopPreview();
    });
    surface.addEventListener('focusin', () => {
      // Keyboard visitors should retain full control, without surprise playback.
      if (activePreview === surface) stopPreview();
    });
  };

  const dateLabel = (value) => {
    const date = new Date(value);
    if (!Number.isFinite(date.valueOf())) return 'Recent upload';
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  };

  const makeVideoCard = (video, kind = 'longform') => {
    const article = document.createElement('article');
    article.className = 'video-slot video-card' + (kind === 'shorts' ? ' short-video-card' : '');
    const media = document.createElement('a');
    media.className = 'video-thumb-link';
    media.href = videoURL(video.id, kind);
    media.target = '_blank';
    media.rel = 'noopener noreferrer';
    media.setAttribute('aria-label', 'Watch ' + video.title + ' on YouTube');
    media.appendChild(thumbImage(video, kind));
    const shine = document.createElement('span');
    shine.className = 'video-thumb-shine';
    shine.setAttribute('aria-hidden', 'true');
    media.appendChild(shine);
    const hint = document.createElement('span');
    hint.className = 'video-preview-hint';
    hint.textContent = 'Preview · muted';
    media.appendChild(hint);
    attachPreview(media, video);

    const copy = document.createElement('div');
    copy.className = 'video-copy';
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = videoURL(video.id, kind);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = video.title;
    heading.appendChild(link);
    const date = document.createElement('p');
    date.className = 'video-info';
    date.textContent = video.published
      ? 'Published ' + dateLabel(video.published)
      : (kind === 'shorts' ? 'YouTube Short' : 'Full-length video');
    copy.append(heading, date);
    article.append(media, copy);
    return article;
  };

  const renderFeatured = (video) => {
    if (!featuredLink || !featuredTitle || !featuredDescription || !featuredWatchLink) return;
    featuredLink.replaceChildren();
    featuredLink.href = videoURL(video.id);
    featuredLink.target = '_blank';
    featuredLink.rel = 'noopener noreferrer';
    featuredLink.setAttribute('aria-label', 'Watch latest public upload: ' + video.title);
    featuredLink.appendChild(thumbImage(video));
    const label = document.createElement('span');
    label.className = 'feature-label';
    label.textContent = 'LATEST LONG-FORM VIDEO';
    featuredLink.appendChild(label);
    const shine = document.createElement('span');
    shine.className = 'video-thumb-shine';
    shine.setAttribute('aria-hidden', 'true');
    featuredLink.appendChild(shine);
    attachPreview(featuredLink, video);
    featuredTitle.textContent = video.title;
    featuredDescription.textContent = video.published
      ? 'Newest long-form episode from Aster. Published ' + dateLabel(video.published) + '.'
      : 'The newest long-form adventure from Aster.';
    featuredWatchLink.href = videoURL(video.id);
    featuredWatchLink.target = '_blank';
    featuredWatchLink.rel = 'noopener noreferrer';
    featuredWatchLink.textContent = 'Watch this video on YouTube ↗';
  };

  const readFeed = async () => {
    if (!videoGrid || !shortsGrid) return;
    try {
      const response = await fetch('data/latest.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('YouTube tabs feed unavailable');
      const payload = await response.json();
      if (payload.channelId !== 'UCWnTWOcecxIeXBY5UNfw16Q' ||
          !Array.isArray(payload.longform) || !Array.isArray(payload.shorts)) {
        throw new Error('Unexpected YouTube feed schema');
      }
      const valid = (item) => item &&
        typeof item.id === 'string' && safeVideoId.test(item.id) &&
        typeof item.title === 'string' && !!item.title.trim() &&
        (!item.published || typeof item.published === 'string');
      const videos = payload.longform.filter(valid).slice(0, 6);
      const shorts = payload.shorts.filter(valid).slice(0, 6);
      if (!videos.length || !shorts.length) {
        throw new Error('A YouTube tab has no verified uploads');
      }
      const longIds = new Set(videos.map((item) => item.id));
      if (shorts.some((item) => longIds.has(item.id))) {
        throw new Error('Overlapping video formats in latest feed');
      }
      const signature = videos.map((item) => item.id).join(',') +
        '|' + shorts.map((item) => item.id).join(',');
      if (lastFeedSignature !== signature) {
        stopPreview();
        if (observer) observer.disconnect();
        visibleEntries = new Map();
        mediaEntries.clear();
        const fullCards = document.createDocumentFragment();
        const shortCards = document.createDocumentFragment();
        for (const video of videos) fullCards.appendChild(makeVideoCard(video, 'longform'));
        for (const video of shorts) shortCards.appendChild(makeVideoCard(video, 'shorts'));
        videoGrid.replaceChildren(fullCards);
        shortsGrid.replaceChildren(shortCards);
        renderFeatured(videos[0]);
        lastFeedSignature = signature;
      }
      const date = new Date(payload.updatedAt);
      const updated = Number.isFinite(date.valueOf())
        ? 'Updated ' + new Intl.DateTimeFormat('en', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        }).format(date)
        : 'Latest public uploads';
      if (updatedLabel) updatedLabel.textContent = updated;
      if (shortsUpdatedLabel) shortsUpdatedLabel.textContent = updated;
    } catch (_) {
      const status = lastFeedSignature
        ? 'Showing last verified uploads'
        : 'Updates temporarily unavailable · Browse YouTube';
      if (updatedLabel) updatedLabel.textContent = status;
      if (shortsUpdatedLabel) shortsUpdatedLabel.textContent = status;
      // Keep the last successfully classified cards on network failures.
    }
  };

  readFeed();
  window.setInterval(() => { if (!document.hidden) readFeed(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPreview();
    else { readFeed(); chooseMobilePreview(); }
  });
  window.addEventListener('pagehide', stopPreview);
  mobileMode.addEventListener?.('change', () => {
    stopPreview();
    chooseMobilePreview();
  });

  // Official Twitch player receives Twitch.Player.ONLINE and OFFLINE events.
  // We never fabricate a LIVE claim from a guess, or require API credentials.
  const twitchPlayerNode = document.getElementById('twitch-player');
  const twitchStatus = document.getElementById('twitch-live-label');
  const twitchNote = document.getElementById('twitch-status-note');
  const twitchHeader = document.getElementById('twitch-header-status');
  let twitchEventObserved = false;

  const setTwitchState = (state) => {
    if (!twitchStatus || !twitchNote || !twitchHeader) return;
    const live = state === 'live';
    twitchStatus.classList.toggle('is-live', live);
    twitchHeader.classList.toggle('is-live', live);
    if (live) {
      twitchStatus.textContent = 'LIVE on Twitch';
      twitchHeader.textContent = '● LIVE';
      twitchNote.textContent = 'Aster is streaming now. Watch in the player or open Twitch.';
    } else if (state === 'offline') {
      twitchStatus.textContent = 'Currently offline';
      twitchHeader.textContent = 'Offline';
      twitchNote.textContent = 'Aster is not live according to the Twitch player. Follow to catch the next stream.';
    } else {
      twitchStatus.textContent = 'Check Aster on Twitch';
      twitchHeader.textContent = 'Check live status';
      twitchNote.textContent = 'Live status could not be verified here. Open the official Twitch channel for the latest.';
    }
  };

  if (twitchPlayerNode) {
    const loader = document.createElement('script');
    loader.src = 'https://player.twitch.tv/js/embed/v1.js';
    loader.async = true;
    loader.onload = () => {
      try {
        if (!window.Twitch || !window.Twitch.Player) throw new Error('Twitch unavailable');
        const player = new window.Twitch.Player('twitch-player', {
          channel: 'sirasterthecat',
          width: '100%',
          height: 300,
          parent: [window.location.hostname],
          autoplay: false,
          muted: true,
        });
        player.addEventListener(window.Twitch.Player.ONLINE, () => {
          twitchEventObserved = true;
          setTwitchState('live');
        });
        player.addEventListener(window.Twitch.Player.OFFLINE, () => {
          twitchEventObserved = true;
          setTwitchState('offline');
        });
        player.addEventListener(window.Twitch.Player.READY, () => {
          if (!twitchEventObserved && twitchStatus) {
            twitchStatus.textContent = 'Watching for stream status…';
          }
        });
        window.setTimeout(() => {
          if (!twitchEventObserved) setTwitchState('unknown');
        }, 12000);
      } catch (_) {
        setTwitchState('unknown');
      }
    };
    loader.onerror = () => setTwitchState('unknown');
    document.head.appendChild(loader);
  }
})();
