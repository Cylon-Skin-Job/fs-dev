"""Exercise the public snapshot CLI against the prepared private leaf inventory."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

config_path = Path(sys.argv[1]).resolve()
config = json.loads(config_path.read_text())
candidate = Path(config['candidate'])
evidence = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else config_path.parent
if len(sys.argv) > 2:
    assert not evidence.exists(), 'use a fresh distinct evidence directory'
evidence.mkdir(parents=True, exist_ok=True)
scripts = Path(__file__).resolve().parents[1] / 'scripts'
assert str(candidate).startswith('/private/tmp/mc-s6-')
assert not (evidence / 'preparation-recovery').exists(), 'immutable checkpoint must never be overwritten'

def git(*args):
    return subprocess.check_output(['git', '-C', str(candidate), *args])

names = set(os.fsdecode(p) for p in git('diff', '--name-only', '-z').split(b'\0') if p)
names.update(os.fsdecode(p) for p in git('diff', '--cached', '--name-only', '-z').split(b'\0') if p)
names.update(os.fsdecode(p) for p in git('ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if p)
# Runtime-generated workspace leaves ignored by the parent checkout are still
# explicitly owned fixtures; never approximate directories as recoverable files.
for root in [candidate / 'ai/MC-S6', Path(config['workspace'])]:
    for base, dirs, files in os.walk(root, followlinks=False):
        for name in files:
            names.add(str((Path(base) / name).relative_to(candidate)))
future = 'rehearsal-inputs/future-addition.txt'
names.add(future)
watcher = config.get('watcherProofRelative')
if watcher:
    names.add(str((Path(config['workspace']) / watcher).relative_to(candidate)))
names = sorted(names)
ignored = subprocess.run(['git', '-C', str(candidate), 'check-ignore', '--stdin', '-z'],
    input=b'\0'.join(os.fsencode(p) for p in names)+b'\0', capture_output=True).stdout
paths_file = evidence / 'owned-paths.json'
owner = '/root/s6_builder-preparation'
paths_file.write_text(json.dumps({'owner': owner, 'source_repo': str(Path(__file__).resolve().parents[7]),
    'conflicting_writers': [], 'target_ref': 'HEAD',
    'source_refs': [{'repo': str(Path(__file__).resolve().parents[7]), 'ref': 'HEAD'}],
    'authority_paths': [str(Path(__file__).parent / 'rehearsal-fixture/authority.md'), str(config_path)],
    'preparation': 'independent no-hardlinks existing-ref clone; only accepted five restart files and explicit fixture inputs replayed',
    'ignored_runtime_paths': [os.fsdecode(p) for p in ignored.split(b'\0') if p],
    'paths': [{'path': n, 'job_created': not (candidate / n).exists() and not (candidate / n).is_symlink()} for n in names],
    'runtime': {'profile': config['profile'], 'recovery': 'private disposable only; DB/cache effects excluded; retain evidence and abandon profile'}}, indent=2)+'\n')
receipt = evidence / 'ownership.json'
receipt.write_text(json.dumps({'owner': owner, 'conflicting_writers': [], 'paths': names}, indent=2)+'\n')
job = evidence / 'preparation-recovery'
records = []

def cli(command, expected=0):
    args = [sys.executable, '-B', str(scripts / 'job_snapshot.py'), command, '--job', str(job)]
    if command != 'verify': args += ['--repo', str(candidate)]
    if command == 'capture': args += ['--paths-file', str(paths_file)]
    if command == 'guard': args += ['--ownership-file', str(receipt)]
    result = subprocess.run(args, capture_output=True, text=True, env=dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))
    records.append({'command': args, 'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
    assert result.returncode == expected, records[-1]
    return json.loads(result.stdout if expected == 0 else result.stderr)

def snapshot_bytes():
    index = (candidate / '.git/index').read_bytes()
    values = {}
    for n in names:
        p = candidate / n
        values[n] = {'bytes': p.read_bytes().hex() if p.is_file() and not p.is_symlink() else None,
                     'link': os.readlink(p) if p.is_symlink() else None,
                     'mode': p.lstat().st_mode if p.exists() or p.is_symlink() else None}
    return {'index': hashlib.sha256(index).hexdigest(), 'leaves': values,
            'status_z': git('status', '--porcelain=v1', '-z', '--untracked-files=all').hex(),
            'refs': git('show-ref').decode(), 'head': git('rev-parse', 'HEAD').decode()}

baseline = snapshot_bytes()
cli('capture')
assert cli('verify')['matches_checkpoint']
# An interrupted mutation is staged separately from its worktree bytes.
leaf = candidate / 'rehearsal-inputs/checkpoint.bin'
leaf.write_bytes(b'interrupted stage\0\xff')
git('add', '--', 'rehearsal-inputs/checkpoint.bin')
leaf.write_bytes(b'interrupted worktree\0\xfe')
(candidate / future).write_bytes(b'job-created addition\n')
cli('guard')
guarded = snapshot_bytes()
leaf.write_bytes(b'concurrent collision\0\xff')
collision = snapshot_bytes()
cli('restore', expected=1)
assert snapshot_bytes() == collision, 'collision refusal must be completely non-mutating'
leaf.write_bytes(b'interrupted worktree\0\xfe')
assert snapshot_bytes() == guarded
cli('restore')
assert cli('verify')['matches_checkpoint']
restored = snapshot_bytes()
# The public helper preserves index semantics; the index file can be rebuilt.
assert restored['leaves'] == baseline['leaves']
assert restored['status_z'] == baseline['status_z']
assert restored['refs'] == baseline['refs'] and restored['head'] == baseline['head']
(evidence / 'recovery-smoke.json').write_text(json.dumps({'kind': 'PREPARATION_MECHANICS_ONLY',
    'owned_leaf_count': len(names), 'commands': records, 'before': baseline, 'restored': restored,
    'index_file_hash_equal': baseline['index'] == restored['index'],
    'index_semantics_verified_by_public_helper': True, 'collision_nonmutation': True,
    'actual_supervisor_interruption_gate': 'still required'}, indent=2)+'\n')
print(json.dumps({'owned_leaf_count': len(names), 'result': 'PASS', 'collision_nonmutation': True}))
