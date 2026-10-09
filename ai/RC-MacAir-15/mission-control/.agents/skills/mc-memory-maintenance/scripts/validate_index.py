#!/usr/bin/env python3
"""Validate a working-memory index against its working folder."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


H2_PATTERN = re.compile(r"^##\s+(.+?)\s*$")
FIELD_PATTERN = re.compile(r"^-\s+\*\*([^*]+):\*\*\s*(.*?)\s*$")


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ValueError(f"missing index: {path}") from None
    except json.JSONDecodeError as error:
        raise ValueError(
            f"invalid JSON in {path}: line {error.lineno}, column {error.colno}: {error.msg}"
        ) from None
    if not isinstance(value, dict):
        raise ValueError("index root must be a JSON object")
    return value


def markdown_h2s(path: Path) -> list[str]:
    headings: list[str] = []
    fence: str | None = None

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.lstrip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            marker = stripped[:3]
            if fence is None:
                fence = marker
            elif fence == marker:
                fence = None
            continue
        if fence is not None:
            continue
        match = H2_PATTERN.match(line)
        if match:
            headings.append(match.group(1))

    return headings


def markdown_records(path: Path, heading_level: int) -> list[tuple[str, dict[str, str]]]:
    heading_pattern = re.compile(rf"^{'#' * heading_level}\s+(.+?)\s*$")
    records: list[tuple[str, dict[str, str]]] = []
    current_heading: str | None = None
    current_fields: dict[str, str] = {}
    fence: str | None = None

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.lstrip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            marker = stripped[:3]
            if fence is None:
                fence = marker
            elif fence == marker:
                fence = None
            continue
        if fence is not None:
            continue

        heading = heading_pattern.match(line)
        if heading:
            if current_heading is not None:
                records.append((current_heading, current_fields))
            current_heading = heading.group(1)
            current_fields = {}
            continue

        any_heading = re.match(r"^(#{1,6})\s+", line)
        if current_heading is not None and any_heading and len(any_heading.group(1)) <= heading_level:
            records.append((current_heading, current_fields))
            current_heading = None
            current_fields = {}
            continue

        if current_heading is not None:
            field = FIELD_PATTERN.match(line)
            if field:
                current_fields[field.group(1)] = field.group(2)

    if current_heading is not None:
        records.append((current_heading, current_fields))
    return records


def require_string(record: dict[str, Any], field: str, label: str, errors: list[str]) -> str | None:
    value = record.get(field)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label}.{field} must be a non-empty string")
        return None
    return value


def validate_record_schema(
    record: dict[str, Any], markdown_path: Path, label: str, errors: list[str]
) -> None:
    schema = record.get("record_schema")
    if schema is None:
        return
    if not isinstance(schema, dict):
        errors.append(f"{label}.record_schema must be an object")
        return

    heading_level = schema.get("heading_level")
    if not isinstance(heading_level, int) or not 2 <= heading_level <= 6:
        errors.append(f"{label}.record_schema.heading_level must be an integer from 2 to 6")
        return

    prefixes = schema.get("id_prefixes")
    if (
        not isinstance(prefixes, list)
        or not prefixes
        or any(not isinstance(value, str) or not re.fullmatch(r"[A-Z][A-Z0-9]*", value) for value in prefixes)
        or len(prefixes) != len(set(prefixes))
    ):
        errors.append(
            f"{label}.record_schema.id_prefixes must be unique uppercase identifier prefixes"
        )
        return

    required_fields = schema.get("required_fields", [])
    if (
        not isinstance(required_fields, list)
        or any(not isinstance(value, str) or not value.strip() for value in required_fields)
        or len(required_fields) != len(set(required_fields))
    ):
        errors.append(f"{label}.record_schema.required_fields must be unique non-empty strings")
        return

    field_values = schema.get("field_values", {})
    if not isinstance(field_values, dict):
        errors.append(f"{label}.record_schema.field_values must be an object")
        return
    for field_name, allowed in field_values.items():
        if (
            not isinstance(field_name, str)
            or not field_name.strip()
            or not isinstance(allowed, list)
            or not allowed
            or any(not isinstance(value, str) or not value.strip() for value in allowed)
            or len(allowed) != len(set(allowed))
        ):
            errors.append(
                f"{label}.record_schema.field_values.{field_name} must be unique non-empty strings"
            )

    if not markdown_path.is_file() or markdown_path.suffix.lower() != ".md":
        return

    prefix_pattern = "|".join(re.escape(prefix) for prefix in prefixes)
    id_pattern = re.compile(rf"^((?:{prefix_pattern})-\d+)\b")
    seen_ids: set[str] = set()
    records = markdown_records(markdown_path, heading_level)
    for heading, fields in records:
        match = id_pattern.match(heading)
        if not match:
            errors.append(
                f"{label} record heading must start with one of {prefixes} plus a number: {heading}"
            )
            continue
        record_id = match.group(1)
        if record_id in seen_ids:
            errors.append(f"{label} has duplicate record id: {record_id}")
        seen_ids.add(record_id)

        for field_name in required_fields:
            if not fields.get(field_name, "").strip():
                errors.append(f"{label} record {record_id} is missing field: {field_name}")
        for field_name, allowed in field_values.items():
            value = fields.get(field_name)
            if value is not None and value not in allowed:
                errors.append(
                    f"{label} record {record_id} has invalid {field_name}: {value}; allowed: {allowed}"
                )


def validate(folder: Path) -> list[str]:
    errors: list[str] = []
    index_path = folder / "index.json"

    try:
        index = load_json(index_path)
    except ValueError as error:
        return [str(error)]

    schema_version = index.get("schema_version")
    if schema_version not in (1, 2):
        errors.append("schema_version must be 1 or 2")
    require_string(index, "name", "index", errors)
    require_string(index, "description", "index", errors)

    for root_field in ("repository_root", "wiki_root"):
        root_value = index.get(root_field)
        if root_value is not None:
            if not isinstance(root_value, str) or not root_value.strip():
                errors.append(f"{root_field} must be a non-empty string when present")
            elif not (folder / root_value).resolve().exists():
                errors.append(f"{root_field} does not resolve to an existing path: {root_value}")

    support_files = index.get("support_files", [])
    if not isinstance(support_files, list):
        errors.append("support_files must be an array when present")
    else:
        for position, record in enumerate(support_files):
            label = f"support_files[{position}]"
            if not isinstance(record, dict):
                errors.append(f"{label} must be an object")
                continue
            rel_path = require_string(record, "path", label, errors)
            require_string(record, "description", label, errors)
            if not rel_path:
                continue
            support_path = folder / rel_path
            if not support_path.is_file():
                errors.append(f"{label}.path does not exist: {rel_path}")
                continue

            validate_record_schema(record, support_path, label, errors)

            sections = record.get("sections")
            if sections is None:
                continue
            if support_path.suffix.lower() != ".md":
                errors.append(f"{label}.sections may only index a Markdown support file")
                continue
            if not isinstance(sections, list):
                errors.append(f"{label}.sections must be an array when present")
                continue

            indexed_headings: list[str] = []
            keys: set[str] = set()
            for section_position, section in enumerate(sections):
                section_label = f"{label}.sections[{section_position}]"
                if not isinstance(section, dict):
                    errors.append(f"{section_label} must be an object")
                    continue
                key = require_string(section, "key", section_label, errors)
                heading = require_string(section, "heading", section_label, errors)
                require_string(section, "description", section_label, errors)
                if key:
                    if key in keys:
                        errors.append(f"{label} has duplicate section key: {key}")
                    keys.add(key)
                if heading:
                    indexed_headings.append(heading)

            actual_headings = markdown_h2s(support_path)
            if indexed_headings != actual_headings:
                errors.append(
                    f"support file {rel_path} section mismatch\n"
                    f"  indexed: {json.dumps(indexed_headings, ensure_ascii=False)}\n"
                    f"  actual:  {json.dumps(actual_headings, ensure_ascii=False)}"
                )

    documents = index.get("documents")
    if not isinstance(documents, list) or not documents:
        errors.append("documents must be a non-empty array")
        return errors

    registered_paths: set[str] = set()
    parsed_documents: list[tuple[str, dict[str, Any]]] = []

    for position, document in enumerate(documents):
        label = f"documents[{position}]"
        if not isinstance(document, dict):
            errors.append(f"{label} must be an object")
            continue

        rel_path = require_string(document, "path", label, errors)
        require_string(document, "kind", label, errors)
        require_string(document, "authority", label, errors)
        require_string(document, "description", label, errors)
        if schema_version == 2:
            require_string(document, "lifecycle", label, errors)
        if not rel_path:
            continue
        if rel_path in registered_paths:
            errors.append(f"duplicate document path: {rel_path}")
        registered_paths.add(rel_path)
        parsed_documents.append((rel_path, document))

    for rel_path, document in parsed_documents:
        label = f"document {rel_path}"
        doc_path = folder / rel_path
        if not doc_path.is_file():
            errors.append(f"{label} does not exist")
            continue
        if doc_path.suffix.lower() != ".md":
            errors.append(f"{label} must be a Markdown file")

        validate_record_schema(document, doc_path, label, errors)

        read_before = document.get("read_before", [])
        if not isinstance(read_before, list) or any(not isinstance(item, str) for item in read_before):
            errors.append(f"{label}.read_before must be an array of document paths")
        else:
            for dependency in read_before:
                if dependency not in registered_paths:
                    errors.append(f"{label}.read_before references an unregistered document: {dependency}")
                if dependency == rel_path:
                    errors.append(f"{label}.read_before cannot reference itself")

        sections = document.get("sections")
        if not isinstance(sections, list):
            errors.append(f"{label}.sections must be an array")
            continue

        indexed_headings: list[str] = []
        keys: set[str] = set()
        for position, section in enumerate(sections):
            section_label = f"{label}.sections[{position}]"
            if not isinstance(section, dict):
                errors.append(f"{section_label} must be an object")
                continue
            key = require_string(section, "key", section_label, errors)
            heading = require_string(section, "heading", section_label, errors)
            require_string(section, "description", section_label, errors)
            if key:
                if key in keys:
                    errors.append(f"{label} has duplicate section key: {key}")
                keys.add(key)
            if heading:
                indexed_headings.append(heading)

        actual_headings = markdown_h2s(doc_path)
        if indexed_headings != actual_headings:
            errors.append(
                f"{label} section mismatch\n"
                f"  indexed: {json.dumps(indexed_headings, ensure_ascii=False)}\n"
                f"  actual:  {json.dumps(actual_headings, ensure_ascii=False)}"
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path, help="Working-memory working folder containing index.json")
    args = parser.parse_args()

    folder = args.folder.expanduser().resolve()
    if not folder.is_dir():
        print(f"ERROR: folder does not exist: {folder}", file=sys.stderr)
        return 2

    errors = validate(folder)
    if errors:
        print(f"Working-memory validation failed for {folder}:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    index = load_json(folder / "index.json")
    print(
        f"Working-memory validation passed: {len(index['documents'])} documents in {folder}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
