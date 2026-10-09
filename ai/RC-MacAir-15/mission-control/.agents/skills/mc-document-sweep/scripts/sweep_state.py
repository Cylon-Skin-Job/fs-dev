"""Capture and compare bounded document packages without relying on Git commits."""
import argparse
import difflib
import hashlib
import json
from pathlib import Path
import re
import uuid
from datetime import datetime, timezone


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def inventory(folder):
    index = load(folder / "index.json")
    paths = {"index.json"} | {p.name for p in folder.glob("*.md")}
    for item in index.get("documents", []) + index.get("support_files", []):
        rel = Path(item["path"])
        if rel.is_absolute() or ".." in rel.parts or ".document-sweeps" in rel.parts:
            raise ValueError(f"out-of-scope indexed path: {rel}")
        if rel.suffix.lower() in (".md", ".json") and rel.name != "CHECKPOINT.json":
            paths.add(rel.as_posix())
    result = {}
    for rel in sorted(paths):
        path = folder / rel
        if not path.resolve().is_relative_to(folder):
            raise ValueError(f"source escapes folder: {rel}")
        if not path.exists():
            result[rel] = {"missing": True}
            continue
        data = path.read_bytes()
        if len(data) > 2_000_000:
            raise ValueError(f"document too large for bounded snapshot: {rel}")
        result[rel] = {"sha256": digest(data), "text": data.decode("utf-8")}
    return result


def pointer(state):
    path = state / "reviewed.json"
    return load(path) if path.exists() else None


def run_path(state, run_id):
    if not re.fullmatch(r"[a-f0-9]{32}", run_id):
        raise ValueError("invalid run ID")
    return state / "runs" / run_id


def snapshot(state, run_id):
    path = run_path(state, run_id) / "input.json"
    value = load(path)
    if value["id"] != run_id:
        raise ValueError("snapshot ID mismatch")
    for entry in value["files"].values():
        if not entry.get("missing") and digest(entry["text"].encode("utf-8")) != entry["sha256"]:
            raise ValueError("snapshot content hash mismatch")
    return value


def baseline(state, parent):
    if parent is None:
        return {}
    path = run_path(state, parent["id"])
    if digest((path / "input.json").read_bytes()) != parent["input_sha256"]:
        raise ValueError("reviewed snapshot was modified")
    if digest((path / "report.md").read_bytes()) != parent["report_sha256"]:
        raise ValueError("reviewed report was modified")
    return snapshot(state, parent["id"])["files"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["start", "diff", "finish"])
    parser.add_argument("folder", type=Path)
    parser.add_argument("run_id", nargs="?")
    parser.add_argument("--complete", action="store_true")
    args = parser.parse_args()
    folder = args.folder.resolve()
    state = folder / ".document-sweeps"
    if not state.resolve().is_relative_to(folder):
        raise ValueError("review state escapes folder")
    if args.command == "start":
        if args.run_id:
            raise ValueError("start allocates its own run ID")
        guidance = (folder / "AGENTS.md").read_text(encoding="utf-8")
        if folder.name == "template" and "not a live Launchpad session" in guidance:
            raise ValueError("the Launchpad template is inert")
        parent = pointer(state)
        baseline(state, parent)
        files = inventory(folder)
        if inventory(folder) != files:
            raise ValueError("documents changed during capture; retry a stable snapshot")
        run_id = uuid.uuid4().hex
        run = run_path(state, run_id)
        run.mkdir(parents=True)
        write(run / "input.json", {"id": run_id, "created_at": datetime.now(timezone.utc).isoformat(),
                                  "folder": str(folder), "parent": parent, "files": files})
        print(json.dumps({"run_id": run_id, "parent": parent, "run_directory": str(run),
                          "documents": len(files), "reviewed": False}))
        return
    if not args.run_id:
        raise ValueError("run ID required")
    current = snapshot(state, args.run_id)
    if current["folder"] != str(folder):
        raise ValueError("snapshot belongs to another folder")
    old = baseline(state, current["parent"])
    if args.command == "diff":
        for name in sorted(old.keys() | current["files"].keys()):
            before, after = old.get(name), current["files"].get(name)
            if before == after:
                continue
            print(f"CHANGE {name}: {'added' if before is None else 'removed' if after is None else 'modified'}")
            print("".join(difflib.unified_diff(
                (before or {}).get("text", "<missing>\n").splitlines(keepends=True),
                (after or {}).get("text", "<missing>\n").splitlines(keepends=True),
                fromfile=f"previous/{name}", tofile=f"current/{name}")), end="")
        return
    if not args.complete:
        raise ValueError("finish requires --complete; partial reviews keep the previous baseline")
    lock = state / "finish.lock"
    with lock.open("x"):
        pass
    try:
        if pointer(state) != current["parent"]:
            raise ValueError("baseline changed; reconcile the other review before finishing")
        if inventory(folder) != current["files"]:
            raise ValueError("documents changed; report is stale, baseline not advanced")
        run = run_path(state, args.run_id)
        report = (run / "report.md").read_bytes()
        if not report.strip():
            raise ValueError("nonempty report.md required")
        receipt = {"id": args.run_id, "completed_at": datetime.now(timezone.utc).isoformat(),
                   "input_sha256": digest((run / "input.json").read_bytes()),
                   "report_sha256": digest(report)}
        temp = state / "reviewed.next.json"
        write(temp, receipt)
        temp.replace(state / "reviewed.json")
        print(json.dumps({"baseline": receipt, "meaning": "reviewed, not approved or necessarily clean"}))
    finally:
        lock.unlink()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError) as error:
        raise SystemExit(str(error))
