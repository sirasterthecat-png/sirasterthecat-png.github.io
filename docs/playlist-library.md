# Complete public playlist library and cartridge launcher

The [Game Library](https://sirasterthecat-png.github.io/library.html) is a separate static page using the existing cartridge artwork and website palette. It includes all public playlists shown on the verified SirAsterTheCat channel tab, including non-game playlists.

## Discovery and sorting

- scripts/update_library.py crawls the public Playlists tab, verifies the canonical channel ID, and reads the membership and **first ordered video ID** of each playlist.
- data/series.json stores every public playlist with video IDs, cover, verified first video, item count, original rank, and newly detected additions. An hourly best-effort GitHub Action refreshes it; GitHub may delay scheduled jobs.
- On the initial import, ranking uses the public Playlists tab order as an approximation. YouTube does not provide a reliable historical timestamp for when every item was added to a playlist.
- On subsequent scans, genuinely newly observed video IDs in an existing playlist, or a newly seen playlist, receive a detection timestamp and rise in the Recently updated sorting option. Reordering existing videos does not fabricate additions.
- A channel identity failure preserves the previous catalog. A failed individual playlist extraction retains the last verified contents and first-video target instead of publishing guessed data.

## Navigation and animation

- Playable library cartridges launch the playlist's **first ordered video** with the URL shape youtube.com/watch?v=FIRST_ID&list=PLAYLIST_ID&index=1&autoplay=1. This starts in a new browser tab; YouTube and the user's browser control actual playback and may restrict autoplay.
- The intro and highlight cartridges continue to point at their original single videos.
- The current-series homepage cartridge combines data/latest.json with data/series.json, making sure the **first playlist video** is used instead of assuming the thumbnail represents Episode 1.
- Cartridge clicks trigger an approximately 1.15-second N64 insertion animation inside the cartridge area, followed by navigation of a pre-opened tab and a fade back to the cartridges. The blank tab is created synchronously on the initial click to avoid popup blockers; some browser configurations may foreground it before the animation finishes.
- On popup blocking, the animation offers a user-activated YouTube link instead of claiming the tab opened. Modifier clicks and reduced-motion preferences keep native direct link navigation.
- No account access, paid API, external JS framework, user tracking, or replacement of original character artwork was added.
