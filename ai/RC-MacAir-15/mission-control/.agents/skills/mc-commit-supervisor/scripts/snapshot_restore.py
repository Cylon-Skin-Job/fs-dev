"""Restore an isolated candidate after a non-mutating collision preflight."""
import json
import os
from pathlib import Path
import tempfile

from snapshot_state import (SnapshotError, digest, encoded, git, relevant_state,
                            safe_leaf, semantic, unrelated)
from job_snapshot import check_binding, load, read_json, read_payload, write_json


def replace_leaf(repo, name, state, data=None):
    leaf = safe_leaf(repo, name)
    if state["kind"] == "missing":
        if leaf.exists() or leaf.is_symlink():
            leaf.unlink()
        return
    leaf.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".restore-", dir=leaf.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(data)
        if state["kind"] == "symlink":
            temporary.unlink()
            os.symlink(os.fsdecode(data), temporary)
        else:
            temporary.chmod(state["mode"])
        os.replace(temporary, leaf)
    finally:
        if temporary.exists() or temporary.is_symlink():
            temporary.unlink()


def restore(repo, job):
    checkpoint, manifest = load(job)
    repo = check_binding(repo, manifest)
    guard_path = Path(job) / "restore-guard.json"
    if not guard_path.exists():
        raise SnapshotError("fresh ownership/current-byte guard required")
    guard = read_json(guard_path)
    if guard["manifest_sha256"] != digest((checkpoint / "manifest.json").read_bytes()):
        raise SnapshotError("guard belongs to another checkpoint")
    receipt = guard["ownership"]
    if receipt.get("owner") != manifest["owner"] or receipt.get("conflicting_writers") != [] or set(receipt.get("paths", [])) != set(manifest["owned"]):
        raise SnapshotError("current ownership receipt mismatch")
    current = relevant_state(repo, manifest["owned"], manifest["protected_repos"])
    if current != guard["expected"]:
        raise SnapshotError("current-byte collision; nothing restored")
    if unrelated(current, manifest["owned"]) != unrelated(manifest["baseline"], manifest["owned"]):
        raise SnapshotError("unrelated-entry collision; nothing restored")
    for name, entry in manifest["owned"].items():
        safe_leaf(repo, name)
        if entry["worktree"]["kind"] == "missing" and current["paths"][name]["worktree"]["kind"] != "missing" and not entry["job_created"]:
            raise SnapshotError(f"removal requires declared job-created addition: {name!r}")
    gitdir = Path(manifest["repository"]["git_dir"])
    index = gitdir / "index"
    lock = gitdir / "index.lock"
    try:
        lock_fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as error:
        raise SnapshotError("active Git index writer; nothing restored") from error
    private_index = None
    backups = {}
    mutated = False
    original_index = index.read_bytes() if index.exists() else None
    try:
        with os.fdopen(lock_fd, "wb") as locked_index:
            if current != relevant_state(repo, manifest["owned"], manifest["protected_repos"]):
                raise SnapshotError("concurrent mutation before restore; nothing restored")
            descriptor, name = tempfile.mkstemp(prefix="recovery-index-", dir=gitdir)
            private_index = Path(name)
            with os.fdopen(descriptor, "wb") as output:
                if original_index is not None:
                    output.write(original_index)
            if original_index is None:
                private_index.unlink()
            variables = {"GIT_INDEX_FILE": str(private_index)}
            zero = "0" * len(current["refs"]["head"])
            records = []
            for name, entry in manifest["owned"].items():
                records.append(f"0 {zero}\t".encode() + os.fsencode(name) + b"\0")
                for stage in entry["index"]:
                    oid = git(repo, "hash-object", "-w", "--stdin", data=read_payload(checkpoint, stage)).decode().strip()
                    if oid != stage["oid"]:
                        raise SnapshotError("index blob identity mismatch")
                    records.append(f"{stage['mode']} {oid} {stage['stage']}\t".encode() + os.fsencode(name) + b"\0")
            git(repo, "update-index", "-z", "--index-info", data=b"".join(records), env=variables)
            for name, entry in manifest["owned"].items():
                if entry["index"] and entry["flag"]:
                    if entry["flag"].lower() == "s":
                        git(repo, "update-index", "--skip-worktree", "--", name, env=variables)
                    if entry["flag"].islower():
                        git(repo, "update-index", "--assume-unchanged", "--", name, env=variables)
            for name in manifest["owned"]:
                state = current["paths"][name]["worktree"]
                leaf = safe_leaf(repo, name)
                data = os.fsencode(os.readlink(leaf)) if state["kind"] == "symlink" else leaf.read_bytes() if state["kind"] == "file" else None
                backups[name] = (state, data)
            if current != relevant_state(repo, manifest["owned"], manifest["protected_repos"]):
                raise SnapshotError("concurrent mutation before replacement; nothing restored")
            mutated = True
            for name, entry in manifest["owned"].items():
                state = entry["worktree"]
                replace_leaf(repo, name, state, read_payload(checkpoint, state) if "payload" in state else None)
            locked_index.write(private_index.read_bytes())
            locked_index.flush()
            os.fsync(locked_index.fileno())
        os.replace(lock, index)
        restored = relevant_state(repo, manifest["owned"], manifest["protected_repos"])
        if semantic(restored) != semantic(manifest["baseline"]):
            raise SnapshotError("restore readback mismatch")
        status = git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all").hex()
        if status != manifest["status_z_hex"]:
            raise SnapshotError("restore status readback mismatch")
        result = {"result": "RESTORED", "index_worktree_equal": True, "status_equal": True,
                  "restored_sha256": digest(encoded(semantic(restored))),
                  "manifest_sha256": guard["manifest_sha256"]}
        write_json(Path(job) / "restore-readback.json", result)
        guard_path.unlink()
        return result
    except BaseException:
        if mutated:
            for name, (state, data) in backups.items():
                replace_leaf(repo, name, state, data)
            if original_index is None:
                index.unlink(missing_ok=True)
            else:
                rollback = gitdir / "recovery-rollback-index"
                rollback.write_bytes(original_index)
                os.replace(rollback, index)
        raise
    finally:
        lock.unlink(missing_ok=True)
        if private_index is not None:
            private_index.unlink(missing_ok=True)
            Path(str(private_index) + ".lock").unlink(missing_ok=True)
