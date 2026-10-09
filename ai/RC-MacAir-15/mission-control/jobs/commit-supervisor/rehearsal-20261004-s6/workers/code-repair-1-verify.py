"""Read-only, source-bound before/after verification for the two-leaf repair."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
J = C / 'jobs/commit-supervisor/rehearsal-20261004-s6'
P = Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate')
sys.path.insert(0, str(C / '.agents/skills/mc-commit-supervisor/scripts'))
from job_snapshot import load, read_payload
from snapshot_state import digest, encoded, git, relevant_state

assert os.environ.get('GIT_OPTIONAL_LOCKS') == '0'
phase = sys.argv[1]
assert phase in ('before', 'after')
manifest_path = J / 'recovery/manifest.json'
assert digest(manifest_path.read_bytes()) == 'f827e476bb28bc720f14537ebf6a1edf514f122e3f6705c4e9fa0590912834fb'
checkpoint, manifest = load(J)
initial_path = J / 'evidence/first-initial-identity.json'
assert digest(initial_path.read_bytes()) == '3de6328afa457b966aba13566273a7e83023c9525de97eb53ec87ffcafa8c3bd'
initial = json.loads(initial_path.read_text())
app = 'rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/'
replacements = {
    app + 'checklist-controller.js': (
        b'renderChecklist(tasks, tasks.length, (id, completed) => {',
        b'renderChecklist(tasks, tasks.filter((task) => !task.completed).length, (id, completed) => {'),
    app + 'checklist-view.js': (
        b'`${remaining} remaining`', b'`${remaining} remaining of 3`'),
}

def fingerprint(path):
    if not path.exists() and not path.is_symlink():
        return {'exists': False}
    info = path.lstat()
    raw = os.fsencode(os.readlink(path)) if path.is_symlink() else path.read_bytes()
    return {'exists': True, 'sha256': digest(raw), 'mode': oct(info.st_mode),
            'kind': 'symlink' if path.is_symlink() else 'file'}

current_owned = {}
for name, expected in initial['owned'].items():
    current_owned[name] = fingerprint(P / name)
    target = dict(expected)
    if phase == 'after' and name in replacements:
        original = read_payload(checkpoint, manifest['owned'][name]['worktree'])
        old, new = replacements[name]
        assert original.count(old) == 1
        target['sha256'] = digest(original.replace(old, new))
    assert current_owned[name] == target, ('owned drift', name, current_owned[name], target)

for group in ('authority', 'configuration'):
    for path, expected in initial[group].items():
        assert fingerprint(Path(path)) == expected, (group, path)

reuse_path = J / 'evidence/first-unaffected-suite-reuse.json'
assert digest(reuse_path.read_bytes()) == '1618c5e2a61a34a0b2ac54eb0bcfbfceba7fc660e0b580de4a717e7c9c206aae'
reuse = json.loads(reuse_path.read_text())
for entry in reuse['dependencies']:
    actual = fingerprint(Path(entry['path']))
    assert actual['sha256'] == entry['sha256'] and actual['mode'] == entry['mode'], entry['path']

receipts = {}
for name, sha, marker in (
    ('first-python-suite-command.json', 'e9c1b41ebd26c726451cec204e812eca2cc5a6c6785cdcfa35430624eb16aff1', 'Ran 55 tests'),
    ('first-node-suite-command.json', '6de2700a795aeb0632dff31348552fd0749a5b0e833765e37a56d0d575de2040', 'pass 17'),
):
    path = J / 'evidence' / name
    assert digest(path.read_bytes()) == sha
    receipt = json.loads(path.read_text())
    assert receipt['exit_code'] == 0 and marker in receipt['stdout'] + receipt['stderr']
    receipts[name] = {'sha256': sha, 'command': receipt['command'], 'exit_code': receipt['exit_code'],
                      'producer': receipt['actor'], 'reused': True, 'live_app_evidence': False}

current = relevant_state(P, manifest['owned'], manifest['protected_repos'])
changed = sorted(name for name in set(current['paths']) | set(manifest['baseline']['paths'])
                 if current['paths'].get(name) != manifest['baseline']['paths'].get(name))
assert changed == (sorted(replacements) if phase == 'after' else []), changed
assert current['refs'] == manifest['baseline']['refs']
assert current['protected'] == manifest['baseline']['protected']
index = git(P, 'ls-files', '--stage', '-z')
status = git(P, 'status', '--porcelain=v1', '-z', '--untracked-files=all')
assert index.hex() == initial['index_z_hex']
assert status.hex() == initial['status_z_hex']
assert current == relevant_state(P, manifest['owned'], manifest['protected_repos']), 'concurrent drift'

procedure_paths = [
    C / '.agents/skills/mc-commit-repair-worker/SKILL.md',
    C / '.codex/agents/mc-commit-repair-worker.toml',
    C / 'session-contract.md',
    C / '.agents/skills/mc-commit-supervisor/references/workflow.md',
    C / '.agents/skills/mc-spec-review-gate/SKILL.md',
    J / 'code-repair-1-assignment.md', J / 'first-original-acceptance-packet.md',
]
print(json.dumps({
    'phase': phase, 'result': 'PASS', 'live_app_evidence': False,
    'original_manifest_sha256': digest(manifest_path.read_bytes()),
    'original_payloads_valid': True, 'owned_entries_verified': len(current_owned),
    'current_owned_fingerprint_sha256': digest(encoded(current_owned)),
    'changed_candidate_leaves': changed,
    'changed_file_identity': {name: current_owned[name] for name in replacements},
    'all_other_candidate_inventory_entries_unchanged': True,
    'candidate_inventory_entries_verified': len(current['paths']),
    'candidate_HEAD_refs_config_index_unchanged': True,
    'protected_source_HEAD_refs_config_index_unchanged': True,
    'index_semantics_sha256': digest(index), 'status_sha256': digest(status),
    'authority_entries_verified': len(initial['authority']),
    'configuration_entries_verified': len(initial['configuration']),
    'suite_dependency_entries_verified': len(reuse['dependencies']),
    'reused_receipts': receipts,
    'loaded_procedure_revisions': {str(path): fingerprint(path) for path in procedure_paths},
}, indent=2))
