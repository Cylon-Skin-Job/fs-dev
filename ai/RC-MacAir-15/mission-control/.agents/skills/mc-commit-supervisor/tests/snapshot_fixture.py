"""Disposable Git inputs based exclusively on already existing local commits."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
from snapshot_state import git, ref_state, relevant_state

SOURCE = Path(__file__).resolve().parents[7]


class Fixture:
    def __init__(self, root):
        self.root = Path(root)
        self.repo = self.root / "candidate"
        self.job = self.root / "job"
        self.source_before = ref_state(SOURCE)
        self.source_sentinels = {p: (SOURCE / p).read_bytes() for p in ("AGENTS.md", "README.md")}
        result = subprocess.run(["git", "clone", "--shared", "--no-hardlinks", "--no-checkout",
                                 str(SOURCE), str(self.repo)], capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr.decode())
        git(self.repo, "read-tree", "--empty")
        for name in ("AGENTS.md", "README.md", "restart-fusion.sh", "fusion-studio-server/package.json", "fusion-studio-client/package.json"):
            row = git(SOURCE, "ls-tree", "HEAD", "--", name).split(b"\t")[0].decode().split()
            mode, _, oid = row
            git(self.repo, "update-index", "--add", "--cacheinfo", f"{mode},{oid},{name}")
            leaf = self.repo / name
            leaf.parent.mkdir(parents=True, exist_ok=True)
            leaf.write_bytes(git(SOURCE, "cat-file", "blob", oid))
            leaf.chmod(0o755 if mode == "100755" else 0o644)
        self.names = ["AGENTS.md", "fusion-studio-server/package.json", "restart-fusion.sh",
                      "fusion-studio-client/package.json", "renamed\nfile.json", "new staged.txt",
                      "odd '\" $ ;\t\n -- path.bin", "owned executable.sh", "owned-link", "future addition.txt"]
        (self.repo / "AGENTS.md").write_bytes(b"staged text\n")
        git(self.repo, "add", "--", "AGENTS.md")
        (self.repo / "AGENTS.md").write_bytes(b"working text\n")
        binary = self.repo / "fusion-studio-server/package.json"
        binary.write_bytes(b"stage\0\xff\x80")
        git(self.repo, "add", "--", "fusion-studio-server/package.json")
        binary.write_bytes(b"working\0\xfe\x81")
        git(self.repo, "update-index", "--force-remove", "--", "restart-fusion.sh")
        (self.repo / "restart-fusion.sh").unlink()
        old = self.repo / "fusion-studio-client/package.json"
        old.rename(self.repo / "renamed\nfile.json")
        git(self.repo, "add", "--", "fusion-studio-client/package.json", "renamed\nfile.json")
        (self.repo / "new staged.txt").write_bytes(b"staged add\n")
        git(self.repo, "add", "--", "new staged.txt")
        (self.repo / "new staged.txt").write_bytes(b"unstaged add bytes\n")
        (self.repo / self.names[6]).write_bytes(b"untracked\0\xff")
        (self.repo / "owned executable.sh").write_bytes(b"#!/bin/sh\nexit 0\n")
        git(self.repo, "add", "--", "owned executable.sh")
        (self.repo / "owned executable.sh").chmod(0o751)
        os.symlink("stage target", self.repo / "owned-link")
        git(self.repo, "add", "--", "owned-link")
        (self.repo / "owned-link").unlink()
        os.symlink("worktree target\nwith odd ' characters", self.repo / "owned-link")
        self.paths_file = self.root / "owned-paths.json"
        self.config = {"owner": "fixture-writer", "source_repo": str(SOURCE), "conflicting_writers": [],
                       "source_refs": [{"repo": str(SOURCE), "ref": "HEAD"}],
                       "authority_paths": [str(SCRIPTS / "job_snapshot.py")],
                       "paths": [{"path": n, "job_created": n in ("future addition.txt", "restart-fusion.sh", "fusion-studio-client/package.json")} for n in self.names],
                       "runtime": {"profile": str(self.root / "disposable-profile"), "recovery": "separate disposable profile; never source DB"}}
        self.paths_file.write_text(json.dumps(self.config))
        self.receipt = self.root / "ownership.json"
        self.receipt.write_text(json.dumps({"owner": "fixture-writer", "conflicting_writers": [], "paths": self.names}))

    def cli(self, command, *extra, okay=True):
        arguments = [sys.executable, str(SCRIPTS / "job_snapshot.py"), command, "--job", str(self.job)]
        if command != "verify":
            arguments.extend(["--repo", str(self.repo)])
        if command == "capture":
            arguments.extend(["--paths-file", str(self.paths_file)])
        if command == "guard":
            arguments.extend(["--ownership-file", str(self.receipt)])
        result = subprocess.run([*arguments, *extra], capture_output=True, text=True,
                                env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
        if okay and result.returncode:
            raise AssertionError(result.stderr)
        if not okay and not result.returncode:
            raise AssertionError("expected command refusal")
        return json.loads(result.stdout if result.returncode == 0 else result.stderr)

    def state(self):
        return relevant_state(self.repo, self.names, [str(SOURCE)])

    def mutate(self):
        for n in self.names:
            leaf = self.repo / n
            if leaf.exists() or leaf.is_symlink():
                leaf.unlink()
            leaf.parent.mkdir(parents=True, exist_ok=True)
            leaf.write_bytes(b"candidate repair\0\xff")
            leaf.chmod(0o600)
        git(self.repo, "add", "--", *self.names)
