#!/usr/bin/env python3
"""Identify normative planning bytes; never certify review or owner approval."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile


def within(root, name):
    candidate = (root / name).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"Artifact escapes bundle root: {name}") from exc
    return candidate


def fingerprint(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def candidate_id(artifacts):
    encoded = json.dumps(artifacts, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def create(root, output, files):
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("root must be an existing directory")
    target = within(root, output)
    if not files:
        raise ValueError("At least one normative artifact is required")
    artifacts = []
    seen = set()
    for name in files:
        file = within(root, name)
        if file == target:
            raise ValueError("The manifest cannot be a normative artifact")
        if not file.is_file():
            raise ValueError(f"Missing normative artifact: {name}")
        relative = file.relative_to(root).as_posix()
        if relative in seen:
            raise ValueError(f"Duplicate artifact: {relative}")
        seen.add(relative)
        artifacts.append({"path": relative, "sha256": fingerprint(file)})
    artifacts.sort(key=lambda row: row["path"])
    data = {"schemaVersion": 1, "root": str(root), "candidateId": candidate_id(artifacts), "artifacts": artifacts}
    # One assigned writer still owns the manifest; atomic replacement is not a lease.
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, delete=False) as handle:
            temp = Path(handle.name)
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp, target)
    finally:
        if temp and temp.exists():
            temp.unlink()
    return data


def check(manifest):
    manifest = Path(manifest).resolve(strict=True)
    data = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("schemaVersion") != 1 or not isinstance(data.get("root"), str):
        raise ValueError("Invalid candidate manifest")
    if not Path(data["root"]).is_absolute():
        raise ValueError("Manifest root must be absolute")
    root = Path(data["root"]).resolve(strict=True)
    within(root, manifest)
    artifacts = data.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        raise ValueError("Manifest requires normative artifacts")
    seen = set()
    mismatches = []
    for row in artifacts:
        if not isinstance(row, dict) or set(row) != {"path", "sha256"}:
            raise ValueError("Invalid artifact record")
        name = row["path"]
        digest = row["sha256"]
        if not isinstance(name, str) or Path(name).is_absolute():
            raise ValueError("Artifact paths must be relative")
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise ValueError("Invalid SHA-256")
        file = within(root, name)
        if file.relative_to(root).as_posix() != name or name in seen or file == manifest:
            raise ValueError("Noncanonical, duplicate or self-referencing artifact")
        seen.add(name)
        if not file.is_file():
            mismatches.append({"path": name, "reason": "missing"})
        elif fingerprint(file) != digest:
            mismatches.append({"path": name, "reason": "changed"})
    if artifacts != sorted(artifacts, key=lambda row: row["path"]):
        raise ValueError("Artifacts must be ordered by path")
    if data.get("candidateId") != candidate_id(artifacts):
        raise ValueError("Candidate ID does not match the recorded inventory")
    return {"candidateId": data["candidateId"], "matches": not mismatches, "mismatches": mismatches,
            "note": "Byte identity only; completeness, validation and owner approval require separate evidence."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("create", help="Write a byte inventory inside the assigned bundle")
    build.add_argument("--root", required=True)
    build.add_argument("--output", default="CANDIDATE.json")
    build.add_argument("--files", nargs="+", required=True)
    verify = commands.add_parser("check", help="Read-only comparison of manifest and current files")
    verify.add_argument("manifest")
    args = parser.parse_args()
    try:
        result = create(args.root, args.output, args.files) if args.command == "create" else check(args.manifest)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("matches", True) else 1
    except (ValueError, OSError, TypeError) as exc:
        parser.exit(2, f"{exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
