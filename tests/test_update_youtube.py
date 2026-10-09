"""Unit tests for conservative current-series selection (no network access)."""
import sys
import types
import unittest
from pathlib import Path

# The selector is pure; no yt-dlp network client is needed for unit tests.
try:
    from yt_dlp import YoutubeDL  # noqa: F401
except ImportError:
    sys.modules["yt_dlp"] = types.SimpleNamespace(YoutubeDL=object)

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from update_youtube import (latest_episode_game, select_game_playlist, build_data)


def playlist(name, suffix, video_id="sT20SAAtGvo"):
    return {
        "id": "PL" + suffix,
        "title": name,
        "thumbnails": [{"url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"}],
    }


class SeriesSelectionTest(unittest.TestCase):
    def setUp(self):
        self.rocket = playlist("Rocket League", "AL-C7T4V304")
        self.forest = playlist("The Forest", "WCCtmHOGjuo")
        self.perfect = playlist("Perfect Dark", "ABCDEFGHIJKL", "19O1TCxoPHQ")

    def test_newest_episode_wins_even_when_playlist_order_is_stale(self):
        items = [{"title": "GIRL BROS!!! | Perfect Dark Ep 1"},
                 {"title": "Kicking off with ROCKET LEAGUE!! | Rocket League Ep 1"}]
        found = select_game_playlist(items, [self.rocket, self.forest, self.perfect])
        self.assertEqual(found["title"], "Perfect Dark")
        self.assertEqual(found["id"], self.perfect["id"])

    def test_current_live_data_chooses_rocket_league(self):
        items = [{"title": "Kicking off with ROCKET LEAGUE!! | Rocket League Ep 1"},
                 {"title": "Fallin' To My Knees~ | Fall Guys Ep 2"}]
        self.assertEqual(select_game_playlist(items, [self.forest, self.rocket])["id"],
                         self.rocket["id"])

    def test_non_episodes_are_skipped(self):
        items = [{"title": "GAMBLING HIGHLIGHT REEL"}, {"title": "Let's Begin | THE FOREST Episode 2"}]
        self.assertEqual(latest_episode_game(items), "THE FOREST")

    def test_finals_and_parts_are_supported(self):
        self.assertEqual(latest_episode_game([{"title": "Facing God | Bomberman 64: The Second Attack FINALE"}]),
                         "Bomberman 64: The Second Attack")
        self.assertEqual(latest_episode_game([{"title": "Let's go | Fall Guys Pt. 2"}]), "Fall Guys")

    def test_new_series_without_playlist_cannot_pick_old_playlist(self):
        with self.assertRaisesRegex(ValueError, "No verified playlist matches"):
            select_game_playlist([{"title": "New game | Perfect Dark Ep 1"}], [self.rocket, self.forest])

    def test_bad_playlist_and_thumbnail_are_rejected(self):
        missing_cover = {"id": "PLABCDEFGHIJKL", "title": "Perfect Dark", "thumbnails": []}
        with self.assertRaises(ValueError):
            select_game_playlist([{"title": "New game | Perfect Dark Ep 1"}],
                                 [missing_cover, {"id": "bad", "title": "Perfect Dark"}])

    def test_non_episode_uploads_do_not_claim_a_game(self):
        with self.assertRaisesRegex(ValueError, "No recent long-form"):
            latest_episode_game([{"title": "Gambling Highlight Reel"}])

    def test_no_change_preserves_verified_state(self):
        previous = {
            "longform": [{"id": "sT20SAAtGvo", "title": "My Video",
                          "published": None, "url": "https://www.youtube.com/watch?v=sT20SAAtGvo",
                          "thumbnail": "https://i.ytimg.com/vi/sT20SAAtGvo/hqdefault.jpg"}],
            "shorts": [{"id": "aJ-vOMcnV48", "title": "A Short",
                        "published": None, "url": "https://www.youtube.com/shorts/aJ-vOMcnV48",
                        "thumbnail": "https://i.ytimg.com/vi/aJ-vOMcnV48/oar2.jpg"}],
            "featuredPlaylist": self.rocket,
        }
        result = build_data([{"id": "sT20SAAtGvo", "title": "My Video"}],
                            [{"id": "aJ-vOMcnV48", "title": "A Short"}], {}, previous, self.rocket)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
