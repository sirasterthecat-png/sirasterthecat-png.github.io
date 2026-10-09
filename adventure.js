(() => {
  'use strict';
  const link = document.getElementById('cartridge-current');
  const cover = document.getElementById('cartridge-current-thumb');
  const heading = document.getElementById('cartridge-current-title');
  if (!link || !cover || !heading) return;
  const validVideo = /^[A-Za-z0-9_-]{11}$/;
  const validPlaylist = /^PL[A-Za-z0-9_-]{10,55}$/;
  const refresh = async () => {
    if (document.hidden) return;
    try {
      const response = await fetch('data/latest.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data.channelId !== 'UCWnTWOcecxIeXBY5UNfw16Q') return;
      const playlist = data.featuredPlaylist;
      if (!playlist || !validPlaylist.test(playlist.id) ||
          !validVideo.test(playlist.thumbnailVideoId) ||
          typeof playlist.title !== 'string' || !playlist.title.trim()) return;
      link.href = 'https://www.youtube.com/playlist?list=' + playlist.id;
      link.setAttribute('aria-label', 'Open ' + playlist.title + ' YouTube playlist');
      heading.textContent = playlist.title;
      const nextCover = 'https://i.ytimg.com/vi/' + playlist.thumbnailVideoId + '/hqdefault.jpg';
      if (cover.getAttribute('src') !== nextCover) cover.src = nextCover;
    } catch (_) {
      // Keep the last confirmed playlist if the update request fails.
    }
  };
  refresh();
  const everyFiveMinutes = 300000;
  window.setInterval(refresh, everyFiveMinutes);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
})();
