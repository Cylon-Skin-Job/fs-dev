# Provenance Schema Cross-Article Findings

**Date:** 2026-07-15
**Source:** Manual comparison pass across `Wiki/010-Events_And_Ledger/003-Provenance_Model/` (core page + 8 schema legs).
**Status:** Active issue log. Staged as input for document correction and follow-up owner decisions. Each finding is tagged **[decision]** (owner must call it) or **[mechanical]** (doc fix, no new decision).

**Correction authority:** This comparison pass plus owner direction in chat on 2026-07-15. The owner directed the planning set, other misleading Markdown guidance, and affected wiki pages to be corrected from these findings; directed that new or unresolved choices be added here instead of assumed; and set the end goal as one composable schema that favors reusable shared blocks and registered extensions over parallel domain vocabularies.

**Application rule:** Mechanical corrections may proceed immediately. Decision findings remain blockers until the owner selects a branch or gives an equivalent explicit contract. Document edits may make an unresolved boundary explicit and remove accidental claims that a candidate is settled, but they must not silently settle the product behavior.

**Overall:** envelope discipline held up — no enum redefined anywhere, cause-ID block membership identical in all three occurrences, all used `eventFamily` values registered, no second status fields, decision-gate cross-references (CHAT-D01, TOOL-D01/D02, AUT-D01/02/03, LED-D02/03/04, AUD-D01, ULV-D10/D12) coherent. Findings below are residuals.

## 1. [decision] Subtype automation cause IDs — settled vs candidate contradiction

Core envelope lists `cause.triggerRunId` / `schedulerRunId` / `scriptRunId` / `agentRunId` as unconditional members (`PAGE.md:126-131`); Automation page says subtype IDs "remain D03 candidates" (`006:76`). Also asymmetric: `automation.runId` + `kind` is the settled common identity across all seven kinds, yet only four kinds get dedicated cause fields (sync/import/system don't).
**Options:** collapse cause block to `automationRunId` (+kind lookup), or keep subtypes and add the D03-candidate caveat to the core envelope.

## 2. [mechanical] `ids.serverMutationId` is an orphan

In the core envelope (`PAGE.md:94`) but in no schema leg, no sub-article `ids`, and absent from the core page's own Identity Mapping table. No documented generator or consumer.
**Fix:** either assign it to the unwritten `workspace`/`view` legs explicitly, or delete it.

## 3. [decision] Two vocabularies for captured execution output

Automation: `resultHash`/`resultBytes`/`resultTruncated` (`006:64-66`) with its own open serialization/encoding/truncation decision list. Tool: `hashOmissions.{args,output}` + TOOL-D01 byte/truncation/external-storage metadata (`002:73-78,116`). Same concern, parallel fields, two owner decisions re-deciding identical questions.
**Option:** one shared captured-output block (hash, bytes, truncated, redaction status) adopted by both legs; collapses a whole decision surface.

## 4. [decision] Three resource-bucketing conventions

Envelope `resources[]` has `role`; Tool adds `toolResources` verb buckets (`declaredTargets/read/written/deleted/renamed/returned`); Chat adds `chatResources` category buckets (`attachments/mentions/mutations`). Verb vocabulary is consistent between Tool and Chat summaries (good), but the relationship to `resources[].role` is undocumented, and the core page's "add their own payload under **a** domain key" (`PAGE.md:66`) doesn't bless multi-key legs (`chat` + `chatResources` + `tools`).
**Options:** amend core page to define the sidecar-bucket pattern + shared verb vocabulary, or fold buckets into `resources[].role`.

## 5. [decision] Hash policy gap: Resource vs File Version

Resource mandates all concrete hash fields absent, `policy_unapproved` (`003:70`). File Version's first branch is "live-only 40b2d1 **metadata/hash-only**" (`005:32`) and lists `contentHashBefore/After` with no omission caveat (`005:59-62`). Readable as contradiction.
**Fix if intentional:** one line on the File Version page stating versions carry hashes under a separately approved ULV policy while resource events omit theirs.

## 6. [mechanical] `fileVersionIds` asserted unevenly

Resource explicitly excludes `resourceMutation.fileVersionIds` from the first package (`003:70`); Chat (`001:163`) and Tool (`002:80`) include `fileVersionIds: []` with no equivalent caveat. Same field, three confidence levels — add matching caveats.

## 7. [mechanical] Projection-naming rule is undocumented

Chat's compact mutation entries use `causeIds` — same eleven members as `provenance.cause`, different key (`001:186-198`). Legit as compact projection, but the projection convention is only documented for tool names. Add one generalizing sentence to the core page.

## 8. [decision] `chat.hasToolCalls` derivation vs redaction-surviving summary

`chat.hasToolCalls` is derivable from `tools[]`, but the current articles do not say whether it is only a convenience projection or is intentionally retained when `tools[]` is redacted/omitted.
**Options:** define it as a registered pure derivation that is absent whenever its source is unavailable, or define an independently retained redaction-safe summary with an exact presence/trust rule under CHAT-D01.

## 9. [decision] Sync loop prevention cannot depend on optional provenance

`Captures/001-Captures/machine-sync-sharing-model.md` correctly requires a transactional outbox because UEB/provenance delivery is fail-open, but it previously claimed honest provenance attribution prevents remote rebroadcast loops. A successfully applied remote mutation can omit provenance, so attribution cannot be the operational correctness key.
**Required decision before sync implementation:** define a fail-closed, idempotent remote-operation/source identity contract owned by the transactional sync path, including generation/ownership, persistence in the same operation/outbox transaction, replay/retry/dedupe behavior, restart retention, conflict handling, and how canonical provenance may mirror that identity without becoming the authorization or loop-prevention gate.

## Process note

Findings 1, 5, 6 are invisible from any single article — they only surface holding the envelope page plus two legs in context simultaneously. That's the argument for clean-context sub-agents fed the full file set, per the audit-loop process.

## Resolution log

- 2026-07-15: Owner directed corrections across guidance, roadmap/SPECs, and affected wikis, with unresolved choices retained in this file rather than inferred.
- 2026-07-15: Owner established schema unification and composability as the governing design goal. This narrows recommendations but does not by itself choose among materially different identity, storage, redaction, or compatibility branches.
- 2026-07-15: Finding 2 was mechanically resolved from existing SPEC-32/SPEC-34 authority: `ids.serverMutationId` belongs to the server-produced resource-mutation branch, is required/generated or propagated there, is prohibited on watcher facts, and is not a generic workspace/view lifecycle ID. The map, registry SPEC, core wiki, resource leg, and durable decisions now state that rule.
- 2026-07-15: Finding 6 was mechanically propagated: domain `fileVersionIds` projections are absent until the owning file-version relationship schema, accepted-reference binding, bounds, and registration are approved; empty example arrays provide no authority.
- 2026-07-15: Finding 7 was mechanically resolved: compact aliases such as `causeIds` require a registered projection with exact source pointers, member equivalence, presence, proof, and redaction rules and never create a second identity vocabulary.
- Pending: findings 1, 3, 4, 5, 8, and 9 still require an explicit owner decision unless the authoritative planning set already supplies one unambiguous branch and the cross-document review confirms it.
