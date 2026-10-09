"""Freeze explicit prep sources/dependencies and this builder's own raw evidence."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

P = Path(__file__).resolve().parent
E, C = P.parent, P.parents[3]
R, K = C.parents[2], C / '.agents/skills/mc-commit-supervisor'
config = json.loads((P / 'current-private-paths.json').read_text())
candidate = Path(config['candidate'])
helpers = ['prepare_rehearsal_shell.mjs', 'install_rehearsal_fixture.py', 'rehearsal_ui_smoke.mjs',
           'rehearsal_watcher_smoke.mjs', 'rehearsal_recovery_smoke.py', 'rehearsal_wiki_recovery_smoke.py',
           'stop_rehearsal_runtime.mjs']
assets = ['authority.md', 'index.html', 'checklist-controller.js', 'checklist-view.js',
          'checklist.css', 'checklist-guide.md', 'navigation-guide.md']
owned = [K / 'tests' / n for n in helpers] + [K / 'tests/rehearsal-fixture' / n for n in assets] + [E / 'S6-builder.md']
# This is only the builder-owned preparation directory, not root execution inputs.
owned += [p for p in P.rglob('*') if p.is_file() and not p.is_symlink()]
deps = [C / n for n in ['AGENTS.md', 'session-contract.md', '.agents/skills/mc-spec-slice-builder/SKILL.md',
    '.codex/agents/mc-spec-slice-builder.toml', '.agents/skills/mc-spec-review-gate/SKILL.md',
    'planning/commit-supervisor/SPEC.md']]
deps += [E / n for n in ['approval-receipt.md', 'S6-builder-assignment.md', 'S6-fixture-authority-approval.json',
    'runtime-rehearsal-manager-contract.md', 'runtime-boundary-notes.md']]
deps += [K / n for n in ['SKILL.md', 'references/runtime-handoff.md', 'references/wiki-handoff.md',
    'references/owner-publication.md', 'scripts/job_snapshot.py', 'scripts/snapshot_state.py',
    'scripts/snapshot_restore.py', 'tests/test_restart_runtime.mjs']]
deps += [Path('/Users/rccurtrightjr./.codex/skills') / n for n in ['fusion-electron-restart/SKILL.md',
    '.system/skill-creator/SKILL.md']]
wiki = R / 'ai/RC-MacAir-15/Wiki'
deps += [wiki / '005-Enforcement/001-Code_Standards' / n / 'PAGE.md' for n in
    ['000-Code_Standards', '001-Architecture_Routing', '007-Persistence_And_Metadata', '008-Testing_And_Smoke_Slices']]
deps += [wiki / '000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md', R / 'AGENTS.md']
canonical = ['restart-fusion.sh', 'scripts/fusion-restart-probe.mjs', 'scripts/fusion-restart-processes.mjs',
             'scripts/fusion-restart-target.mjs', 'scripts/fusion-restart.mjs']
deps += [base / n for base in [R, candidate] for n in canonical]
deps += [candidate / n for n in ['AGENTS.md', 'fusion-studio-client/package.json',
    'fusion-studio-client/package-lock.json', 'fusion-studio-server/package.json', 'fusion-studio-server/package-lock.json',
    'fusion-studio-client/electron/main.cjs', 'fusion-studio-client/electron/server-spawn.cjs',
    'fusion-studio-server/lib/db.js', 'fusion-studio-server/lib/startup.js']]

def fact(path):
    assert path.is_file(), str(path)
    stat = path.lstat()
    return {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'mode': oct(stat.st_mode), 'size': stat.st_size}

manifest = json.loads((P / 'final-recovery/preparation-recovery/recovery/manifest.json').read_text())
leaves = {}
for name in manifest['owned']:
    path = candidate / name
    if path.is_symlink(): leaves[name] = {'kind': 'symlink', 'target': os.readlink(path), 'mode': oct(path.lstat().st_mode)}
    elif path.exists(): leaves[name] = {'kind': 'file', **fact(path)}
    else: leaves[name] = {'kind': 'missing'}
freeze = {'kind': 'S6_PREPARATION_ONLY_FROZEN_PACKET', 'frozen_at': datetime.now(timezone.utc).isoformat(),
    'builder': '/root/s6_builder', 'root_inherited_settings': 'no model/effort overrides', 'controller_home': str(C),
    'candidate': config, 'owned_files': [fact(p) for p in sorted(set(owned))],
    'dependencies': [fact(p) for p in sorted(set(deps))], 'candidate_exact_leaves': leaves,
    'excluded_root_inputs': ['S6-supervisor-intake-draft.md', 'S6-preparation-preliminary-inspection.md',
        'S6-runtime-dispatch-plan.md', 'S4-canonical-wiki-correction.md', 'S4-wiki-builder-assignment.md',
        'S6-closeout-wiki-ownership.md', 'all prior builder/reviewer/root verdict reports'],
    'review_boundary': 'fixture/helpers/private isolation/proof mechanics only; no actual chain or S6/SPEC completion',
    'postreview_report_update': 'Only status/reviewer/lifecycle metadata may be appended after clean; artifact dependency drift reopens gate'}
target = P / 'prep-freeze.json'
with target.open('x') as output: json.dump(freeze, output, indent=2); output.write('\n')
target.chmod(0o444)
print(json.dumps({'path': str(target), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                  'owned_files': len(freeze['owned_files']), 'dependencies': len(freeze['dependencies']), 'leaves': len(leaves)}))
