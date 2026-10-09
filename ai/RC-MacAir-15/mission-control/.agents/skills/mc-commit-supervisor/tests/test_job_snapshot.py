import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from snapshot_fixture import Fixture, SCRIPTS, SOURCE
from job_snapshot import SnapshotError, capture, guard, load, verify
from snapshot_restore import restore
from snapshot_state import git, ref_state, semantic


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="commit-snapshot-test-")
        self.fixture = Fixture(self.temporary.name)

    def tearDown(self):
        self.assertEqual(self.fixture.source_before, ref_state(SOURCE), "source refs/index changed")
        for path, data in self.fixture.source_sentinels.items():
            self.assertEqual(data, (SOURCE / path).read_bytes(), "source sentinel changed")
        self.temporary.cleanup()

    def test_public_cli_exact_reproduction_and_restore(self):
        f = self.fixture
        baseline = f.state()
        initial = f.cli("capture")
        self.assertEqual(initial["result"], "CAPTURED")
        self.assertTrue(f.cli("verify")["matches_checkpoint"])
        _, manifest = load(f.job)
        self.assertNotEqual(manifest["owned"]["AGENTS.md"]["index"][0]["sha256"], manifest["owned"]["AGENTS.md"]["worktree"]["sha256"])
        self.assertNotEqual(manifest["owned"]["fusion-studio-server/package.json"]["index"][0]["sha256"], manifest["owned"]["fusion-studio-server/package.json"]["worktree"]["sha256"])
        self.assertEqual(manifest["owned"]["restart-fusion.sh"]["index"], [])
        self.assertEqual(manifest["owned"]["future addition.txt"]["worktree"]["kind"], "missing")
        self.assertEqual(manifest["owned"]["owned-link"]["index"][0]["mode"], "120000")
        f.mutate()
        self.assertFalse(f.cli("verify")["matches_checkpoint"])
        f.cli("guard")
        result = f.cli("restore")
        self.assertEqual(result["result"], "RESTORED")
        self.assertEqual(semantic(baseline), semantic(f.state()))
        self.assertTrue(f.cli("verify")["matches_checkpoint"])
        self.assertEqual((f.repo / "owned executable.sh").stat().st_mode & 0o777, 0o751)
        self.assertEqual(os.readlink(f.repo / "owned-link"), "worktree target\nwith odd ' characters")
        self.assertFalse((f.repo / "future addition.txt").exists())
        self.assertEqual(git(f.repo, "show", ":AGENTS.md"), b"staged text\n")
        self.assertEqual((f.repo / "AGENTS.md").read_bytes(), b"working text\n")
        # Replaying the immutable preimages also reproduces the candidate after arbitrary repair bytes.
        f.mutate()
        f.cli("guard")
        f.cli("restore")
        self.assertEqual(semantic(baseline), semantic(f.state()))

    def test_owned_collision_is_non_mutating(self):
        f = self.fixture
        f.cli("capture")
        f.mutate()
        f.cli("guard")
        (f.repo / "AGENTS.md").write_bytes(b"another writer")
        current = f.state()
        refused = f.cli("restore", okay=False)
        self.assertIn("collision", refused["reason"])
        self.assertEqual(current, f.state())

    def test_unrelated_index_collision_is_non_mutating(self):
        f = self.fixture
        f.cli("capture")
        f.mutate()
        f.cli("guard")
        (f.repo / "README.md").write_bytes(b"unrelated staged change")
        git(f.repo, "add", "--", "README.md")
        current = f.state()
        f.cli("restore", okay=False)
        self.assertEqual(current, f.state())
        self.assertIn("unrelated", f.cli("guard", okay=False)["reason"])

    def test_unrelated_worktree_collision_is_non_mutating(self):
        f = self.fixture
        f.cli("capture")
        f.mutate()
        f.cli("guard")
        (f.repo / "README.md").write_bytes(b"unrelated working change")
        current = f.state()
        f.cli("restore", okay=False)
        self.assertEqual(current, f.state())

    def test_missing_guard_and_conflicting_owner_refuse(self):
        f = self.fixture
        f.cli("capture")
        current = f.state()
        f.cli("restore", okay=False)
        f.receipt.write_text(json.dumps({"owner": "other", "paths": f.names, "conflicting_writers": []}))
        f.cli("guard", okay=False)
        f.receipt.write_text(json.dumps({"owner": "fixture-writer", "paths": f.names, "conflicting_writers": ["busy"]}))
        f.cli("guard", okay=False)
        self.assertEqual(current, f.state())

    def test_source_checkout_restore_refuses(self):
        f = self.fixture
        f.cli("capture")
        f.cli("guard")
        with self.assertRaisesRegex(SnapshotError, "source/shared"):
            restore(SOURCE, f.job)

    def test_other_isolated_checkout_refuses(self):
        f = self.fixture
        f.cli("capture")
        f.cli("guard")
        with tempfile.TemporaryDirectory() as second:
            other = Fixture(second)
            before = other.state()
            with self.assertRaisesRegex(SnapshotError, "recorded isolated"):
                restore(other.repo, f.job)
            self.assertEqual(before, other.state())

    def test_payload_corruption_refuses_without_mutation(self):
        f = self.fixture
        f.cli("capture")
        f.cli("guard")
        checkpoint, manifest = load(f.job)
        payload = checkpoint / manifest["owned"]["AGENTS.md"]["worktree"]["payload"]
        payload.chmod(0o644)
        payload.write_bytes(b"corrupt")
        before = f.state()
        self.assertIn("payload hash", f.cli("verify", okay=False)["reason"])
        f.cli("restore", okay=False)
        self.assertEqual(before, f.state())

    def test_capture_concurrent_mutation_retains_no_checkpoint(self):
        f = self.fixture
        before = f.state()
        changed = json.loads(json.dumps(before))
        changed["paths"]["AGENTS.md"]["worktree"]["sha256"] = "different"
        with patch("job_snapshot.relevant_state", side_effect=[before, changed]):
            with self.assertRaisesRegex(SnapshotError, "concurrent"):
                capture(f.repo, f.job, f.paths_file)
        self.assertFalse((f.job / "recovery").exists())
        self.assertEqual(before, f.state())
        self.assertEqual(list(f.job.iterdir()), [])

    def test_restore_concurrent_mutation_before_write_is_non_mutating(self):
        f = self.fixture
        f.cli("capture")
        f.mutate()
        f.cli("guard")
        current = f.state()
        changed = json.loads(json.dumps(current))
        changed["paths"]["AGENTS.md"]["worktree"]["sha256"] = "different"
        with patch("snapshot_restore.relevant_state", side_effect=[current, changed]):
            with self.assertRaisesRegex(SnapshotError, "concurrent"):
                restore(f.repo, f.job)
        self.assertEqual(current, f.state())
        self.assertFalse((f.repo / ".git/index.lock").exists())

    def test_job_created_removal_declaration_required(self):
        f = self.fixture
        f.config["paths"][-1]["job_created"] = False
        f.paths_file.write_text(json.dumps(f.config))
        f.cli("capture")
        f.mutate()
        f.cli("guard")
        current = f.state()
        self.assertIn("job-created", f.cli("restore", okay=False)["reason"])
        self.assertEqual(current, f.state())

    def test_unresolved_merge_stages_round_trip(self):
        f = self.fixture
        zero = "0" * len(ref_state(f.repo)["head"])
        records = [f"0 {zero}\tAGENTS.md\0".encode()]
        for stage in (1, 2, 3):
            oid = git(f.repo, "hash-object", "-w", "--stdin", data=f"stage {stage}\0".encode()).decode().strip()
            records.append(f"100644 {oid} {stage}\tAGENTS.md\0".encode())
        git(f.repo, "update-index", "-z", "--index-info", data=b"".join(records))
        before = f.state()
        f.cli("capture")
        _, manifest = load(f.job)
        self.assertEqual([s["stage"] for s in manifest["owned"]["AGENTS.md"]["index"]], [1, 2, 3])
        f.mutate()
        f.cli("guard")
        f.cli("restore")
        self.assertEqual(semantic(before), semantic(f.state()))

    def test_ignored_input_requires_explicit_separate_ownership(self):
        f = self.fixture
        (f.repo / ".git/info/exclude").write_text("ignored-runtime.bin\n")
        (f.repo / "ignored-runtime.bin").write_bytes(b"runtime input")
        f.names.append("ignored-runtime.bin")
        f.config["paths"].append({"path": "ignored-runtime.bin"})
        f.paths_file.write_text(json.dumps(f.config))
        self.assertIn("ignored inputs", f.cli("capture", okay=False)["reason"])
        f.config["ignored_runtime_paths"] = ["ignored-runtime.bin"]
        f.paths_file.write_text(json.dumps(f.config))
        f.cli("capture")
        self.assertEqual(load(f.job)[1]["ignored_runtime_paths"], ["ignored-runtime.bin"])

    def test_parent_symlink_and_path_traversal_refuse(self):
        f = self.fixture
        outside = f.root / "outside"
        outside.mkdir()
        (outside / "file").write_bytes(b"sentinel")
        os.symlink(outside, f.repo / "alias")
        for name in ("alias/file", "../outside/file", ".git/config"):
            f.config["paths"] = [name]
            f.paths_file.write_text(json.dumps(f.config))
            f.cli("capture", okay=False)
        self.assertEqual((outside / "file").read_bytes(), b"sentinel")

    def test_checkpoint_is_immutable_and_index_lock_refuses(self):
        f = self.fixture
        f.cli("capture")
        before = (f.job / "recovery/manifest.json").read_bytes()
        f.cli("capture", okay=False)
        self.assertEqual(before, (f.job / "recovery/manifest.json").read_bytes())
        f.cli("guard")
        (f.repo / ".git/index.lock").write_bytes(b"other git writer")
        current = f.state()
        f.cli("restore", okay=False)
        self.assertEqual(current, f.state())
        self.assertEqual((f.repo / ".git/index.lock").read_bytes(), b"other git writer")

    def test_missing_indexed_file_round_trip(self):
        f = self.fixture
        f.names.append("missing tracked.txt")
        f.config["paths"].append({"path": "missing tracked.txt", "job_created": True})
        leaf = f.repo / "missing tracked.txt"
        leaf.write_bytes(b"index survives working deletion")
        git(f.repo, "add", "--", "missing tracked.txt")
        leaf.unlink()
        f.paths_file.write_text(json.dumps(f.config))
        f.receipt.write_text(json.dumps({"owner": "fixture-writer", "conflicting_writers": [], "paths": f.names}))
        before = f.state()
        f.cli("capture")
        f.mutate()
        f.cli("guard")
        f.cli("restore")
        self.assertFalse(leaf.exists())
        self.assertEqual(git(f.repo, "show", ":missing tracked.txt"), b"index survives working deletion")
        self.assertEqual(semantic(before), semantic(f.state()))

    def test_index_flags_round_trip(self):
        f = self.fixture
        git(f.repo, "update-index", "--assume-unchanged", "--", "AGENTS.md")
        git(f.repo, "update-index", "--skip-worktree", "--", "fusion-studio-server/package.json")
        before = f.state()
        f.cli("capture")
        git(f.repo, "update-index", "--no-assume-unchanged", "--", "AGENTS.md")
        git(f.repo, "update-index", "--no-skip-worktree", "--", "fusion-studio-server/package.json")
        f.mutate()
        f.cli("guard")
        f.cli("restore")
        self.assertEqual(semantic(before), semantic(f.state()))

    def test_intent_to_add_reports_unmet_prerequisite(self):
        f = self.fixture
        f.names.append("intent file")
        f.config["paths"].append("intent file")
        (f.repo / "intent file").write_bytes(b"not staged")
        git(f.repo, "add", "-N", "--", "intent file")
        f.paths_file.write_text(json.dumps(f.config))
        before = f.state()
        self.assertIn("intent-to-add", f.cli("capture", okay=False)["reason"])
        self.assertEqual(before, f.state())

    def test_git_configuration_collision_refuses(self):
        f = self.fixture
        f.cli("capture")
        f.cli("guard")
        git(f.repo, "config", "core.filemode", "false")
        before = f.state()
        f.cli("restore", okay=False)
        self.assertEqual(before, f.state())

    def test_io_failure_rolls_back_guarded_pre_restore_state(self):
        f = self.fixture
        f.cli("capture")
        f.mutate()
        f.cli("guard")
        before = f.state()
        from snapshot_restore import replace_leaf
        count = 0

        def fail_once(*args):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError("injected replacement failure")
            return replace_leaf(*args)

        with patch("snapshot_restore.replace_leaf", side_effect=fail_once):
            with self.assertRaisesRegex(OSError, "injected"):
                restore(f.repo, f.job)
        self.assertEqual(before, f.state())
        self.assertTrue((f.job / "restore-guard.json").exists())

    def test_actual_capture_writer_mutation_retains_writer_bytes(self):
        f = self.fixture
        from snapshot_state import worktree

        def writer_during_payload(repo, name, payload=None):
            result = worktree(repo, name, payload)
            if name == "AGENTS.md":
                (f.repo / name).write_bytes(b"concurrent writer bytes")
            return result

        with patch("job_snapshot.worktree", side_effect=writer_during_payload):
            with self.assertRaisesRegex(SnapshotError, "concurrent"):
                capture(f.repo, f.job, f.paths_file)
        self.assertFalse((f.job / "recovery").exists())
        self.assertEqual((f.repo / "AGENTS.md").read_bytes(), b"concurrent writer bytes")
        self.assertEqual(git(f.repo, "show", ":AGENTS.md"), b"staged text\n")


if __name__ == "__main__":
    unittest.main()
