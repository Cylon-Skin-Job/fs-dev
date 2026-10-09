#!/usr/bin/env python3
"""Immutable owned preimages with read-only verification and guarded isolated recovery."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

from snapshot_state import (SnapshotError, assert_isolated, digest, encoded, git,
                            path_name, ref_state, relevant_state, repository,
                            resolve_commit, semantic, unrelated, worktree)

SCHEMA = 1


def read_json(path):
    return json.loads(Path(path).read_text())


def immutable_json(path, value):
    with Path(path).open("xb") as output:
        output.write(encoded(value) + b"\n")
    Path(path).chmod(0o444)


def write_json(path, value):
    target = Path(path)
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
        temporary = Path(output.name)
        output.write(encoded(value) + b"\n")
    os.replace(temporary, target)


def load(job):
    checkpoint = Path(job) / "recovery"
    data = (checkpoint / "manifest.json").read_bytes()
    if digest(data) != (checkpoint / "manifest.sha256").read_text().strip():
        raise SnapshotError("manifest hash mismatch")
    manifest = json.loads(data)
    if manifest["schema"] != SCHEMA:
        raise SnapshotError("unsupported recovery schema")
    for entry in manifest["owned"].values():
        for part in [entry["worktree"], *entry["index"], *entry["base"]]:
            if "payload" in part:
                read_payload(checkpoint, part)
    return checkpoint, manifest


def read_payload(checkpoint, part):
    name = part["payload"]
    if name != "payloads/" + part["sha256"]:
        raise SnapshotError("invalid payload location")
    path = checkpoint / name
    if path.is_symlink() or path.parent.is_symlink() or not path.is_file():
        raise SnapshotError("missing/linked payload")
    data = path.read_bytes()
    if digest(data) != part["sha256"]:
        raise SnapshotError("payload hash mismatch")
    return data


def capture(repo, job, paths_file):
    config_hash = digest(Path(paths_file).read_bytes())
    config = read_json(paths_file)
    owner = config.get("owner")
    if not owner or config.get("conflicting_writers") != []:
        raise SnapshotError("capture requires named owner and verified inactive conflicting writers")
    protected = sorted({str(Path(p).resolve()) for p in [config["source_repo"], *config.get("shared_repos", []),
                       *(s["repo"] for s in config.get("source_refs", []))]})
    identity = assert_isolated(repo, protected)
    repo = identity["root"]
    paths = {}
    for item in config["paths"]:
        item = {"path": item} if isinstance(item, str) else item
        name = path_name(item["path"])
        if name in paths or any(name.startswith(p + "/") or p.startswith(name + "/") for p in paths):
            raise SnapshotError("duplicate/overlapping owned paths")
        paths[name] = {"job_created": item.get("job_created", False)}
    if not paths:
        raise SnapshotError("empty owned scope")
    ignored = set(os.fsdecode(n) for n in git(repo, "check-ignore", "--stdin", "-z",
                  data=b"\0".join(os.fsencode(p) for p in paths) + b"\0", allowed=(0, 1),
                  env={"GIT_LITERAL_PATHSPECS": "0"}).split(b"\0") if n)
    if ignored - set(config.get("ignored_runtime_paths", [])):
        raise SnapshotError("ignored inputs require explicit ignored_runtime_paths ownership")
    job = Path(job).resolve()
    if job == Path(repo) or Path(repo) in job.parents:
        raise SnapshotError("job evidence must be outside candidate checkout")
    job.mkdir(parents=True, exist_ok=True)
    if (job / "recovery").exists():
        raise SnapshotError("checkpoint already exists; immutable evidence cannot be replaced")
    try:
        capture_lock = job / ".capture.lock"
        descriptor = os.open(capture_lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
    except FileExistsError as error:
        raise SnapshotError("another checkpoint writer is active") from error
    temporary = Path(tempfile.mkdtemp(prefix=".capture-", dir=job))
    try:
        (temporary / "payloads").mkdir()

        def payload(data):
            name = digest(data)
            target = temporary / "payloads" / name
            if not target.exists():
                target.write_bytes(data)
                target.chmod(0o444)
            if target.read_bytes() != data:
                raise SnapshotError("payload readback mismatch")
            return "payloads/" + name

        authorities = {str(Path(p).resolve()): digest(Path(p).read_bytes()) for p in config.get("authority_paths", [])}
        before = relevant_state(repo, paths, protected)
        base = {}
        for row in git(repo, "ls-tree", "-r", "-z", "HEAD").split(b"\0"):
            if row:
                fields, name = row.split(b"\t", 1)
                mode, kind, oid = fields.decode().split()
                base[os.fsdecode(name)] = {"mode": mode, "oid": oid, "kind": kind}
        owned = {}
        for name, declaration in paths.items():
            stages = []
            for entry in before["paths"][name]["index"]:
                data = git(repo, "cat-file", "blob", entry["oid"])
                stages.append(dict(entry, sha256=digest(data), payload=payload(data)))
            bases = []
            if name in base:
                data = git(repo, "cat-file", "blob", base[name]["oid"])
                bases.append(dict(base[name], sha256=digest(data), payload=payload(data)))
            owned[name] = dict(declaration, index=stages, base=bases,
                               flag=before["paths"][name]["flag"],
                               worktree=worktree(repo, name, payload))
            wt = {k: v for k, v in owned[name]["worktree"].items() if k != "payload"}
            if wt != before["paths"][name]["worktree"]:
                raise SnapshotError("concurrent mutation while reading owned payload")
            if stages and not bases and len(stages) == 1 and stages[0]["stage"] == 0 and not git(repo, "diff", "--cached", "--name-only", "-z", "--", name):
                raise SnapshotError("intent-to-add index entry requires explicit staging before capture")
        target = resolve_commit(repo, config.get("target_ref", "HEAD"))
        sources = [{"repo": str(Path(s["repo"]).resolve()), "ref": s["ref"],
                    "commit": resolve_commit(s["repo"], s["ref"])} for s in config.get("source_refs", [])]
        after = relevant_state(repo, paths, protected)
        status = git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all").hex()
        if before != after or authorities != {p: digest(Path(p).read_bytes()) for p in authorities} or config_hash != digest(Path(paths_file).read_bytes()):
            raise SnapshotError("concurrent mutation during capture; coordinate writer and retry")
        manifest = {"schema": SCHEMA, "captured_at": datetime.now(timezone.utc).isoformat(),
                    "repository": identity, "protected_repos": protected, "owner": owner,
                    "target_commit": target, "source_commits": sources, "authority_hashes": authorities,
                    "preparation": config.get("preparation", "local clone of existing commits; replay owned bytes"),
                    "runtime": config.get("runtime", {"recovery": "separate; no profile/database effects captured"}),
                    "ignored_runtime_paths": sorted(ignored), "owned": owned,
                    "baseline": before, "status_z_hex": status, "paths_file_sha256": config_hash}
        if after != relevant_state(repo, paths, protected):
            raise SnapshotError("concurrent mutation during status readback")
        immutable_json(temporary / "manifest.json", manifest)
        (temporary / "manifest.sha256").write_text(digest((temporary / "manifest.json").read_bytes()) + "\n")
        (temporary / "manifest.sha256").chmod(0o444)
        os.rename(temporary, job / "recovery")
        load(job)
    except BaseException:
        if temporary.exists():
            shutil.rmtree(temporary)
        raise
    finally:
        capture_lock.unlink(missing_ok=True)
    return {"result": "CAPTURED", "manifest_sha256": digest((job / "recovery/manifest.json").read_bytes()),
            "paths": len(paths), "target_commit": target}


def check_binding(repo, manifest):
    identity = assert_isolated(repo, manifest["protected_repos"])
    if identity != manifest["repository"]:
        raise SnapshotError("restore repo is not recorded isolated checkout")
    return identity["root"]


def guard(repo, job, ownership_file):
    checkpoint, manifest = load(job)
    repo = check_binding(repo, manifest)
    receipt = read_json(ownership_file)
    if receipt.get("owner") != manifest["owner"] or receipt.get("conflicting_writers") != [] or set(receipt.get("paths", [])) != set(manifest["owned"]):
        raise SnapshotError("current ownership/inactive-writer receipt does not match scope")
    state = relevant_state(repo, manifest["owned"], manifest["protected_repos"])
    if unrelated(state, manifest["owned"]) != unrelated(manifest["baseline"], manifest["owned"]):
        raise SnapshotError("unrelated entries changed; restore is non-mutating")
    if state["protected"] != manifest["baseline"]["protected"] or {k: v for k, v in state["refs"].items() if k != "index_file_sha256"} != {k: v for k, v in manifest["baseline"]["refs"].items() if k != "index_file_sha256"}:
        raise SnapshotError("source/shared/HEAD/ref state changed")
    if state != relevant_state(repo, manifest["owned"], manifest["protected_repos"]):
        raise SnapshotError("concurrent mutation during guard")
    write_json(Path(job) / "restore-guard.json", {"manifest_sha256": digest((checkpoint / "manifest.json").read_bytes()),
               "ownership": receipt, "expected": state, "recorded_at": datetime.now(timezone.utc).isoformat()})
    return {"result": "GUARDED", "expected_sha256": digest(encoded(state))}


def verify(job):
    checkpoint, manifest = load(job)
    repo = check_binding(manifest["repository"]["root"], manifest)
    current = relevant_state(repo, manifest["owned"], manifest["protected_repos"])
    status_equal = git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all").hex() == manifest["status_z_hex"]
    return {"result": "VERIFIED", "payloads_valid": True,
            "matches_checkpoint": status_equal and semantic(current) == semantic(manifest["baseline"]),
            "status_equal": status_equal,
            "current_sha256": digest(encoded(current)),
            "manifest_sha256": digest((checkpoint / "manifest.json").read_bytes())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("capture", "verify", "guard", "restore"):
        sub = commands.add_parser(name)
        sub.add_argument("--job", required=True)
        if name != "verify":
            sub.add_argument("--repo", required=True)
        if name == "capture":
            sub.add_argument("--paths-file", required=True)
        if name == "guard":
            sub.add_argument("--ownership-file", required=True)
    args = parser.parse_args()
    try:
        if args.command == "capture":
            result = capture(args.repo, args.job, args.paths_file)
        elif args.command == "verify":
            result = verify(args.job)
        elif args.command == "guard":
            result = guard(args.repo, args.job, args.ownership_file)
        else:
            from snapshot_restore import restore
            result = restore(args.repo, args.job)
        print(json.dumps(result))
    except (SnapshotError, OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(json.dumps({"result": "REFUSED", "reason": str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
