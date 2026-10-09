# SirAsterTheCat — Official Website

Live site: **https://sirasterthecat-png.github.io/**

The **public deployment** of Aster's starry-night gaming homepage, based on the ghost-glass design refined by Charlie. The separate collaborative development repository is private.

## Current features
- Original AsterDab artwork as browser favicon, Apple touch icon, and sharing-preview image.
- Three responsive N64-style cartridges linking to the channel intro, Gambling With Friends highlight reel, and the latest game playlist listed on the channel. The third cartridge is refreshed by the existing YouTube feed workflow and never autoplays.
- Links to Aster's official YouTube, Twitch, Bluesky and Discord near the top.
- Two separate, automatically refreshed sections: the newest six long-form uploads in a vertical list, and the newest six Shorts in a portrait gallery. Both are classified using the channel's official Videos and Shorts tabs through `scripts/update_youtube.py` (with Atom-feed dates when available).
- A scheduled GitHub Actions feed refresh roughly every 30 minutes; site visitors check the generated JSON about every five minutes. Schedules may be delayed.
- Muted YouTube player previews after desktop hover or mobile viewing dwell. Autoplay is not guaranteed on every browser or iPhone.
- Twitch's official embedded player, with online/offline labels only after its player reports the event. Twitch cannot provide guaranteed background status or push notifications on this static site.
- Keyboard-friendly links and system reduced-motion handling; no on-page Pause Effects button.

## Third-party media / privacy
The static site has no accounts, custom analytics or backend. **Embedded media does contact outside providers**: YouTube thumbnails load from YouTube's image service, the Twitch player connects to Twitch when visiting the site, and optional previews load from `youtube-nocookie.com`. Those services can receive visitor network/device information and apply their respective privacy practices. No Twitch or YouTube API credentials are stored in this repo.

## Deployment
GitHub Pages is deployed from `main`, `/(root)`. This public repository is the only location where the scheduled YouTube refresh runs. Never publish credentials or private developer review material.

## Artwork
The N64-style cartridge shell is generated art from the project chat, cropped for the website. The channel thumbnails belong to their respective videos. The YouTube platform badge indicates link destinations and does not imply endorsement.

The original files `assets/SirAsterCompressed.png` and `assets/AsterHappy.PNG` are included unchanged. Confirm all appropriate artwork publication rights and attribution separately.

## Next improvements
Add a Twitch server-side live-status service only if a securely stored Twitch app credential and backend are approved. Further tune previews against physical iPhones and Apple Safari.
