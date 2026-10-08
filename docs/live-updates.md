# Live feed updates

- The YouTube feed is downloaded from the public, channel-ID-specific official Atom endpoint.
- GitHub Actions refreshes `data/latest.json` every 30 minutes (best effort; scheduled workflow runs can be delayed). It can also be started manually from Actions.
- Only public feed entries are shown. Recent Shorts or livestream recordings may appear along with videos; the feed is not a complete video archive.
- No YouTube API keys, paid service, or client-side RSS proxy is required.
- The website also checks `data/latest.json` every five minutes while open. This does not make the feed update faster than GitHub Actions.
- Twitch uses the official Twitch Player SDK to receive online/offline events **while the visitor's page is open**. A status is never labeled LIVE until the SDK reports it; its status may be unavailable if the embed is blocked. Twitch mobile playback still requires user interaction. This is not a push notification or guaranteed always-current background status.
- YouTube hover/phone-dwell preview loads official muted YouTube embeds only after user hover or mobile dwell. Autoplay can be blocked by device/browser policies; clicking video opens it on YouTube.
- Revisit Twitch Helix authentication only if scheduled, server-side status caching or notifications are desired. Never commit Twitch secrets.
