#!/usr/bin/env python3
"""Fetch the public official YouTube Atom feed and write validated recent uploads.

No YouTube API key or GitHub secrets required. On errors, preserve previous data.
"""
import json
import os
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

CHANNEL_ID = "UCWnTWOcecxIeXBY5UNfw16Q"
FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "latest.json"
ATOM = "http://www.w3.org/2005/Atom"
YT = "http://www.youtube.com/xml/schemas/2015"
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def retrieve():
    request = urllib.request.Request(
        FEED_URL,
        headers={"User-Agent": "SirAsterTheCatSiteFeed/1.0 (+https://sirasterthecat-png.github.io/)"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise ValueError(f"YouTube feed status: {response.status}")
        return response.read(1_000_001)


def build_feed(xml):
    if len(xml) > 1_000_000:
        raise ValueError("Unexpectedly large YouTube feed")
    root = ET.fromstring(xml)
    channel = root.findtext(f"{{{YT}}}channelId")
    if channel != CHANNEL_ID:
        raise ValueError("YouTube feed channel ID mismatch")
    records = []
    for entry in root.findall(f"{{{ATOM}}}entry"):
        vid = (entry.findtext(f"{{{YT}}}videoId") or "").strip()
        title = (entry.findtext(f"{{{ATOM}}}title") or "").strip()
        published = (entry.findtext(f"{{{ATOM}}}published") or "").strip()
        if not VIDEO_ID.fullmatch(vid) or not title or not published:
            continue
        datetime.fromisoformat(published.replace("Z", "+00:00"))
        records.append({
            "id": vid,
            "title": title[:200],
            "published": published,
            "url": f"https://www.youtube.com/watch?v={vid}",
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        })
    records.sort(key=lambda item: item["published"], reverse=True)
    if not records:
        raise ValueError("No valid public video entries received")
    unique = list({item["id"]: item for item in records}.values())[:6]
    # Preserve timestamp when the feed content is unchanged to avoid
    # unnecessary Pages deployments every schedule tick.
    try:
        prior = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if prior.get("videos") == unique:
            print("YouTube feed unchanged; no commit needed")
            return None
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    return {
        "channelId": CHANNEL_ID,
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "videos": unique,
    }


def main():
    data = build_feed(retrieve())
    if data is None:
        return
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # Write atomically, so a failed fetch never deletes last-known-good data.
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=OUTPUT.parent, suffix=".json", delete=False
    ) as temp:
        json.dump(data, temp, ensure_ascii=False, indent=2)
        temp.write("\n")
        tmp_name = temp.name
    os.replace(tmp_name, OUTPUT)
    print(f"Wrote {len(data['videos'])} verified YouTube entries")


if __name__ == "__main__":
    main()
