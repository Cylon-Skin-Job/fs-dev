# Durable record authority and schema

## Authority and concurrency

Local AGENTS.md and index.json define the working folder. Explicit owner choices belong in decisions; verified actionable problems in issues; candidate actions in proposals; exploratory unknowns and unendorsed possibilities remain in conversational memory. A documented missing intent gap may be an issue under the local contract without implying a product defect or inventing its answer. Do not strengthen tentative language or turn research facts into product choices.

Preserve attribution, source revisions, IDs and unresolved contradictions. Side chats use their live assignment as write scope and sign as ephemeral when appropriate. The parent UUID is a history address, not the side chat's identity. Re-read before writes and coordinate overlapping writers; a bulletin is advisory coordination, not approval or message delivery.

## Schema growth

Use the existing local document roles. Add an extension only when substantive content exists and its authority, purpose or lifecycle cannot be held clearly by an existing document. Keep H2 headings as indexed sections and prefer H3 stable-ID records below them. Preserve a prior schema rather than forcing generic filenames. Reconcile document, local instruction and index changes together.

## Structure Categories and Records

- Use the H1 for document identity and a leading blockquote for its authority boundary.
- Use indexed H2 headings for stable categories or document facets.
- Use H3 headings for individual records so additions do not require `index.json` edits.
- Keep document authority, subject category, record type, action, severity, and lifecycle status as separate axes.
- Use neutral stable IDs that do not encode mutable category, action, or status. Prefer zero-padded new IDs such as `D-001`, `I-001`, `P-001`, `W-001`, and `B-001`; never renumber existing IDs.
- Preserve searchable aliases when an explicitly authorized migration changes an ID family.
- Put exploratory unknowns in capture/context. Put sourced actionable problems and consequential ambiguity, missing intent or interpretation drift in issues; document the actual uncertainty and affected decision without inventing a defect or answer. Post a question to the bulletin only when the bulletin threshold is met.
- When `index.json` declares a `record_schema`, follow its heading level, ID prefixes, required fields, and allowed field values.
- For conversational-memory captures, prefer neutral `CAP-NNN` records with separate origin, type, and status fields. A useful minimal lifecycle is `open`, `parked`, `routed`, and `closed`.

## Promote and Compact Capture Records

Treat promotion as a bounded transaction:

1. Confirm the destination document and section are registered in `index.json`.
2. Confirm the destination threshold is satisfied: explicit owner choice for decisions, verified actionable problem for issues, candidate action for proposals, or the local equivalent for another document.
3. Create or verify the destination record with `Source: CAP-NNN` while preserving the destination's own required fields and authority boundary.
4. Move the source record from its active CAPTURE section to `Routed Outcomes`, retain the same `CAP-NNN`, set `Status: routed`, and link every destination ID.
5. Run both the index validator and the route backlink check.

The helper supports four operations:

```bash
# Create a destination record from curator-supplied Markdown, allocate its ID,
# and compact the Capture source in one validated operation.
python3 <skill-folder>/scripts/route_capture.py <folder> promote CAP-001 \
  --to DECISIONS.md --section "Process and Schema" --title "Decision title" \
  --body-file /path/to/destination-body.md

# Compact a Capture source after already-written destinations backlink to it.
# Repeat --target to preserve every destination; later calls may append new routes.
python3 <skill-folder>/scripts/route_capture.py <folder> route CAP-001 \
  --target D-001 --target P-001

# Close without promotion, preserving the reason.
python3 <skill-folder>/scripts/route_capture.py <folder> close CAP-001 --reason "Reason"

# Validate routed targets and their Source backlinks.
python3 <skill-folder>/scripts/route_capture.py <folder> check
```

Use `--dry-run` with `promote`, `route`, or `close` to inspect the proposed Markdown changes. The promotion body must satisfy the destination's indexed record schema and explicitly include the Capture ID in its `Source` field.


## `index.json` Contract

Keep the index as static routing metadata, not a copy of document content and not a live lock/status ledger.

Required top-level fields:

- `schema_version`: integer, currently `2`; the validator continues to accept legacy version `1` indexes.
- `name`: human-readable folder name.
- `description`: one-sentence purpose.
- `documents`: ordered document records.

Recommended context fields:

- `repository_root`: relative path from the working folder.
- `wiki_root`: relative path from the working folder.
- `workflow`: ordered lifecycle labels.
- `support_files`: records for `AGENTS.md`, `index.json`, `BULLETIN.md`, and other routing infrastructure. Markdown support files may include indexed `sections` using the same section-record shape as content documents.

Each document record contains:

- `path`: path relative to the working folder.
- `kind`: stable machine-readable role defined by the folder's schema.
- `authority`: the document's declared authority level, commonly owner, evidence, context, proposal, analysis, or draft.
- `description`: one sentence describing what belongs there.
- `lifecycle`: static phrase describing how the document normally evolves in schema version `2`.
- `read_before`: registered document paths required before editing.
- `sections`: ordered records with `key`, exact `heading` text without the `##` prefix, and a one-sentence `description`.

Documents and Markdown support files may declare a static `record_schema` containing:

- `heading_level`: the Markdown level used for individual records, normally `3`.
- `id_prefixes`: allowed neutral identifier prefixes.
- `required_fields`: bold-label record fields that every record must contain.
- `field_values`: optional allowed values for stable category, status, type, severity, or action vocabularies.

Do not store changing issue text, decisions, proposal states, chat ownership, or completion status in the index. Store only the static allowed schema; put content in Markdown and volatile coordination in `BULLETIN.md`.

