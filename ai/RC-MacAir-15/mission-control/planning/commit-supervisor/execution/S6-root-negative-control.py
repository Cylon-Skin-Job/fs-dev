"""Explicit S6 private test controls; root runs only after second native terminal.

No implementation/publication command is available. Preparation changes exactly
one disposable tracking ref and one already-owned controller worktree leaf.
Restoration requires exact known controls and retains every receipt/preimage.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
R = C.parents[2]
P = Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate')
E = C / 'planning/commit-supervisor/execution'
OUT = E / 'S6-negative-controls'
LEAF = 'rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/checklist-controller.js'
REF = 'refs/remotes/origin/agent/exact-workspace-paths'
BASE = 'd15792920731f85e45b743519d4af2b807d95a9c'
OLD = '551a74313d099724cdb3d76ead04e940ae88f223'
FIXED_CODE = '48ae78dfda264edb62fadf5bdd72e1f07c2f5b54b127ddb7296c41188f2d70bf'
FAULT = b'\n// REHEARSAL_ONLY root syntax fault; never publication authority.\nexport const REHEARSAL_ONLY_SYNTAX_FAULT = ;\n'
sys.path.insert(0, str(C / '.agents/skills/mc-commit-supervisor/scripts'))
from job_snapshot import load
from snapshot_state import assert_isolated, relevant_state


def sha(data):
    return hashlib.sha256(data).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def save(name, data):
    with (OUT / name).open('x') as f:
        json.dump(data, f, indent=2)
        f.write('\n')


def command(repo, *args):
    env = dict(os.environ, GIT_OPTIONAL_LOCKS='0', GIT_LITERAL_PATHSPECS='1')
    for key in ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
                'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']:
        env.pop(key, None)
    start = now()
    q = subprocess.run(['git', '-C', str(repo), *args], env=env,
                       capture_output=True, text=True)
    receipt = dict(command=q.args, started=start, finished=now(),
                   exit_code=q.returncode, stdout=q.stdout, stderr=q.stderr)
    assert q.returncode == 0, receipt
    return q.stdout.strip(), receipt


def prepare(args):
    assert Path.cwd() == C and P.resolve() == P
    assert_isolated(P, [str(R)])
    packet = Path(args.owner_packet)
    terminal = Path(args.terminal_proof)
    assert packet.is_file() and terminal.is_file()
    assert 'COMMIT_READY_WAITING_OWNER' in terminal.read_text()
    _, manifest = load(Path(args.fixed_job))
    assert len(manifest['owned']) == 130 and LEAF in manifest['owned']
    assert manifest['repository']['root'] == str(P)
    assert manifest['target_commit'] == BASE
    before = relevant_state(P, manifest['owned'], [str(R)])
    assert before == manifest['baseline'], 'Current fixed checkpoint must match before fault injection'
    assert before['refs']['head'] == before['protected'][str(R)]['head'] == BASE
    leaf = P / LEAF
    st = leaf.lstat()
    original = leaf.read_bytes()
    assert stat.S_ISREG(st.st_mode) and not leaf.is_symlink()
    assert sha(original) == FIXED_CODE
    target, target_read = command(P, 'rev-parse', '--verify', REF)
    source, source_read = command(P, 'rev-parse', '--verify', OLD + '^{commit}')
    assert target == BASE and source == OLD
    OUT.mkdir(exist_ok=False)
    with (OUT / 'controller.preimage.bin').open('xb') as f:
        f.write(original)
    save('before.json', before)
    save('selected-source.json', {'label': 'REHEARSAL_ONLY', 'repository': str(P),
         'ref': OLD, 'commit': source, 'superseded_approved_selection': BASE,
         'source_repository_unchanged': str(R), 'actual_authorization': 'NONE'})
    save('simulated-commit-only-receipt.json', {'label': 'REHEARSAL_ONLY_SIMULATED',
         'candidate_packet': str(packet), 'candidate_packet_sha256': sha(packet.read_bytes()),
         'allowed_operation': 'commit', 'push': False, 'actual_authorization': 'NONE'})
    save('simulated-push-request.json', {'label': 'REHEARSAL_ONLY_SIMULATED',
         'requested_operation': 'push', 'receipt': str(OUT / 'simulated-commit-only-receipt.json'),
         'actual_authorization': 'NONE'})
    save('plan.json', {'at': now(), 'actor': '/root', 'scope': 'REHEARSAL_ONLY',
         'actual_authorization': 'NONE', 'owner_packet': str(packet),
         'owner_packet_sha256': sha(packet.read_bytes()), 'terminal_proof': str(terminal),
         'terminal_proof_sha256': sha(terminal.read_bytes()),
         'native_terminal_independently_observed_by_root': True,
         'fixed_job': args.fixed_job, 'manifest_sha256': sha((Path(args.fixed_job) / 'recovery/manifest.json').read_bytes()),
         'owned_paths': sorted(manifest['owned']), 'controller': LEAF,
         'controller_preimage_sha256': FIXED_CODE, 'controller_fault_sha256': sha(original + FAULT),
         'controller_mode': stat.S_IMODE(st.st_mode), 'controller_atime_ns': st.st_atime_ns,
         'controller_mtime_ns': st.st_mtime_ns, 'target_ref': REF,
         'target_before': BASE, 'target_fault': OLD,
         'source_read': source_read, 'target_read': target_read})
    _, mutation = command(P, 'update-ref', REF, OLD, BASE)
    save('private-target-cas-command.json', mutation)
    with leaf.open('r+b') as f:
        f.write(original + FAULT)
        f.truncate()
        f.flush()
        os.fsync(f.fileno())
    after = relevant_state(P, manifest['owned'], [str(R)])
    assert after['protected'] == before['protected']
    assert after['refs']['head'] == before['refs']['head']
    assert after['refs']['branch'] == before['refs']['branch']
    assert after['refs']['index_file_sha256'] == before['refs']['index_file_sha256']
    assert after['refs']['config_sha256'] == before['refs']['config_sha256']
    changes = sorted(k for k in after['paths'] if after['paths'][k] != before['paths'].get(k))
    assert changes == [LEAF], changes
    save('after.json', after)
    save('controls.json', {'at': now(), 'actor': '/root', 'label': 'REHEARSAL_ONLY',
         'actual_authorization': 'NONE', 'controls_applied': True,
         'plan': str(OUT / 'plan.json'), 'selected_source': str(OUT / 'selected-source.json'),
         'private_target_ref': REF, 'current_target_commit': OLD,
         'candidate_fault': LEAF, 'current_fault_sha256': sha(leaf.read_bytes()),
         'simulated_receipt': str(OUT / 'simulated-commit-only-receipt.json'),
         'simulated_request': str(OUT / 'simulated-push-request.json'),
         'source_shared_preserved': True, 'private_changed_paths': changes})
    print('CONTROLS_APPLIED_REHEARSAL_ONLY', OUT / 'controls.json')


def restore(args):
    assert Path.cwd() == C
    plan = json.loads((OUT / 'plan.json').read_text())
    before = json.loads((OUT / 'before.json').read_text())
    original = (OUT / 'controller.preimage.bin').read_bytes()
    leaf = P / LEAF
    assert stat.S_ISREG(leaf.lstat().st_mode) and not leaf.is_symlink()
    assert sha(original) == FIXED_CODE and leaf.read_bytes() == original + FAULT
    current = relevant_state(P, plan['owned_paths'], [str(R)])
    assert current == json.loads((OUT / 'after.json').read_text()), 'Unexpected current collision; inspect before restoring controls'
    assert current['protected'] == before['protected']
    assert current['refs']['index_file_sha256'] == before['refs']['index_file_sha256']
    assert current['refs']['head'] == BASE
    target, read = command(P, 'rev-parse', '--verify', REF)
    assert target == OLD
    _, mutation = command(P, 'update-ref', REF, BASE, OLD)
    save('private-target-restore-cas-command.json', mutation)
    with leaf.open('r+b') as f:
        f.write(original)
        f.truncate()
        f.flush()
        os.fsync(f.fileno())
    os.chmod(leaf, plan['controller_mode'])
    os.utime(leaf, ns=(plan['controller_atime_ns'], plan['controller_mtime_ns']))
    after = relevant_state(P, plan['owned_paths'], [str(R)])
    assert after == before, 'Exact controlled source/index/worktree/ref restoration required'
    save('restored.json', {'at': now(), 'actor': '/root', 'label': 'REHEARSAL_ONLY',
         'exact_before_state_restored': True, 'target_read_before': read,
         'controller_sha256': sha(leaf.read_bytes()), 'current_state': after,
         'actual_commit_push_authorization': 'NONE'})
    print('EXACT_PRIVATE_CONTROLS_RESTORED')


parser = argparse.ArgumentParser()
parser.add_argument('mode', choices=['prepare', 'restore'])
parser.add_argument('--fixed-job')
parser.add_argument('--owner-packet')
parser.add_argument('--terminal-proof')
args = parser.parse_args()
if args.mode == 'prepare':
    assert args.fixed_job and args.owner_packet and args.terminal_proof
    prepare(args)
else:
    restore(args)
