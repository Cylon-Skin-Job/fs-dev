"""One-off S5 readback and terminal evidence; writes only builder execution records."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
R = Path('/Users/rccurtrightjr./projects/fs-dev')
E = C / 'planning/commit-supervisor/execution'
D = E / 'S5'
K = C / '.agents/skills/mc-commit-supervisor'
now = datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def git(*arguments):
    return subprocess.check_output(['git', '--no-optional-locks', *arguments], cwd=R, text=True).strip()


assert Path.cwd() == C
baseline = json.loads((D / 'baseline.json').read_text())
assert git('rev-parse', '--show-toplevel') == str(R)
assert git('branch', '--show-current') == 'agent/exact-workspace-paths'
assert git('rev-parse', 'HEAD') == baseline['head']
assert digest(R / '.git/index') == baseline['index_sha256']
manifest = json.loads((D / 'current-manifest.json').read_text())
assert len(manifest) == 26
assert digest(D / 'current-manifest.json') == 'e61a55051eb1981a6375230669ebd367fca7cb5b5eb7f900a4dc8c31187b7936'
paths = {Path(x['path']) for x in manifest}
for entry in manifest:
    p = Path(entry['path'])
    if entry.get('absent'):
        assert not os.path.lexists(p), str(p)
    else:
        assert digest(p) == entry['sha256'], str(p)
        assert stat.S_IMODE(p.stat().st_mode) == entry['mode'], str(p)

preimages = json.loads((D / 'preimages.json').read_text())
before = {x['path']: x for x in preimages}
for x in preimages:
    if 'preimage' in x:
        p = Path(x['preimage'])
        assert digest(p) == x['sha256']
        assert stat.S_IMODE(p.stat().st_mode) == x['mode']
workflow = K / 'references/workflow.md'
template = K / 'references/job-template.md'
for p in (workflow, template):
    previous = Path(before[str(p)]['preimage']).read_bytes()
    assert p.read_bytes().startswith(previous), str(p)
assert digest(Path(before[str(workflow)]['preimage'])) == '77f805037ed1384e3a387cb246d95df95fc2e0858755a63e95228d684403c6a7'
assert len(workflow.read_text().splitlines()) == 334

owned = {str(p.relative_to(R)) for p in paths}
ledger = json.loads((E / 'slice-ledger.json').read_text())
for s in ledger['slices'][:4]:
    assert s['state'] == 'accepted'
    for x in s['current_revision']:
        p = Path(x['path'])
        if p.is_relative_to(R):
            owned.add(str(p.relative_to(R)))
        if p not in paths:
            assert digest(p) == x['sha256'], str(p)
            if 'mode' in x:
                assert stat.S_IMODE(p.stat().st_mode) == x['mode'], str(p)
preserved = {'file': 0, 'symlink': 0, 'absent': 0}
sourcebaseline = json.loads((E / 'source-file-baseline.json').read_text())
for rel, x in sourcebaseline.items():
    if rel in owned:
        continue
    p = R / rel
    if x['kind'] == 'file':
        assert p.is_file() and digest(p) == x['sha256'], str(p)
        assert stat.S_IMODE(p.stat().st_mode) == x['mode'], str(p)
    elif x['kind'] == 'symlink':
        assert p.is_symlink() and os.readlink(p) == x['target'], str(p)
    elif x['kind'] == 'absent':
        assert not os.path.lexists(p), str(p)
    else:
        raise AssertionError(x)
    preserved[x['kind']] += 1

frozen_path = E / 'S5-pass-1/manifest.json'
assert digest(frozen_path) == '68e34c0ebaa6b000b3fbfc5c0d62699013874d6fa5d3c65997e2244618f8d8ee'
frozen = json.loads(frozen_path.read_text())
report = E / 'S5-builder.md'
report_completion = []
frozen_copy_modes = []
for x in frozen:
    p = Path(x['frozen'])
    assert digest(p) == x['sha256'], str(p)
    # Manifest mode is original-source metadata, not the materialized evidence copy.
    frozen_copy_modes.append(dict(path=str(p), mode=stat.S_IMODE(p.stat().st_mode), original_source_mode=x['mode']))
    original = Path(x['source'])
    if original == report:
        report_completion.append(dict(path=str(original), reviewed_sha256=x['sha256'], final_sha256=digest(original), reason='report-only completion after clean reviewer; candidate implementation unchanged'))
    else:
        assert digest(original) == x['sha256'], str(original)
        assert stat.S_IMODE(original.stat().st_mode) == x['mode'], str(original)
assert len(frozen) == 83 and len(report_completion) == 1
checks = json.loads((D / 'checks.json').read_text())
for check in checks['checks']:
    assert check['exit'] == 0
    assert digest(check['log']) == check['log_sha256']
raw_review = E / 'S5-builder-review-1.md'
assert raw_review.read_text().startswith('**CLEAN — S5 builder-owned review.**')
lifecycle_path = D / 'reviewer-lifecycle.json'
lifecycle = json.loads(lifecycle_path.read_text())
lifecycle.update(state='completed', terminal_result='CLEAN', observed_completed_at=now,
                 completion_evidence='native list_agents path_prefix /root/s5_builder returned reviewer agent_status completed with the exact inline raw report',
                 raw_report_sha256=digest(raw_review), raw_report_persistence='builder saved exact inline review unchanged; read-only reviewer did not write files',
                 material_findings=[], repair_passes=0, stop='first materially clean fresh pass; no further builder reviewer',
                 close_agent='unavailable in exposed runtime/tool metadata; completed agent remains non-conflicting; no invented closure')
write(lifecycle_path, lifecycle)

readback = dict(at=now, controller_home=str(C), memory_cwd=str(Path.cwd()), implementation_root=str(R),
                branch=git('branch', '--show-current'), head=git('rev-parse', 'HEAD'), index_sha256=digest(R / '.git/index'),
                owned_paths=26, owned_bytes_modes_and_deletions_match=True, complete_preimages_match=True,
                accepted_s1_s4_current_dependencies_match=True, accepted_workflow_template_prefixes_match=True,
                preserved_unowned_baseline=preserved, unowned_drift=[], frozen_copies_match=83,
                unchanged_frozen_live_sources=82, report_only_completion=report_completion,
                frozen_copy_modes=frozen_copy_modes,
                finalization_attempts=[dict(attempt=1, result='readback adapter assertion corrected', evidence=str(D / 'finalization-attempt-1.log'),
                                           reason='frozen manifest mode describes original source; byte copies have evidence-file mode. Original source modes and frozen bytes match; no source or frozen mutation'),
                                      dict(attempt=2, result='passed')],
                raw_command_logs_match=True, raw_reviewer_report_sha256=digest(raw_review),
                closure_tool='unavailable', candidate_mutation_after_review=False,
                command=['/opt/homebrew/bin/python3.12', '-B', str(D / 'finalize.py')], command_script_sha256=digest(D / 'finalize.py'))
write(D / 'final-readback.json', readback)

criteria = [
    dict(id='S5-C1', original='entry resolves exact bindings and permissions, explicit skill loading/fallback, no invented task API arguments',
         implementation=['.agents/skills/mc-commit-supervisor/SKILL.md', '.codex/agents/mc-commit-supervisor.toml', '.codex/config.toml', 'session-contract.md'],
         checks=['seven skill validators', 'all twelve TOML role mappings and existing paths', 'UI YAML seven', 'clean independent five-lens review'], result='passed definitions; actual role loading is S6'),
    dict(id='S5-C2', original='stopped-cycle evidence, deduplication and prerequisite evidence',
         implementation=['.agents/skills/mc-commit-supervisor/SKILL.md', '.agents/skills/mc-commit-supervisor/references/workflow.md', '.agents/skills/mc-commit-supervisor/references/job-template.md'],
         checks=['cutover native/durable inventory', 'current workflow and prerequisite sources', 'clean independent review'], result='passed; construction did not activate a cycle'),
    dict(id='S5-C3', original='all states/returns and precise candidate/operation owner packet; end-turn owner wait; fix-X/Y reopening; final pre-operation safety; separate receipts/adoption/Alpha gate',
         implementation=['.agents/skills/mc-commit-supervisor/references/owner-publication.md', '.agents/skills/mc-commit-supervisor/references/workflow.md', '.agents/skills/mc-commit-supervisor/references/job-template.md'],
         checks=['current byte and criterion review', 'accepted workflow/template prefix equality', 'fifty-five Python tests and fourteen Node fixture tests', 'clean independent review'], result='passed definitions; actual hold/fix/runtime/replacement exercises remain S6'),
    dict(id='S5-C4', original='Inventory active legacy callers and live jobs before cutover. Historical D-021–D-024 text and old reports retain provenance/searchable alias. Existing legacy job locations/IDs are not bulk renamed',
         implementation=['current callers and records in current-manifest.json', 'safe deletion of legacy skill/UI/profile', 'complete preimages outside discovery'],
         checks=['native listing and pertinent readbacks', 'durable jobs/cycles/registry and matching schedule inventory', 'sixty-one remaining aliases classified', 'whole active-caller sweep'], result='passed; no actual legacy job/writer/awaiting handoff found within disclosed native bounds'),
    dict(id='S5-C5', original='quick_validate.py for top-level skill; Python tomllib parses config and all affected profiles and verifies referenced file existence; targeted rg over active local callers confirms canonical entry, with each remaining alias classified historical/job evidence; resolve Markdown links and exact indexed H2 headings; run existing validate_index.py',
         implementation=['all twenty-six manifest paths'], checks=['S5/checks.json', 'S5/ui-and-fragments.json', 'S5/legacy-classification.json', 'S5/all-active-caller-sweep.log'], result='passed; 7 skills, 12 profiles, 259 links, 12 fragments, 21 indexed documents'),
    dict(id='S5-C6', original='No model pin/global config change, no auto-dispatch/re-arm. Mark MC-T09 installed/rehearsal pending, never complete from static checks.',
         implementation=['.codex/config.toml', 'deployment.md', 'todo.md', 'handoff.md', 'registry.md', 'all active callers'],
         checks=['non-agent config exactly unchanged', 'all profiles no model override', 'current record review and clean independent gate', 'unchanged source HEAD/index/unowned baseline'], result='passed; no activation, persistent task, schedule, publication or Alpha operation'),
]
deviations = [
    dict(id='S5-D1', original_text='finish shared workflow/template', actual='add cohesive references/owner-publication.md with entry/workflow/template routes while preserving accepted shared prefixes',
         reason='purposeful owner/publication responsibility and workflow below 400 lines', authority='approved S5 owner-gate scope plus explicit root permission for cohesive reference',
         files=['.agents/skills/mc-commit-supervisor/SKILL.md', '.agents/skills/mc-commit-supervisor/references/owner-publication.md', '.agents/skills/mc-commit-supervisor/references/workflow.md', '.agents/skills/mc-commit-supervisor/references/job-template.md'],
         tests=['local links', 'current hashes and byte-identical accepted prefixes', 'clean criterion review'], effect='supplies precise attended operation and successor contract without disturbing accepted sections',
         risk='package deployment must retain referenced file', downstream='S6 loads reference and exercises hold/fix/owner wait/stale approval; publication stays separately owner-authorized', proposed_classification='accepted; root owns authoritative ruling'),
    dict(id='S5-D2', original_text='active references in C/AGENTS.md, session-contract.md, record-templates.md, .agents/skills/mission-control/SKILL.md, applicable status/monitor callers',
         actual='also migrate four current charter phrases in mission-control.md to canonical Commit Supervisor', reason='active role charter still selected legacy integration name',
         authority='explicit root bounded active-caller assignment', files=['mission-control.md'], tests=['legacy sweep/classification', 'exact indexed H2 and local links', 'clean criterion review'],
         effect='current charter agrees with installed sole canonical entry; historical hierarchy and alias retained', risk='none beyond bounded current-name migration; no new dispatch authority',
         downstream='S6 and later controller use canonical route', proposed_classification='accepted; root owns authoritative ruling'),
    dict(id='S5-D3', original_text='S5 active caller/link migration; S3 accepted design/handoff paths omitted from advisory S5 expected-file list',
         actual='mechanically retarget removed skill/profile links and obsolete MC-T09 anchor; add current cutover provenance in historical design/handoff',
         reason='retired entry/profile removal would otherwise leave dangling current destinations', authority='explicit root approval for mechanically necessary correction',
         files=['review-and-merge-design.md', 'review-and-merge-handoff.md'], tests=['all current Markdown destinations and heading fragments', 'unchanged indexed H2/source fingerprints', 'clean criterion review'],
         effect='historical role wording remains provenanced and searchable; present links resolve canonical destinations', risk='only affected link/hash evidence invalidated; accepted S3 Wiki behavior and fixture/oracle unchanged',
         downstream='current dependency hashes/raw links included in S5 gate; S6 retains accepted Wiki contracts', proposed_classification='accepted; root owns authoritative ruling'),
]
changed = [dict(relative=x['relative'], action='deleted' if x.get('absent') else ('added' if before[x['path']].get('absent') else 'modified'),
                before_sha256=before[x['path']].get('sha256'), current_sha256=x.get('sha256'), mode=x.get('mode')) for x in manifest]
terminal = dict(status='READY_FOR_ORCHESTRATOR_REVIEW', slice='S5', work_id='SPEC-COMMIT-SUPERVISOR-01', builder='/root/s5_builder', manager='/root',
                signed_by='Codex side chat (ephemeral)', at=now, controller_home=str(C), actual_memory_cwd=str(C), implementation_root=str(R),
                branch='agent/exact-workspace-paths', head=baseline['head'], index_sha256=baseline['index_sha256'],
                role_skill=str(C / '.agents/skills/mc-spec-slice-builder/SKILL.md'), approval_receipt=str(E / 'approval-receipt.md'),
                accepted_prerequisites=['S1', 'S2', 'S3', 'S4'], root_model_effort_inherited=True, model_or_effort_override=False,
                effective_permissions={'sandbox': 'danger-full-access', 'approval': 'never'},
                builder_report=str(report), builder_report_sha256=digest(report), current_manifest=str(D / 'current-manifest.json'), current_manifest_sha256=digest(D / 'current-manifest.json'),
                frozen_pass=str(frozen_path), frozen_pass_sha256=digest(frozen_path), final_readback=str(D / 'final-readback.json'), final_readback_sha256=digest(D / 'final-readback.json'),
                changed_files=changed, acceptance_mapping=criteria, checks=str(D / 'checks.json'), supplemental_checks=str(D / 'ui-and-fragments.json'),
                self_review='all owned current-byte diffs and integration seams read; guarded preimage/hash/mode writes; legacy removal last; no material repairs needed',
                reviewer_history=[dict(identity='/root/s5_builder/s5_builder_review_1', type='clean-room-reviewer', fork_turns='none', overrides=False, result='CLEAN',
                                      material_findings=[], authority_blockers=[], report=str(raw_review), report_sha256=digest(raw_review), lifecycle=str(lifecycle_path))],
                lifecycle=dict(review_passes=1, terminal=True, close_agent='unavailable', prior_agent_confirmation='none before first spawn; completed before handoff',
                               first_clean_stop=True, no_further_builder_children=True),
                deviations=deviations, findings_or_dispositions=[], skipped_required_s5_checks=[],
                adapters=['Python 3.12 -B supplies tomllib; existing cached PyYAML read-only with bytecode disabled; no install/reset/dependency write',
                          'supported default agent + exact absolute skill/session/workflow paths if new runtime role name is unavailable; actual adapter loading proof belongs to S6',
                          'native inventory bounded to 50 recent plus all pinned, corroborated by durable jobs/registry/cycles/schedules and pertinent readbacks',
                          'read-only reviewer returned report inline; builder persisted verbatim; close_agent unavailable'],
                runtime_evidence='55 Python and 14 Node bounded/injected fixtures passed; no actual app launch or integration-role workflow rehearsal in S5',
                residual_limits=['S6 actual role loading/delegation, fresh review/repair/Wiki identity tree, live isolated app behavior and recovery remain required',
                                 'MC-T09 installed/rehearsal pending; no completion from S5 static/fixture checks',
                                 'future publication and Alpha operations require distinct exact owner authority; S6 cannot authorize them'],
                no_operational_mc=True, no_persistent_chat_or_timer=True, no_git_mutation=True, no_alpha_operation=True, no_s6_started=True,
                next_safe_action='root independently accepts or returns this exact S5 candidate; builder stops and does not begin S6', root_acceptance_granted=False)
write(E / 'S5-terminal.json', terminal)
for target in re.findall(r'\]\(([^)]+)\)', report.read_text()):
    if '://' not in target:
        assert (report.parent / target.split('#', 1)[0]).resolve().exists(), target
assert git('rev-parse', 'HEAD') == baseline['head'] and digest(R / '.git/index') == baseline['index_sha256']
print(json.dumps(dict(status=terminal['status'], manifest_sha256=terminal['current_manifest_sha256'], terminal_sha256=digest(E / 'S5-terminal.json'),
                      reviewer='CLEAN', changed_paths=26, preserved=preserved, frozen_copies=83, unchanged_frozen_live_sources=82, report_only_updates=1), indent=2))
