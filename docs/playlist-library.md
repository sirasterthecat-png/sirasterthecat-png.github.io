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
- Cartridge clicks use the approved front-facing N64 console asset. The cartridge is a child of the console element, is centered precisely over the visible slot and moves **straight down and up, without rotation**. Slot-level clipping hides its lower edge when fully seated. The 5-second sequence inserts, powers on at 1.20s, holds the game-ready state from 1.70s, powers off at 3.70s, ejects at 3.82s, fades after 4.60s, and fully restores the cartridge display at 5.04s. **No browser tab is created while this sequence is visible**: only after restoration does the site try to open YouTube in a new tab. Browsers may block this delayed request, so a persistent user-clickable Open YouTube link is shown instead.

- On popup blocking, the animation offers a user-activated YouTube link instead of claiming the tab opened. Modifier clicks and reduced-motion preferences keep native direct link navigation.
- No account access, paid API, external JS framework, user tracking, or replacement of original character artwork was added.
