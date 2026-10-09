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
- The site reuses the approved 700×525 N64 render as a rear deck and clipped foreground shell, with a dark slot cavity and a pixel-matched crop of the **original light-gray dust flap** that folds downward. A centered cartridge passes in front of the rear deck, then behind the lip and foreground shell as it seats. There is no insertion/ejection rotation.
- Insert begins immediately, flap opens at 0.61s, the power switch turns on and LED glows red at 1.2s, then YouTube is attempted at 1.7s. **No blank tab opens at initial click.** Browser popup success is inferred from the returned WindowProxy (best effort, not proof of video playback).
- If a popup succeeds, the console powers off and reverses automatically. If the browser blocks it, the console remains powered on with the flap open and cartridge inserted, showing **only “Open YouTube”**. Clicking that ordinary target=_blank link starts the reverse sequence: power off and LED off together, straight vertical eject, dust flap closes after the cartridge clears the slot, and the cartridge gallery fades back. Browsers ultimately control tab focus and autoplay.
- Reduced-motion preferences and modifier-clicks keep native immediate links without the animation. On a blocked popup, no fake success notification is shown.

- No account access, paid API, external JS framework, user tracking, or replacement of original character artwork was added.

## Cartridge artwork polish (2026-10-09)

- The YouTube badge and its dark strip are removed from both homepage and library cartridge stickers. One real YouTube thumbnail is cropped with `object-fit: cover` to fill the label niche edge-to-edge, including during the animated cartridge insertion. Animation clones request image resources eagerly rather than inheriting delayed lazy loading.
- The animated cartridge width is 42% of the N64 console artwork, up from 34%; this remains just under the approximately 42.95%-wide slot opening.
- The decorative power-switch nub has been replaced by a cropped sprite from the original approved N64 render (`assets/n64-power-rocker.webp`). The *whole* POWER-labelled rocker moves inside a masked dark switch well. LED and popup logic are unchanged.
