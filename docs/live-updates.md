# Automatic latest videos and Shorts

- The site shows the six most recent public **long-form videos** from [YouTube's official Videos tab](https://www.youtube.com/@sirasterthecat/videos), in a one-column list.
- Separately, the six most recent public **Shorts** come from the [official Shorts tab](https://www.youtube.com/@sirasterthecat/shorts), using portrait thumbnails in their own gallery. Classification is based on the channel tabs, **not duration or guesswork**.
- The featured item also comes from the latest long-form video. Each item opens its corresponding official YouTube page.
- GitHub Actions refreshes `data/latest.json` approximately every 30 minutes (best effort; GitHub scheduled jobs can be delayed). Visitors check for refreshed JSON every five minutes while viewing the site.
- The updater uses `yt-dlp` to read public channel tabs, verifies the canonical channel ID, supplements known publish dates from YouTube's Atom feed, and preserves previously verified dates. If either tab cannot be read, the workflow fails safely and the previous data remains in place.
- Older uploads outside the Atom feed's recent window may not expose an exact date. The interface does **not** invent one.
- Muted hover (650ms) and mobile viewing-dwell (1900ms) previews use embedded YouTube media. Mobile autoplay is device/browser-dependent.
- Twitch embeds remain unchanged: the official Twitch Player reports online/offline events while the page is open, but status is not guaranteed on every network or as an external push notification.
- No YouTube API credentials or paid proxy services are required. `yt-dlp` is pinned in the public workflow and should be reviewed/updated if YouTube changes its tab format. 
