import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

source = Path(__file__).resolve().parents[1] / "scripts/candidate_manifest.py"
spec = importlib.util.spec_from_file_location("candidate_manifest", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "SPEC.md").write_text("Observable outcome and owner-defined scope.\n")
        (self.root / "ORDER.md").write_text("One SPEC.\n")
        self.manifest = self.root / "CANDIDATE.json"

    def create(self, files=None):
        return module.create(self.root, "CANDIDATE.json", files or ["SPEC.md", "ORDER.md"])

    def test_order_independent_identity_and_read_only_check(self):
        a = self.create()
        b = self.create(["ORDER.md", "SPEC.md"])
        self.assertEqual(a["candidateId"], b["candidateId"])
        before = self.manifest.read_bytes()
        self.assertTrue(module.check(self.manifest)["matches"])
        self.assertEqual(before, self.manifest.read_bytes())
        self.assertNotIn("approved", a)

    def test_changed_bytes_and_missing_artifacts_invalidate_evidence(self):
        old = self.create()
        (self.root / "SPEC.md").write_text("Changed scope requiring new review.\n")
        self.assertFalse(module.check(self.manifest)["matches"])
        self.assertNotEqual(old["candidateId"], self.create()["candidateId"])
        (self.root / "ORDER.md").unlink()
        self.assertEqual(module.check(self.manifest)["mismatches"][0]["reason"], "missing")

    def test_reject_self_duplicate_and_escape_without_overwriting(self):
        self.create()
        before = self.manifest.read_bytes()
        for files in [["CANDIDATE.json"], ["SPEC.md", "./SPEC.md"], ["../outside.md"]]:
            with self.subTest(files=files), self.assertRaises(ValueError):
                self.create(files)
            self.assertEqual(before, self.manifest.read_bytes())

    def test_tampered_id_and_inventory_are_rejected(self):
        data = self.create()
        data["candidateId"] = "invented"
        self.manifest.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "Candidate ID"):
            module.check(self.manifest)
        data = self.create()
        data["artifacts"][0]["path"] = "../outside.md"
        self.manifest.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "escapes"):
            module.check(self.manifest)

    def test_symlink_cannot_escape_owned_root(self):
        with tempfile.TemporaryDirectory() as other:
            outside = Path(other) / "external.md"
            outside.write_text("Outside owned area")
            (self.root / "linked.md").symlink_to(outside)
            with self.assertRaisesRegex(ValueError, "escapes"):
                self.create(["linked.md"])


if __name__ == "__main__":
    unittest.main()
