#!/usr/bin/env python3
"""Refresh separate recent long-form and Shorts lists from the channel's own tabs.

yt-dlp extracts YouTube's public /videos and /shorts tabs, rather than guessing
format from duration or title. The public Atom feed supplements publish dates.
No credentials, visitor data, or unofficial proxy needed.
"""
import json
import os
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

from yt_dlp import YoutubeDL

CHANNEL_ID = "UCWnTWOcecxIeXBY5UNfw16Q"
HANDLE = "sirasterthecat"
FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "latest.json"
ATOM = "http://www.w3.org/2005/Atom"
YT = "http://www.youtube.com/xml/schemas/2015"
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
LIMIT = 6


def read_atom_dates():
    """Optional source of exact dates; unavailable for uploads outside feed window."""
    try:
        request = urllib.request.Request(
            FEED_URL,
            headers={"User-Agent": "SirAsterTheCatSiteFeed/2.0 (+https://sirasterthecat-png.github.io/)"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status != 200:
                return {}
            xml = response.read(1_000_001)
        if len(xml) > 1_000_000:
            return {}
        root = ET.fromstring(xml)
        channel = root.findtext(f"{{{YT}}}channelId")
        if channel not in (CHANNEL_ID, CHANNEL_ID[2:]):
            return {}
        dates = {}
        for entry in root.findall(f"{{{ATOM}}}entry"):
            if entry.findtext(f"{{{YT}}}channelId") != CHANNEL_ID:
                continue
            vid = (entry.findtext(f"{{{YT}}}videoId") or "").strip()
            published = (entry.findtext(f"{{{ATOM}}}published") or "").strip()
            if VIDEO_ID.fullmatch(vid) and published:
                datetime.fromisoformat(published.replace("Z", "+00:00"))
                dates[vid] = published
        return dates
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"Public Atom dates unavailable; keeping verified tab order: {error}")
        return {}


def public_tab(kind):
    if kind not in ("videos", "shorts"):
        raise ValueError("Unexpected YouTube tab")
    url = f"https://www.youtube.com/@{HANDLE}/{kind}"
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "playlistend": LIMIT,
        "socket_timeout": 25,
        "retries": 2,
        "ignoreerrors": False,
    }
    with YoutubeDL(options) as ydl:
        listing = ydl.extract_info(url, download=False)
    if not listing or listing.get("channel_id") != CHANNEL_ID:
        raise ValueError(f"Official YouTube {kind} tab identity could not be verified")
    entries = listing.get("entries") or []
    selected = []
    seen = set()
    for item in entries:
        if not isinstance(item, dict):
            continue
        vid = (item.get("id") or "").strip()
        title = (item.get("title") or "").strip()
        if not VIDEO_ID.fullmatch(vid) or not title or title in ("NA", "[Deleted video]"):
            continue
        if vid in seen:
            continue
        seen.add(vid)
        # A tab is the authoritative format classification. In particular,
        # Shorts may be up to three minutes and duration alone is insufficient.
        selected.append({"id": vid, "title": title[:200]})
        if len(selected) >= LIMIT:
            break
    if not selected:
        raise ValueError(f"Official YouTube {kind} tab returned no valid uploads")
    return selected


EPISODE_GAME = re.compile(
    r"\|\s*(?P<game>.+?)\s+(?:ep(?:isode)?\.?\s*\d+|"
    r"part\s*\d+|pt\.?\s*\d+|finale)\s*[!?.~]*$",
    re.IGNORECASE,
)


def normalized_game_name(value):
    """Compare playlist/game labels without punctuation or case differences."""
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def latest_episode_game(long_items):
    """Use published video-tab order, not playlist-tab display order."""
    for entry in long_items:
        if not isinstance(entry, dict) or not isinstance(entry.get("title"), str):
            continue
        match = EPISODE_GAME.search(entry["title"])
        if match:
            game = match.group("game").strip()
            if normalized_game_name(game):
                return game
    raise ValueError("No recent long-form title identifies a game episode")


def select_game_playlist(long_items, playlist_entries):
    """Return only an exact game-name match for the newest identified episode.

    Never promote an unrelated playlist simply because it is listed first.
    Caller preserves the previously verified playlist when a new one is missing.
    """
    game = latest_episode_game(long_items)
    wanted = normalized_game_name(game)
    skip_titles = {"stream vods", "vods", "shorts", "highlights",
                   "uploads", "past livestreams"}
    for item in playlist_entries:
        if not isinstance(item, dict):
            continue
        playlist_id = item.get("id") or ""
        title = (item.get("title") or "").strip()
        if (not re.fullmatch(r"PL[A-Za-z0-9_-]{10,55}", playlist_id)
                or not title or title.casefold() in skip_titles
                or normalized_game_name(title) != wanted):
            continue
        for thumbnail in item.get("thumbnails") or []:
            if not isinstance(thumbnail, dict):
                continue
            match = re.search(
                r"/vi(?:_webp)?/([A-Za-z0-9_-]{11})/",
                thumbnail.get("url") or "",
            )
            if match:
                return {
                    "id": playlist_id,
                    "title": title[:120],
                    "url": "https://www.youtube.com/playlist?list=" + playlist_id,
                    "thumbnailVideoId": match.group(1),
                }
    raise ValueError(f"No verified playlist matches the latest episode game: {game}")


def current_game_playlist(long_items):
    """Select matching playlist from the authenticated channel's public tab."""
    options = {
        "quiet": True, "no_warnings": True, "skip_download": True,
        "extract_flat": "in_playlist", "playlistend": 30,
        "socket_timeout": 25, "retries": 2, "ignoreerrors": False,
    }
    with YoutubeDL(options) as ydl:
        listing = ydl.extract_info(
            f"https://www.youtube.com/@{HANDLE}/playlists", download=False
        )
    if not listing or listing.get("channel_id") != CHANNEL_ID:
        raise ValueError("Playlist tab channel identity mismatch")
    return select_game_playlist(long_items, listing.get("entries") or [])


def build_data(long_items, short_items, dates, previous, featured_playlist):
    # Carry forward known exact dates when Atom's rolling window drops uploads.
    cached = {
        item["id"]: item.get("published")
        for group in ("longform", "shorts")
        for item in previous.get(group, [])
        if isinstance(item, dict) and VIDEO_ID.fullmatch(item.get("id", ""))
    }
    # Old feed data can supply dates for the first migration only.
    for item in previous.get("videos", []):
        if isinstance(item, dict) and VIDEO_ID.fullmatch(item.get("id", "")):
            cached.setdefault(item["id"], item.get("published"))

    def enrich(items, kind):
        output = []
        for item in items:
            vid = item["id"]
            url_path = "shorts/" + vid if kind == "shorts" else "watch?v=" + vid
            output.append({
                "id": vid,
                "title": item["title"],
                "published": dates.get(vid) or cached.get(vid) or None,
                "url": f"https://www.youtube.com/{url_path}",
                "thumbnail": f"https://i.ytimg.com/vi/{vid}/" +
                             ("oar2.jpg" if kind == "shorts" else "hqdefault.jpg"),
            })
        return output

    data = {
        "channelId": CHANNEL_ID,
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "longform": enrich(long_items, "videos"),
        "shorts": enrich(short_items, "shorts"),
    }
    data["featuredPlaylist"] = featured_playlist
    if (previous.get("longform") == data["longform"] and
            previous.get("shorts") == data["shorts"] and
            previous.get("featuredPlaylist") == data["featuredPlaylist"]):
        print("Both video tabs unchanged; skipping commit")
        return None
    return data


def main():
    try:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        previous = {}
    # If either official tab fails, abort the whole refresh. The last-good
    # JSON stays published instead of mislabeling uploads or clearing a list.
    long_items = public_tab("videos")
    short_items = public_tab("shorts")
    if {x["id"] for x in long_items} & {x["id"] for x in short_items}:
        raise ValueError("YouTube tabs overlap unexpectedly; preserving previous state")
    try:
        featured_playlist = current_game_playlist(long_items)
    except Exception as error:
        print(f"Playlist refresh unavailable; preserving last verified selection: {error}")
        featured_playlist = previous.get("featuredPlaylist")
    data = build_data(long_items, short_items, read_atom_dates(), previous, featured_playlist)
    if data is None:
        return
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=OUTPUT.parent, suffix=".json", delete=False
    ) as temp:
        json.dump(data, temp, ensure_ascii=False, indent=2)
        temp.write("\n")
        filename = temp.name
    os.replace(filename, OUTPUT)
    print(f"Saved {len(data['longform'])} recent videos and {len(data['shorts'])} Shorts")


if __name__ == "__main__":
    main()
