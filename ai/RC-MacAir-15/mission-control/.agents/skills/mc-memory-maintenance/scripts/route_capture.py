#!/usr/bin/env python3
"""Promote, route, close, and verify structured CAPTURE records."""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path
from typing import Any

from validate_index import validate


H2_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
H3_RE = re.compile(r"^###\s+(.+?)\s*$", re.MULTILINE)
FIELD_RE = re.compile(r"^-\s+\*\*([^*]+):\*\*\s*(.*?)\s*$", re.MULTILINE)
ID_RE = re.compile(r"^([A-Z][A-Z0-9]*-\d+)\b")


class RouteError(ValueError):
    pass


def load_index(folder: Path) -> dict[str, Any]:
    try:
        value = json.loads((folder / "index.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RouteError(f"cannot read index.json: {error}") from None
    if not isinstance(value, dict):
        raise RouteError("index.json root must be an object")
    return value


def documents(index: dict[str, Any]) -> dict[str, dict[str, Any]]:
    records = index.get("documents", [])
    if not isinstance(records, list):
        raise RouteError("index documents must be an array")
    return {
        record["path"]: record
        for record in records
        if isinstance(record, dict) and isinstance(record.get("path"), str)
    }


def fields(block: str) -> dict[str, str]:
    return {match.group(1): match.group(2) for match in FIELD_RE.finditer(block)}


def id_tokens(value: str) -> set[str]:
    return set(re.findall(r"\b[A-Z][A-Z0-9]*-\d+\b", value))


def has_id(value: str, record_id: str) -> bool:
    return record_id in id_tokens(value)


def section_bounds(text: str, heading: str) -> tuple[int, int]:
    matches = list(H2_RE.finditer(text))
    for position, match in enumerate(matches):
        if match.group(1) == heading:
            end = matches[position + 1].start() if position + 1 < len(matches) else len(text)
            return match.start(), end
    raise RouteError(f"missing section: {heading}")


def record_bounds(text: str, record_id: str) -> tuple[int, int, str, str]:
    matches = list(H3_RE.finditer(text))
    found: list[tuple[int, re.Match[str]]] = []
    for position, match in enumerate(matches):
        identifier = ID_RE.match(match.group(1))
        if identifier and identifier.group(1) == record_id:
            found.append((position, match))
    if len(found) != 1:
        qualifier = "missing" if not found else "duplicate"
        raise RouteError(f"{qualifier} record: {record_id}")
    position, match = found[0]
    next_h3 = matches[position + 1].start() if position + 1 < len(matches) else len(text)
    next_h2 = next((item.start() for item in H2_RE.finditer(text, match.end())), len(text))
    end = min(next_h3, next_h2)
    return match.start(), end, match.group(1), text[match.start():end].strip()


def record_section(text: str, record_start: int) -> str:
    preceding = [match for match in H2_RE.finditer(text) if match.start() < record_start]
    if not preceding:
        raise RouteError("capture record is not inside an H2 section")
    return preceding[-1].group(1)


def remove_record(text: str, start: int, end: int) -> str:
    before = text[:start].rstrip()
    after = text[end:].lstrip("\n")
    return f"{before}\n\n{after}" if after else f"{before}\n"


def append_to_section(text: str, heading: str, block: str) -> str:
    _, end = section_bounds(text, heading)
    before = text[:end].rstrip()
    after = text[end:].lstrip("\n")
    joined = f"{before}\n\n{block.strip()}\n"
    return f"{joined}\n{after}" if after else joined


def replace_record(text: str, start: int, end: int, block: str) -> str:
    before = text[:start].rstrip()
    after = text[end:].lstrip("\n")
    joined = f"{before}\n\n{block.strip()}\n"
    return f"{joined}\n{after}" if after else joined


def replace_field(block: str, name: str, value: str) -> str:
    pattern = re.compile(rf"^-\s+\*\*{re.escape(name)}:\*\*\s*.*?$", re.MULTILINE)
    replacement = f"- **{name}:** {value}"
    if not pattern.search(block):
        raise RouteError(f"record is missing field required for update: {name}")
    return pattern.sub(replacement, block, count=1)


def find_target(folder: Path, docs: dict[str, dict[str, Any]], target_id: str) -> tuple[str, str]:
    found: list[tuple[str, str]] = []
    for rel_path in docs:
        if rel_path == "CAPTURE.md":
            continue
        text = (folder / rel_path).read_text(encoding="utf-8")
        try:
            _, _, _, block = record_bounds(text, target_id)
        except RouteError as error:
            if str(error).startswith("missing record"):
                continue
            raise
        found.append((rel_path, block))
    if len(found) != 1:
        qualifier = "missing" if not found else "ambiguous"
        raise RouteError(f"{qualifier} destination record: {target_id}")
    return found[0]


def capture_tombstone(
    heading: str,
    source_fields: dict[str, str],
    status: str,
    related: str,
    outcome: str,
) -> str:
    required = ("Origin", "Type", "Source", "Summary")
    missing = [name for name in required if not source_fields.get(name)]
    if missing:
        raise RouteError(f"capture record is missing fields required for compaction: {', '.join(missing)}")
    return "\n".join(
        [
            f"### {heading}",
            "",
            f"- **Origin:** {source_fields['Origin']}",
            f"- **Type:** {source_fields['Type']}",
            f"- **Status:** {status}",
            f"- **Source:** {source_fields['Source']}",
            f"- **Summary:** {source_fields['Summary']}",
            f"- **Related:** {related}",
            f"- **Outcome:** {outcome}",
        ]
    )


def compact_capture(
    capture_text: str,
    capture_id: str,
    status: str,
    related: str,
    outcome: str,
) -> str:
    start, end, heading, block = record_bounds(capture_text, capture_id)
    current_section = record_section(capture_text, start)
    if current_section == "Routed Outcomes":
        raise RouteError(f"{capture_id} is already in Routed Outcomes")
    source_fields = fields(block)
    if source_fields.get("Status") not in {"open", "parked"}:
        raise RouteError(f"{capture_id} must be open or parked before routing")
    without = remove_record(capture_text, start, end)
    tombstone = capture_tombstone(heading, source_fields, status, related, outcome)
    return append_to_section(without, "Routed Outcomes", tombstone)


def validate_body(body: str, schema: dict[str, Any], capture_id: str) -> None:
    body_fields = fields(body)
    for name in schema.get("required_fields", []):
        if not body_fields.get(name):
            raise RouteError(f"destination body is missing required field: {name}")
    for name, allowed in schema.get("field_values", {}).items():
        value = body_fields.get(name)
        if value is not None and value not in allowed:
            raise RouteError(f"destination body has invalid {name}: {value}; allowed: {allowed}")
    if not has_id(body_fields.get("Source", ""), capture_id):
        raise RouteError(f"destination Source field must include {capture_id}")


def next_id(text: str, prefix: str) -> str:
    numbers: list[tuple[int, str]] = []
    pattern = re.compile(rf"^###\s+{re.escape(prefix)}-(\d+)\b", re.MULTILINE)
    for match in pattern.finditer(text):
        numbers.append((int(match.group(1)), match.group(1)))
    next_number = max((number for number, _ in numbers), default=0) + 1
    padded = any(raw.startswith("0") and len(raw) > 1 for _, raw in numbers) or not numbers
    suffix = f"{next_number:03d}" if padded else str(next_number)
    return f"{prefix}-{suffix}"


def route_problems(folder: Path, index: dict[str, Any]) -> list[str]:
    docs = documents(index)
    capture_text = (folder / "CAPTURE.md").read_text(encoding="utf-8")
    section_start, section_end = section_bounds(capture_text, "Routed Outcomes")
    section = capture_text[section_start:section_end]
    problems: list[str] = []
    for match in H3_RE.finditer(section):
        identifier = ID_RE.match(match.group(1))
        if not identifier:
            continue
        capture_id = identifier.group(1)
        _, _, _, block = record_bounds(capture_text, capture_id)
        record_fields = fields(block)
        if record_fields.get("Status") == "closed":
            if not record_fields.get("Outcome", "").strip():
                problems.append(f"{capture_id} is closed without Outcome")
            continue
        if record_fields.get("Status") != "routed":
            problems.append(f"{capture_id} in Routed Outcomes has status {record_fields.get('Status')}")
            continue
        targets = id_tokens(record_fields.get("Related", ""))
        if not targets:
            problems.append(f"{capture_id} is routed without a destination ID")
        for target in sorted(targets):
            try:
                _, target_block = find_target(folder, docs, target)
            except RouteError as error:
                problems.append(f"{capture_id}: {error}")
                continue
            if not has_id(fields(target_block).get("Source", ""), capture_id):
                problems.append(f"{capture_id}: destination {target} lacks Source backlink")
    return problems


def apply_changes(folder: Path, changes: dict[Path, str], dry_run: bool) -> None:
    originals = {path: path.read_text(encoding="utf-8") for path in changes}
    if dry_run:
        for path, new_text in changes.items():
            diff = difflib.unified_diff(
                originals[path].splitlines(),
                new_text.splitlines(),
                fromfile=str(path),
                tofile=str(path),
                lineterm="",
            )
            print("\n".join(diff))
        return

    try:
        for path, new_text in changes.items():
            path.write_text(new_text, encoding="utf-8")
        errors = validate(folder)
        if errors:
            raise RouteError("post-route validation failed:\n- " + "\n- ".join(errors))
        problems = route_problems(folder, load_index(folder))
        if problems:
            raise RouteError("post-route backlink validation failed:\n- " + "\n- ".join(problems))
    except Exception:
        for path, original in originals.items():
            path.write_text(original, encoding="utf-8")
        raise


def command_promote(args: argparse.Namespace, folder: Path, index: dict[str, Any]) -> None:
    docs = documents(index)
    destination = docs.get(args.to)
    if destination is None or args.to == "CAPTURE.md":
        raise RouteError(f"destination is not an indexed non-Capture document: {args.to}")
    schema = destination.get("record_schema")
    if not isinstance(schema, dict):
        raise RouteError(f"destination has no record_schema: {args.to}")
    prefixes = schema.get("id_prefixes", [])
    prefix = args.prefix
    if prefix is None:
        if len(prefixes) != 1:
            raise RouteError(f"--prefix is required; destination allows: {prefixes}")
        prefix = prefixes[0]
    if prefix not in prefixes:
        raise RouteError(f"invalid destination prefix {prefix}; allowed: {prefixes}")

    capture_path = folder / "CAPTURE.md"
    destination_path = folder / args.to
    capture_text = capture_path.read_text(encoding="utf-8")
    destination_text = destination_path.read_text(encoding="utf-8")
    body = sys.stdin.read() if args.body_file == "-" else Path(args.body_file).read_text(encoding="utf-8")
    validate_body(body, schema, args.capture_id)
    target_id = next_id(destination_text, prefix)
    destination_block = f"### {target_id} — {args.title}\n\n{body.strip()}"
    new_destination = append_to_section(destination_text, args.section, destination_block)
    outcome = args.outcome or f"Promoted to `{args.to}` as {target_id}."
    new_capture = compact_capture(
        capture_text,
        args.capture_id,
        "routed",
        f"{target_id} in {args.to}",
        outcome,
    )
    apply_changes(folder, {destination_path: new_destination, capture_path: new_capture}, args.dry_run)
    print(f"{'Would promote' if args.dry_run else 'Promoted'} {args.capture_id} -> {target_id} in {args.to}")


def command_route(args: argparse.Namespace, folder: Path, index: dict[str, Any]) -> None:
    docs = documents(index)
    destinations: list[tuple[str, str]] = []
    seen_targets: set[str] = set()
    for target in args.target:
        if target in seen_targets:
            continue
        seen_targets.add(target)
        rel_path, target_block = find_target(folder, docs, target)
        if not has_id(fields(target_block).get("Source", ""), args.capture_id):
            raise RouteError(f"destination {target} Source field must include {args.capture_id}")
        destinations.append((target, rel_path))

    capture_path = folder / "CAPTURE.md"
    capture_text = capture_path.read_text(encoding="utf-8")
    references = [f"{target} in {rel_path}" for target, rel_path in destinations]
    start, end, _, block = record_bounds(capture_text, args.capture_id)
    current_section = record_section(capture_text, start)
    if current_section == "Routed Outcomes":
        record_fields = fields(block)
        if record_fields.get("Status") != "routed":
            raise RouteError(f"{args.capture_id} is already closed and cannot receive routes")
        existing_ids = id_tokens(record_fields.get("Related", ""))
        additions = [reference for (target, _), reference in zip(destinations, references) if target not in existing_ids]
        if not additions:
            raise RouteError(f"{args.capture_id} already records every requested destination")
        existing_related = record_fields.get("Related", "").strip()
        related = ", ".join([value for value in (existing_related, *additions) if value and value != "none"])
        added_outcome = f"Added route{'s' if len(additions) != 1 else ''}: {', '.join(additions)}."
        prior_outcome = record_fields.get("Outcome", "").strip()
        outcome = args.outcome or " ".join(value for value in (prior_outcome, added_outcome) if value)
        updated = replace_field(block, "Related", related)
        updated = replace_field(updated, "Outcome", outcome)
        new_capture = replace_record(capture_text, start, end, updated)
    else:
        default_outcome = f"Routed to {', '.join(references)}."
        outcome = args.outcome or default_outcome
        new_capture = compact_capture(
            capture_text,
            args.capture_id,
            "routed",
            ", ".join(references),
            outcome,
        )
    apply_changes(folder, {capture_path: new_capture}, args.dry_run)
    print(f"{'Would route' if args.dry_run else 'Routed'} {args.capture_id} -> {', '.join(references)}")


def command_close(args: argparse.Namespace, folder: Path) -> None:
    reason = args.reason.strip()
    if not reason:
        raise RouteError("--reason must contain a non-empty closure reason")
    capture_path = folder / "CAPTURE.md"
    capture_text = capture_path.read_text(encoding="utf-8")
    new_capture = compact_capture(capture_text, args.capture_id, "closed", "none", reason)
    apply_changes(folder, {capture_path: new_capture}, args.dry_run)
    print(f"{'Would close' if args.dry_run else 'Closed'} {args.capture_id}")


def command_check(folder: Path, index: dict[str, Any]) -> None:
    errors = validate(folder)
    if errors:
        raise RouteError("index validation failed:\n- " + "\n- ".join(errors))
    problems = route_problems(folder, index)
    if problems:
        raise RouteError("route check failed:\n- " + "\n- ".join(problems))
    print("Capture route check passed")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path, help="Working-memory folder containing CAPTURE.md and index.json")
    subparsers = parser.add_subparsers(dest="command", required=True)

    promote = subparsers.add_parser("promote", help="Create a destination record and compact its Capture source")
    promote.add_argument("capture_id")
    promote.add_argument("--to", required=True, help="Indexed destination path, such as DECISIONS.md")
    promote.add_argument("--section", required=True, help="Exact destination H2 heading")
    promote.add_argument("--title", required=True, help="Destination record title")
    promote.add_argument("--body-file", required=True, help="Markdown body path, or - for stdin")
    promote.add_argument("--prefix", help="Destination ID prefix when more than one is allowed")
    promote.add_argument("--outcome", help="Capture tombstone outcome text")
    promote.add_argument("--dry-run", action="store_true")

    route = subparsers.add_parser("route", help="Compact a Capture source after a destination already exists")
    route.add_argument("capture_id")
    route.add_argument(
        "--target",
        action="append",
        required=True,
        help="Existing non-Capture destination record ID; repeat for multiple destinations",
    )
    route.add_argument("--outcome", help="Capture tombstone outcome text")
    route.add_argument("--dry-run", action="store_true")

    close = subparsers.add_parser("close", help="Close a Capture thread without promotion")
    close.add_argument("capture_id")
    close.add_argument("--reason", required=True)
    close.add_argument("--dry-run", action="store_true")

    subparsers.add_parser("check", help="Validate routed backlinks and closed outcomes")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    folder = args.folder.expanduser().resolve()
    if not folder.is_dir():
        print(f"ERROR: folder does not exist: {folder}", file=sys.stderr)
        return 2
    try:
        index = load_index(folder)
        if args.command == "promote":
            command_promote(args, folder, index)
        elif args.command == "route":
            command_route(args, folder, index)
        elif args.command == "close":
            command_close(args, folder)
        else:
            command_check(folder, index)
    except (OSError, RouteError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
