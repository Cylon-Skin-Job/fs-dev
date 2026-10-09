"""Observable disposable Wiki outcomes; S6 supplies actual agent/runtime gates."""
from datetime import datetime, timezone
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

from wiki_fixture import WikiFixture, article, digest, STAMP


class WikiHandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="commit-wiki-S3-")
        self.addCleanup(self.temp.cleanup)
        self.fixture = WikiFixture(self.temp.name)
        self.addCleanup(self.fixture.assert_sentinels)

    def test_substantive_edit_preserves_complete_preimage_and_actual_time(self):
        f = self.fixture
        page = f.wiki / f.count
        before = page.read_bytes()
        earliest = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        result = f.edit(f.count, before.replace(b"returns n + 1", b"returns n"))
        latest = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.assertTrue(result["changed"])
        self.assertEqual(Path(result["preimage"]).read_bytes(), before)
        self.assertEqual(result["preimage_hash"], __import__('hashlib').sha256(before).hexdigest())
        self.assertLessEqual(earliest, result["timestamp"])
        self.assertLessEqual(result["timestamp"], latest)
        self.assertIn(('last-modified: "' + result["timestamp"] + '"').encode(), page.read_bytes())
        parsed = f.parsed(f.count)
        self.assertEqual(parsed["frontmatter"]["metadata"]["source-files"], ["src/count.js"])
        self.assertEqual(parsed["frontmatter"]["metadata"]["last-modified"], result["timestamp"])
        self.assertEqual(set(parsed["frontmatter"]["metadata"]), {"source-files", "last-modified"})
        self.assertIn("Approved future:", parsed["body"])
        self.assertIn("Open choice:", parsed["body"])
        self.assertEqual(Path(result["preimage"]).parent, page.parent / ".versions")

    def test_same_second_collision_never_overwrites_snapshots(self):
        f = self.fixture
        page = f.wiki / f.count
        before = page.read_bytes()
        second = datetime.now().strftime("%Y-%m-%d-%H%M%S")
        first = f.edit(f.count, before.replace(b"n + 1", b"n"), version_second=second)
        intermediate = page.read_bytes()
        second_edit = f.edit(f.count, intermediate.replace(b"display choice", b"separate display choice"), version_second=second)
        self.assertNotEqual(first["preimage"], second_edit["preimage"])
        self.assertEqual(Path(first["preimage"]).read_bytes(), before)
        self.assertEqual(Path(second_edit["preimage"]).read_bytes(), intermediate)
        self.assertEqual(Path(first["preimage"]).name, second + ".md")
        self.assertEqual(Path(second_edit["preimage"]).name, second + "-01.md")

    def test_no_op_and_timestamp_only_refresh_retain_page_time(self):
        f = self.fixture
        page = f.wiki / f.retained
        before = page.read_bytes()
        self.assertFalse(f.edit(f.retained, before)["changed"])
        refresh = STAMP.sub('  last-modified: "2099-01-01T00:00:00Z"', before.decode())
        self.assertFalse(f.edit(f.retained, refresh)["changed"])
        self.assertEqual(page.read_bytes(), before)
        self.assertFalse((page.parent / ".versions").exists())

    def test_generation_imports_only_owned_block_and_is_stable(self):
        f = self.fixture
        heading = f.wiki / f.heading
        before = heading.read_bytes()
        guide_before = (f.wiki / "000-Guide/PAGE.md").read_bytes()
        retained_before = (f.wiki / f.retained).read_bytes()
        stage = f.stage()
        legacy_leaf = stage / "002-Legacy/001-Leaf/PAGE.md"
        legacy_leaf.parent.mkdir(parents=True)
        legacy_leaf.write_text(article("Legacy leaf", [], "# Staged only"))
        command = f.generate(stage)
        self.assertEqual(command["returncode"], 0)
        self.assertEqual(heading.read_bytes(), before)
        self.assertNotEqual((stage / ".audit-state.json").read_bytes(), f.operational_before)
        self.assertTrue((stage / "002-Legacy/PAGE.md").is_file())
        self.assertFalse((f.wiki / "002-Legacy").exists())
        staged_heading = stage / f.heading
        generated = staged_heading.read_bytes()
        self.assertIn(b"../001-Count/PAGE.md", generated)
        self.assertIn(b"../002-Consumer/PAGE.md", generated)
        # A stage-only unrelated edit cannot leak through the block import.
        staged_heading.write_bytes(generated.replace(b"Hand-written routing survives.", b"UNAUTHORIZED STAGED PROSE"))
        result = f.import_block(stage, f.heading)
        self.assertTrue(result["changed"])
        self.assertIsNone(result["preimage"])
        self.assertIn(b"Hand-written routing survives.", heading.read_bytes())
        self.assertNotIn(b"UNAUTHORIZED", heading.read_bytes())
        self.assertEqual((f.wiki / f.retained).read_bytes(), retained_before)
        self.assertEqual(f.parsed(f.heading)["frontmatter"]["metadata"]["source-files"], [])
        after = heading.read_bytes()
        f.generate(stage)
        self.assertEqual(staged_heading.read_bytes(), generated.replace(b"Hand-written routing survives.", b"UNAUTHORIZED STAGED PROSE"))
        self.assertFalse(f.import_block(stage, f.heading)["changed"])
        self.assertEqual(heading.read_bytes(), after)
        for target in re.findall(r'\]\(([^)#]+)', heading.read_text()):
            self.assertTrue((heading.parent / target).is_file(), target)
        self.assertEqual((f.wiki / "000-Guide/PAGE.md").read_bytes(), guide_before)

    def test_source_drift_refuses_edit_until_bounded_recheck(self):
        f = self.fixture
        page = f.wiki / f.count
        before = page.read_bytes()
        source = f.source / "src/count.js"
        source.write_bytes(b"exports.count = n => n + 2;\n")
        with self.assertRaisesRegex(ValueError, "source drift"):
            f.edit(f.count, before.replace(b"n + 1", b"n"))
        self.assertEqual(page.read_bytes(), before)
        self.assertFalse((page.parent / ".versions").exists())
        # Explicit fixture researcher rereads actual behavior and binds new bytes.
        self.assertIn(b"n + 2", source.read_bytes())
        f.sources["src/count.js"] = digest(source)
        result = f.edit(f.count, before.replace(b"n + 1", b"n + 2"))
        self.assertTrue(result["changed"])
        self.assertIn(b"Current count returns n + 2.", page.read_bytes())

    def test_new_and_deleted_source_presence_drift_is_not_hidden(self):
        f = self.fixture
        self.assertIsNone(f.sources["src/owner-old.js"])
        (f.source / "src/owner-old.js").write_bytes(b"old owner returned")
        with self.assertRaisesRegex(ValueError, "source drift"):
            f.assert_sources()
        (f.source / "src/owner-old.js").unlink()
        (f.source / "src/owner-new.js").unlink()
        with self.assertRaisesRegex(ValueError, "source drift"):
            f.assert_sources()

    def test_original_subject_omission_and_missing_article_are_findings(self):
        f = self.fixture
        findings = f.coverage()
        self.assertEqual(findings, [{"subject": "new-capability", "kind": "missing-article", "page": f.missing}])
        incomplete = {k: v for k, v in f.claims.items() if k != "consumer"}
        self.assertIn({"subject": "consumer", "kind": "omitted-subject"}, f.coverage(incomplete))
        self.assertEqual(f.claims["consumer"]["disposition"], "retain unchanged")
        self.assertIn("src/count.js", f.claims["consumer"]["sources"])
        self.assertNotIn("src/count.js", f.parsed(f.retained)["frontmatter"]["metadata"]["source-files"])
        self.assertEqual(f.claims["renamed-owner"]["sources"], ["src/owner-old.js", "src/owner-new.js"])

    def test_page_collision_preserves_other_writer_and_no_snapshot(self):
        f = self.fixture
        page = f.wiki / f.count
        before = page.read_bytes()
        page.write_bytes(before + b"\nOther writer owns this update.\n")
        with self.assertRaisesRegex(ValueError, "article collision"):
            f.edit(f.count, before.replace(b"n + 1", b"n"))
        self.assertEqual(page.read_bytes(), before + b"\nOther writer owns this update.\n")
        self.assertFalse((page.parent / ".versions").exists())

    def test_missing_article_creation_has_absent_preimage_and_resolved_coverage(self):
        f = self.fixture
        self.assertIsNone(f.pages[f.missing])
        result = f.edit(f.missing, article("New capability", ["src/new.js"], "# New capability\n\nCurrent source enables the capability."))
        self.assertTrue(result["changed"])
        self.assertIsNone(result["preimage"])
        self.assertEqual(f.coverage(), [])
        self.assertEqual(f.parsed(f.missing)["frontmatter"]["metadata"]["source-files"], ["src/new.js"])

    def test_renamed_source_repair_keeps_old_page_preimage_and_exact_new_source(self):
        f = self.fixture
        path = f.claims["renamed-owner"]["page"]
        page = f.wiki / path
        before = page.read_bytes()
        result = f.edit(path, before.replace(b"src/owner-old.js", b"src/owner-new.js").replace(b"the old path", b"the new path"))
        self.assertEqual(Path(result["preimage"]).read_bytes(), before)
        self.assertEqual(f.parsed(path)["frontmatter"]["metadata"]["source-files"], ["src/owner-new.js"])
        self.assertFalse((f.source / "src/owner-old.js").exists())
        self.assertTrue((f.source / "src/owner-new.js").is_file())

    def test_snapshot_failure_prevents_replacement(self):
        f = self.fixture
        page = f.wiki / f.count
        before = page.read_bytes()
        original_open = Path.open
        def fail_snapshot(path, *args, **kwargs):
            if path.parent.name == ".versions" and args and args[0] == "xb":
                raise PermissionError("fixture preimage I/O failure")
            return original_open(path, *args, **kwargs)
        with patch.object(Path, "open", fail_snapshot):
            with self.assertRaises(PermissionError):
                f.edit(f.count, before.replace(b"n + 1", b"n"))
        self.assertEqual(page.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
