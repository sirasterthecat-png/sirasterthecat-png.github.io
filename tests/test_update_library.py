"""Unit tests for public playlist catalog, no network access."""
import sys
import types
import unittest
from pathlib import Path
try:
    from yt_dlp import YoutubeDL
except ImportError:
    sys.modules["yt_dlp"] = types.SimpleNamespace(YoutubeDL=object)
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from update_library import make_record,merge_catalog,video_ids_from_listing
PID_A="PLAL-C7T4V304"
PID_B="PLXzmVuZyTD88"
A={"id":PID_A,"title":"Rocket League","thumbnails":[{"url":"https://i.ytimg.com/vi/sT20SAAtGvo/hqdefault.jpg"}]}
B={"id":PID_B,"title":"Fall Guys","thumbnails":[]}
V1="sT20SAAtGvo"
V2="5BsV3A75U0A"
V3="aJ-vOMcnV48"
T1="2026-10-09T14:00:00+00:00"
T2="2026-10-09T15:00:00+00:00"
class LibraryTests(unittest.TestCase):
    def test_initial_rank_does_not_invent_activity(self):
        r=make_record(A,{},T1,0,[V1,V2])
        self.assertEqual((r["initialRank"],r["firstVideoId"],r["episodeCount"],r["lastAdditionDetectedAt"]),(0,V1,2,None))
    def test_new_playlist_after_baseline_moves_to_top(self):
        old={PID_A:make_record(A,{},T1,0,[V1])}
        self.assertEqual(make_record(B,old,T2,1,[V3])["lastAdditionDetectedAt"],T2)
    def test_added_video_detected_not_reordered(self):
        old={PID_A:make_record(A,{},T1,0,[V1,V2])}
        self.assertIsNone(make_record(A,old,T2,4,[V2,V1])["lastAdditionDetectedAt"])
        self.assertEqual(make_record(A,old,T2,4,[V1,V2,V3])["lastAdditionDetectedAt"],T2)
    def test_activity_persists(self):
        old={PID_A:make_record(A,{},T1,0,[V1])}
        old[PID_A]["lastAdditionDetectedAt"]=T1
        self.assertEqual(make_record(A,old,T2,3,[V1])["lastAdditionDetectedAt"],T1)
    def test_cover_is_not_first_video(self):
        r=make_record(A,{},T1,0,[V3,V1])
        self.assertEqual((r["firstVideoId"],r["thumbnailVideoId"]),(V3,V1))
    def test_partial_failure_preserves_prior_membership(self):
        old={"playlists":[make_record(A,{},T1,0,[V1,V2])]}
        def broken(_):raise OSError("rate limited")
        result,failures=merge_catalog([A],old,T2,broken)
        self.assertEqual((len(failures),result[0]["memberIds"]), (1,[V1,V2]))
    def test_every_playlist_included_even_if_empty(self):
        result,errors=merge_catalog([A,B],{},T1,lambda pid:[V1] if pid==PID_A else [])
        self.assertEqual((len(result),errors,result[1]["episodeCount"]),(2,[],0))
    def test_membership_deduplicates_invalid_entries(self):
        self.assertEqual(video_ids_from_listing({"entries":[{"id":V1},{"id":V1},{"id":"bad"},None,{"id":V2}]}),[V1,V2])
if __name__=="__main__":
    unittest.main()
