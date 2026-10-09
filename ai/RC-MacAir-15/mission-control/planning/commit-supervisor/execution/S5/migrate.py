"""One assigned S5 route cutover; guarded by captured full preimages."""
from pathlib import Path
import datetime
import hashlib
import json
import stat

C = Path(__file__).resolve().parents[4]
E = Path(__file__).resolve().parent
records = json.loads((E / 'preimages.json').read_text())
for rel in ['review-and-merge-design.md', 'review-and-merge-handoff.md']:
    p = C / rel
    b = p.read_bytes()
    out = E / 'preimages' / rel
    out.write_bytes(b)
    records.append(dict(path=str(p), relative=rel, sha256=hashlib.sha256(b).hexdigest(),
                        mode=stat.S_IMODE(p.stat().st_mode), preimage=str(out), bytes=len(b)))
(E / 'preimages.json').write_text(json.dumps(records, indent=2) + '\n')
by_path = {x['relative']: x for x in records}

def update(rel, transform):
    p = C / rel
    before = p.read_bytes()
    record = by_path[rel]
    assert hashlib.sha256(before).hexdigest() == record['sha256'], f'Concurrent bytes: {rel}'
    assert stat.S_IMODE(p.stat().st_mode) == record['mode'], f'Concurrent mode: {rel}'
    after = transform(before.decode()).encode()
    assert p.read_bytes() == before, f'Concurrent prewrite: {rel}'
    p.write_bytes(after)

def replace(text, old, new):
    assert old in text, old
    return text.replace(old, new)

now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
stamp = f'Recorded by Codex side chat (ephemeral), {now}. '

def agents(t):
    t = replace(t, 'Separate same-folder sessions handle Review and Merge', 'Separate same-folder sessions handle Commit Supervisor integration')
    t = replace(t, 'Its replacement `mc-commit-supervisor` entry/profile and subordinate orchestration are specified by [the workflow SPEC](planning/commit-supervisor/SPEC.md); the currently installed legacy identifiers below remain until that migration is implemented. This naming decision does not activate the job or approve implementation/publication.', 'The sole current entry/profile is `mc-commit-supervisor`, with `mc-code-review-orchestrator` and `mc-commit-repair-worker` under [the workflow SPEC](planning/commit-supervisor/SPEC.md). S5 installs the routes; isolated behavioral rehearsal remains pending. Installation does not activate a job or approve publication.')
    t = t.replace('owner report or Review and Merge handoff', 'owner report or Commit Supervisor handoff')
    t = replace(t, '- Review and Merge follows `.agents/skills/mc-review-and-merge/SKILL.md`. It prepares a candidate and ends in `waiting-owner` before committing or pushing.', '- Commit Supervisor follows `.agents/skills/mc-commit-supervisor/SKILL.md`. It prepares an accepted integration candidate through fresh review/repair, Wiki and actual runtime handoff, then returns `COMMIT_READY_WAITING_OWNER` and ends in `waiting-owner` before any commit-producing operation or publication.')
    t = t.replace('Review and Merge sessions own', 'Commit Supervisor sessions own')
    t = t.replace('same-folder Review and Merge tasks', 'same-folder Commit Supervisor tasks')
    return t
update('AGENTS.md', agents)

def session(t):
    t = t.replace('same-folder Review and Merge tasks', 'same-folder Commit Supervisor tasks')
    t = replace(t, 'Review and Merge returns `waiting-owner`;', 'Commit Supervisor loads `.agents/skills/mc-commit-supervisor/SKILL.md`, uses its shared workflow and returns `COMMIT_READY_WAITING_OWNER` in `waiting-owner`;')
    marker = 'Preserve the invoking root model/effort.'
    t = replace(t, marker, 'Integration roles use `mc-commit-supervisor`, `mc-code-review-orchestrator` and `mc-commit-repair-worker`. Verify supported runtime names and actual loading; when a new name is unavailable, use a supported default agent with explicit exact absolute skill/session/workflow paths and record the fallback acknowledgment. Never invent persistent-task API fields such as `profile`. A task prompt names the procedure; a profile does not bind CWD.\n\n' + marker)
    return t
update('session-contract.md', session)

for rel in ['.agents/skills/mission-control/SKILL.md', '.agents/skills/monitor/SKILL.md', '.agents/skills/status/references/report-format.md', '.agents/skills/mc-roadmap-implementation-supervisor/SKILL.md']:
    def caller(t):
        t = t.replace('Review and Merge', 'Commit Supervisor').replace('mc-review-and-merge', 'mc-commit-supervisor')
        if rel == '.agents/skills/mission-control/SKILL.md':
            t = replace(t, 'Verify returned identity and startup CWD;', 'Use only documented task API fields: put exact skill paths in the prompt, never an invented `profile` argument. The assigned supervisor verifies supported runtime role names and records explicit-skill default-agent fallback when necessary. Verify returned identity and startup CWD;')
            t = replace(t, '**stop before commit/push and wait for the owner**', '**complete current review/Wiki/runtime gates, return `COMMIT_READY_WAITING_OWNER`, then stop before any commit-producing operation/publication and wait for the owner**')
        return t
    update(rel, caller)

def charter(t):
    t = t.replace('Separate same-folder Review and Merge tasks', 'Separate same-folder Commit Supervisor tasks')
    t = t.replace('current Mission Control/Review and Merge skills', 'current Mission Control/Commit Supervisor skills')
    t = replace(t, 'D-021/D-023 keep the general assistant default, explicitly establish Mission Control and name the integration task Review and Merge.', 'D-021/D-023 keep the general assistant default and explicitly establish Mission Control; D-024 names the integration role Commit Supervisor (historical alias: Review and Merge).')
    t = t.replace('local Mission Control, Status, Monitor and Review and Merge definitions', 'local Mission Control, Status, Monitor and Commit Supervisor definitions')
    return t
update('mission-control.md', charter)

def templates(t):
    t = replace(t, '## Investigation packets', 'For an accepted integration assignment, use [Commit Supervisor job records](.agents/skills/mc-commit-supervisor/references/job-template.md) and its [owner gate](.agents/skills/mc-commit-supervisor/references/owner-publication.md). The packet carries stopped-cycle evidence when MC assigns, source/target/input deduplication, accepted prerequisite release conditions, exact recovery identity, independent handoff/final gates and actual runtime proof. `COMMIT_READY_WAITING_OWNER` ends the turn; operation-specific owner approval and distinct landing/adoption/Alpha receipts remain separate.\n\n## Investigation packets')
    return t
update('record-templates.md', templates)

def config(t):
    return replace(t, '[agents.mc-review-and-merge]\ndescription = "Prepare and evaluate completed-build integration, then wait for owner commit/push approval."\nconfig_file = "agents/mc-review-and-merge.toml"', '[agents.mc-commit-supervisor]\ndescription = "Prepare an accepted integration unit through review and runtime handoff, then wait for owner operation approval."\nconfig_file = "agents/mc-commit-supervisor.toml"\n\n[agents.mc-code-review-orchestrator]\ndescription = "Coordinate independent initial/final code review for an assigned integration candidate."\nconfig_file = "agents/mc-code-review-orchestrator.toml"\n\n[agents.mc-commit-repair-worker]\ndescription = "Repair bounded validated integration findings and return for independent handoff review."\nconfig_file = "agents/mc-commit-repair-worker.toml"')
update('.codex/config.toml', config)

def deployment(t):
    t = t.replace('Review and Merge dispatch remains MC-owned', 'Commit Supervisor dispatch remains MC-owned')
    t = replace(t, '| `mc-review-and-merge` | [SKILL.md](.agents/skills/mc-review-and-merge/SKILL.md) |', '| `mc-commit-supervisor` | [SKILL.md](.agents/skills/mc-commit-supervisor/SKILL.md) |\n| `mc-code-review-orchestrator` | [SKILL.md](.agents/skills/mc-code-review-orchestrator/SKILL.md) |\n| `mc-commit-repair-worker` | [SKILL.md](.agents/skills/mc-commit-repair-worker/SKILL.md) |')
    t = replace(t, '| `mc-review-and-merge` | [TOML](.codex/agents/mc-review-and-merge.toml) | mc-review-and-merge |', '| `mc-commit-supervisor` | [TOML](.codex/agents/mc-commit-supervisor.toml) | mc-commit-supervisor |\n| `mc-code-review-orchestrator` | [TOML](.codex/agents/mc-code-review-orchestrator.toml) | mc-code-review-orchestrator |\n| `mc-commit-repair-worker` | [TOML](.codex/agents/mc-commit-repair-worker.toml) | mc-commit-repair-worker |')
    t = replace(t, 'D-021 now installs the narrowed integration role as Review and Merge; behavioral evaluation remains unexercised.', 'D-024/S5 now installs Commit Supervisor and its two subordinate roles; actual isolated workflow/recovery rehearsal remains S6 work. The historical D-021 installation account below is retained as provenance.')
    t = replace(t, 'now maps ten distinct `mc-` profile names. There are twenty local skills', 'now maps twelve distinct `mc-` profile names. There are twenty-two local skills')
    t = replace(t, '## Validation and remaining runtime checks\n', '## Validation and remaining runtime checks\n\n' + stamp + 'S5 installs the sole canonical [Commit Supervisor entry](.agents/skills/mc-commit-supervisor/SKILL.md), twelve profile mappings and active caller routes under the [owner implementation assignment](planning/commit-supervisor/execution/approval-receipt.md). Legacy `mc-review-and-merge` discovery/profile is retired after the [cutover inventory](planning/commit-supervisor/execution/S5/cutover-inventory.json) found no registered/live legacy job or matching schedule. Complete old entry/profile bytes remain in bounded execution preimages outside discovery. MC-T09 is **installed; isolated rehearsal pending**, not complete. Static/current checks and the S5 builder gate are recorded in [the builder packet](planning/commit-supervisor/execution/S5-builder.md); actual runtime role loading, full fresh agent chain, app handoff and recovery behavior are S6 requirements. No operational MC, persistent task, schedule, publication or Alpha action is created by this installation.\n\n')
    return t
update('deployment.md', deployment)

def inventory(t):
    return replace(t, '## Scope and status', stamp + 'S5 replaces the discoverable historical `mc-review-and-merge` entry/profile with [mc-commit-supervisor](.agents/skills/mc-commit-supervisor/SKILL.md), registering [initial/final review orchestration](.agents/skills/mc-code-review-orchestrator/SKILL.md) and [bounded leaf repair](.agents/skills/mc-commit-repair-worker/SKILL.md). Current installation is twenty-two local skills/twelve profiles; earlier counts below remain dated inventory. The supervisor owns separate fresh worker/Wiki handoff gates and terminal owner wait; runtime rehearsal remains S6. See [deployment](deployment.md) and [shared workflow](.agents/skills/mc-commit-supervisor/references/workflow.md).\n\n## Scope and status')
update('skills-and-agents.md', inventory)

def handoff(t):
    t = replace(t, '## Current state\n', '## Current state\n\n### S5 — Canonical Commit Supervisor installed; rehearsal pending\n\n' + stamp + '[Owner-approved S1–S5 setup](planning/commit-supervisor/execution/approval-receipt.md) installs the sole [mc-commit-supervisor entry](.agents/skills/mc-commit-supervisor/SKILL.md) and subordinate review/repair routes. Historical Review and Merge names below describe earlier events. [Cutover evidence](planning/commit-supervisor/execution/S5/cutover-inventory.json) found no legacy job/writer/schedule needing transfer; no job IDs or intentional waits were renamed/restarted. [S5 report](planning/commit-supervisor/execution/S5-builder.md) is the setup evidence pointer. MC-T09 remains **installed; isolated rehearsal pending**. No operational MC role/timer, integration job, publication, acceptance cursor or Alpha action is created.\n\n')
    marker = '### Commit Supervisor SPEC — D-024\n'
    t = replace(t, marker, marker + '\nCurrent continuation: the assigned SPEC orchestrator accepts the current S5 packet, then performs approved S6 fixture preparation and isolated agent/runtime/recovery rehearsal. Use [execution ledger](planning/commit-supervisor/execution/slice-ledger.json) for accepted current revisions; setup acceptance does not approve any future integration candidate or Git operation. Earlier planning/creation paragraphs below retain their dates/provenance and no longer select the installed route.\n')
    return t
update('handoff.md', handoff)

def todo(t):
    t = t.replace('D-021 retains same-folder Review and Merge dispatch', 'D-021/D-024 retain same-folder Commit Supervisor dispatch')
    t = replace(t, '### MC-T09 — Build the Commit Supervisor\n', '### MC-T09 — Build the Commit Supervisor\n\n- **Current S5 state:** installed; isolated rehearsal pending. ' + stamp + '[Canonical entry/profile and active routes](deployment.md) replace historical `mc-review-and-merge`; [owner assignment](planning/commit-supervisor/execution/approval-receipt.md) authorizes S1–S6 setup/rehearsal. [Current execution evidence](planning/commit-supervisor/execution/S5-builder.md) does not complete MC-T09. S6 owns actual independent role/app/recovery rehearsal and final completion evidence.\n')
    t = t.replace('- **D-021/D-023 status:** `mc-review-and-merge`', '- **Historical D-021/D-023 installation:** `mc-review-and-merge`')
    return t
update('todo.md', todo)

def registry(t):
    t = t.replace('Review and Merge tasks return job reports', 'Commit Supervisor tasks return job reports')
    t = replace(t, '[Review and Merge](.agents/skills/mc-review-and-merge/SKILL.md) installed under D-023; runtime exercise pending.', '[Commit Supervisor](.agents/skills/mc-commit-supervisor/SKILL.md) installed under D-024/S5; isolated rehearsal pending. Historical Review and Merge is a searchable alias, not an active entry.')
    t = replace(t, 'reviewed SPEC ready to assign; implementation/rehearsal pending', 'installed; isolated rehearsal pending')
    t = replace(t, 'Replacement-role implementation and isolated rehearsal remain required.', 'S5 canonical entry/three integration-role mappings and active routes are installed; [setup report](planning/commit-supervisor/execution/S5-builder.md) records current checks. Actual S6 agent/runtime/recovery rehearsal remains required; MC-T09 is not complete. No persistent integration job or operational MC is registered.')
    return t
update('registry.md', registry)

for rel in ['review-and-merge-design.md', 'review-and-merge-handoff.md']:
    def historical_links(t):
        t = t.replace('(.agents/skills/mc-review-and-merge/SKILL.md)', '(.agents/skills/mc-commit-supervisor/SKILL.md)')
        t = t.replace('(.codex/agents/mc-review-and-merge.toml)', '(.codex/agents/mc-commit-supervisor.toml)')
        t = t.replace('#mc-t09--build-the-branchintegration-agent', '#mc-t09--build-the-commit-supervisor')
        lines = t.splitlines(keepends=True)
        lines.insert(4, stamp + 'S5 cutover now routes entry/profile links below to the canonical [Commit Supervisor](.agents/skills/mc-commit-supervisor/SKILL.md). Historical prose, hierarchy and source fingerprints describe the earlier discussion/installation; they do not claim the retired identifiers remain discoverable. Actual rehearsal remains S6; see [deployment](deployment.md).\n\n')
        return ''.join(lines)
    update(rel, historical_links)

def static_index(t):
    x = json.loads(t)
    for d in x['documents']:
        if d['path'] == 'review-and-merge-handoff.md':
            d['lifecycle'] = 'Preserve the historical creation handoff; follow canonical Commit Supervisor deployment and approved execution records for current work.'
        if d['path'] == 'review-and-merge-design.md':
            d['lifecycle'] = 'Preserve original owner design and source provenance; canonical workflow deployment and approved SPEC own current execution.'
    for name in ['mc-commit-supervisor', 'mc-code-review-orchestrator', 'mc-commit-repair-worker']:
        x['support_files'].append(dict(path=f'.codex/agents/{name}.toml', description=f'Local {name} integration profile; exact skill loading and supported runtime fallback preserve assigned scope.'))
    x['support_files'].append(dict(path='.agents/skills/mc-commit-supervisor/SKILL.md', description='Canonical accepted-integration entry; shared workflow, recovery, independent review, Wiki/runtime handoff and attended owner operation gate.'))
    return json.dumps(x, indent=2, ensure_ascii=False) + '\n'
update('index.json', static_index)

update('.agents/skills/mc-commit-supervisor/references/workflow.md', lambda t: t + '\n## Owner wait and operation boundary\n\nAfter current final review and actual runtime handoff, follow\n[owner-publication.md](owner-publication.md) for the precise candidate/operation\npacket, `COMMIT_READY_WAITING_OWNER` terminal turn, bounded fix requests, final\npre-operation safety and separate commit/publication/landing/adoption/Alpha\nreceipts. Its state/return table and successor rules preserve accepted evidence\nand intentional waits; installation starts no task, timer or operational MC.\n')
update('.agents/skills/mc-commit-supervisor/references/job-template.md', lambda t: t + '\n## Owner operation and cutover fields\n\nFollow [owner-publication.md](owner-publication.md) for exact phase/return criteria.\nBind each owner packet and operation receipt to current candidate dependencies,\nactual owner instruction/source, permitted operation and exact destination,\npre-operation writer/ref/index/config/check/runtime/recovery readbacks, and\nuncertain-outcome reconciliation. Preserve previous packets and fix-request\nsource, affected versus retained evidence and fresh gate/runtime revisions.\nKeep local commit, remote push, PR attachment/merge, target landing, provider\nrelease, consumer adoption and future Alpha confirmations/results separate.\nLegacy job records keep their IDs/locations with alias-to-current-role, pinned\nprocedure/source revision, predecessor/schedule disposition and next safe action.\n')

# Removal is last, after current task/job/schedule inventory found no handoff.
for rel in ['.codex/agents/mc-review-and-merge.toml', '.agents/skills/mc-review-and-merge/SKILL.md', '.agents/skills/mc-review-and-merge/agents/openai.yaml']:
    p = C / rel
    assert hashlib.sha256(p.read_bytes()).hexdigest() == by_path[rel]['sha256'], rel
    p.unlink()
(C / '.agents/skills/mc-review-and-merge/agents').rmdir()
(C / '.agents/skills/mc-review-and-merge').rmdir()
print('Guarded S5 route cutover complete; old bytes retained outside discovery.')
