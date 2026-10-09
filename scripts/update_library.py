#!/usr/bin/env python3
"""Build a snapshot of every public SirAsterTheCat playlist.

The channel playlist tab is the authoritative inventory. The site remembers
playlist membership between runs, so newly OBSERVED additions can be sorted
ahead of the initial (approximate, tab-ordered) baseline. YouTube does not
expose a reliable per-item playlist-add timestamp for this use case.
"""
import json
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from yt_dlp import YoutubeDL

CHANNEL_ID = "UCWnTWOcecxIeXBY5UNfw16Q"
HANDLE = "sirasterthecat"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "series.json"
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
PLAYLIST_ID = re.compile(r"^PL[A-Za-z0-9_-]{10,55}$")


def listing_options():
    return {
        "quiet": True, "no_warnings": True, "skip_download": True,
        "extract_flat": "in_playlist", "socket_timeout": 20,
        "retries": 1, "ignoreerrors": False,
    }


def public_playlists():
    with YoutubeDL(listing_options()) as ydl:
        listing = ydl.extract_info(
            f"https://www.youtube.com/@{HANDLE}/playlists", download=False
        )
    if not listing or listing.get("channel_id") != CHANNEL_ID:
        raise ValueError("Playlist catalog channel identity could not be verified")
    entries = []
    seen = set()
    for item in listing.get("entries") or []:
        if not isinstance(item, dict):
            continue
        pid = item.get("id") or ""
        title = (item.get("title") or "").strip()
        if not PLAYLIST_ID.fullmatch(pid) or not title or pid in seen:
            continue
        seen.add(pid)
        entries.append(item)
    if not entries:
        raise ValueError("No valid public playlists; retaining last catalog")
    return entries


def video_ids_from_listing(info):
    ids = []
    seen = set()
    for entry in info.get("entries") or []:
        if not isinstance(entry, dict):
            continue
        vid = entry.get("id") or ""
        if VIDEO_ID.fullmatch(vid) and vid not in seen:
            ids.append(vid)
            seen.add(vid)
    return ids


def cover_video_id(entry, ids):
    # Playlist thumbnail may be a user-selected cover instead of its first item.
    for thumb in entry.get("thumbnails") or []:
        if not isinstance(thumb, dict):
            continue
        match = re.search(r"/vi(?:_webp)?/([A-Za-z0-9_-]{11})/",
                          thumb.get("url") or "")
        if match:
            return match.group(1)
    return ids[0] if ids else None


def make_record(item, previous, now, rank, member_ids=None):
    """Pure record transformation: no false activity on the initial import."""
    pid = item["id"]
    prior = previous.get(pid)
    if member_ids is None:
        if prior:
            member_ids = prior["memberIds"]
        else:
            member_ids = []
    member_ids = list(dict.fromkeys(
        vid for vid in member_ids if isinstance(vid, str)
        and VIDEO_ID.fullmatch(vid)
    ))
    old_ids = set(prior.get("memberIds") or []) if prior else set()
    additions = set(member_ids) - old_ids
    # A newly discovered playlist after baseline import is also new activity.
    has_existing_catalog = bool(previous)
    detected = (
        now if (prior and additions) or (not prior and has_existing_catalog)
        else prior.get("lastAdditionDetectedAt") if prior else None
    )
    first = member_ids[0] if member_ids else (
        prior.get("firstVideoId") if prior else None
    )
    cover = cover_video_id(item, member_ids) or (
        prior.get("thumbnailVideoId") if prior else None
    )
    return {
        "id": pid,
        "title": item["title"][:160],
        "url": "https://www.youtube.com/playlist?list=" + pid,
        "firstVideoId": first,
        "thumbnailVideoId": cover,
        "episodeCount": len(member_ids),
        "memberIds": member_ids,
        "initialRank": prior.get("initialRank", rank) if prior else rank,
        "lastAdditionDetectedAt": detected,
    }


def merge_catalog(entries, previous, now, fetch_members):
    old = {
        x["id"]: x for x in previous.get("playlists", [])
        if isinstance(x, dict) and PLAYLIST_ID.fullmatch(x.get("id") or "")
    }
    catalog = []
    failures = []
    for index, item in enumerate(entries):
        pid = item["id"]
        try:
            ids = fetch_members(pid)
            # Legitimately empty public playlists must not borrow old contents.
            record = make_record(item, old, now, index, ids)
        except Exception as exc:
            failures.append((pid, str(exc)))
            # Preserve the last verified membership and launch target on error.
            record = make_record(item, old, now, index)
        catalog.append(record)
    return catalog, failures


def crawl_playlist(pid):
    with YoutubeDL(listing_options()) as ydl:
        data = ydl.extract_info(
            "https://www.youtube.com/playlist?list=" + pid, download=False
        )
    if not data or data.get("id") != pid:
        raise ValueError("Playlist identity mismatch")
    return video_ids_from_listing(data)


def refresh():
    try:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        previous = {}
    if previous and previous.get("channelId") != CHANNEL_ID:
        raise ValueError("Stored catalog channel identity mismatch")
    entries = public_playlists()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    def get_members(pid):
        # Be respectful of YouTube's public endpoint: no uncontrolled parallelism.
        time.sleep(0.2)
        return crawl_playlist(pid)

    catalog, failures = merge_catalog(entries, previous, now, get_members)
    for pid, reason in failures:
        print(f"Retaining previous data for {pid}: {reason[:160]}")
    # Avoid shipping a partially initialized baseline with no usable targets.
    if not previous and not any(r["firstVideoId"] for r in catalog):
        raise ValueError("No playlist contents could be verified")
    if previous.get("playlists") == catalog:
        print(f"Catalog unchanged: {len(catalog)} public playlists")
        return
    payload = {
        "channelId": CHANNEL_ID,
        "updatedAt": now,
        "sortMethod": "detected_playlist_additions_then_initial_channel_order",
        "playlists": catalog,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".json", delete=False, dir=OUTPUT.parent
    ) as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
        tmpname = handle.name
    os.replace(tmpname, OUTPUT)
    print(f"Saved all {len(catalog)} public playlists ({len(failures)} refresh errors)")


if __name__ == "__main__":
    refresh()
