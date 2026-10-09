from pathlib import Path
import hashlib, json, os, stat, subprocess
from datetime import datetime, timezone

JOB = Path(__file__).resolve().parent
CANDIDATE = Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
SOURCE = Path('/Users/rccurtrightjr./projects/fs-dev')
TARGET = '3356e1b73cc5d44028eac5baa02fd542a8bbc385'
SOURCE_HEAD = 'd15792920731f85e45b743519d4af2b807d95a9c'

def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})

def leaf(repo, relative):
    p = repo / relative
    if not p.exists() and not p.is_symlink():
        return {'path': relative, 'kind': 'absent', 'mode': None, 'sha256': None, 'bytes': 0}
    assert p.is_file() and not p.is_symlink(), relative
    b = p.read_bytes()
    return {'path': relative, 'kind': 'file', 'mode': stat.S_IMODE(p.stat().st_mode),
            'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}

def write(name, data):
    (JOB / name).write_text(json.dumps(data, indent=2) + '\n')

assert git(SOURCE, 'rev-parse', 'HEAD').decode().strip() == SOURCE_HEAD
assert git(CANDIDATE, 'rev-parse', 'HEAD').decode().strip() == TARGET
assert git(CANDIDATE, 'branch', '--show-current').decode().strip() == 'codex/chat-retirement-and-startup-repair'
assert hashlib.sha256((SOURCE / '.git/index').read_bytes()).hexdigest() == '8c2f62d2d71cc47a2c5ca767375290e860835e7eec19014f13b8f1475a1c26a4'

frozen = json.loads((JOB / 'frozen-source-inventory.json').read_text())
drift = [r['path'] for r in frozen if leaf(SOURCE, r['path']) != r]
assert not drift, drift
wiki = json.loads((JOB / 'wiki-editor/current-byte-evidence.json').read_text())
code = json.loads((JOB / 'screenshot-repair/current-byte-evidence.json').read_text())
paths = set(json.loads((JOB / 'commit-paths.json').read_text()))
for row in code['files']:
    paths.add(row['path'])
for row in wiki['pages'] + wiki['versions']:
    paths.add(row['path'])
deferred = set(json.loads((JOB / 'operational-document-deferral.json').read_text())['paths'])
runtime = set(json.loads((JOB / 'runtime-only-paths.json').read_text()))
assert not paths.intersection(deferred | runtime)
paths = sorted(paths)
write('final-commit-paths.json', paths)
(JOB / 'final-commit-paths.z').write_bytes(b''.join(p.encode() + b'\0' for p in paths))
before = git(CANDIDATE, 'ls-files', '--stage', '-z')
preimage_index = JOB / 'final-stage-preimage.index.z'
if preimage_index.exists():
    assert preimage_index.read_bytes() == before, 'Index changed after refused stage attempt'
else:
    preimage_index.write_bytes(before)
preimage_leaves = [leaf(CANDIDATE, p) for p in paths]
preimage_worktree = JOB / 'final-stage-preimage.worktree.json'
if preimage_worktree.exists():
    assert json.loads(preimage_worktree.read_text()) == preimage_leaves
else:
    write('final-stage-preimage.worktree.json', preimage_leaves)
indexed = {r.split(b'\t', 1)[1].decode() for r in before.split(b'\0') if r}
# Already-staged deletions have no remaining index/file path for git add to match.
stage_paths = [p for p in paths if p in indexed or (CANDIDATE / p).exists()]
(JOB / 'final-stage-inputs.z').write_bytes(b''.join(p.encode() + b'\0' for p in stage_paths))
subprocess.run(['git', '-C', str(CANDIDATE), 'add', '-A', '-f',
                '--pathspec-from-file=' + str(JOB / 'final-stage-inputs.z'), '--pathspec-file-nul'], check=True)
index = {}
for record in git(CANDIDATE, 'ls-files', '--stage', '-z').split(b'\0'):
    if not record:
        continue
    meta, name = record.split(b'\t', 1)
    mode, blob, stage = meta.decode().split()
    assert stage == '0'
    index[name.decode()] = {'mode': mode, 'blob': blob}
leaves = [leaf(CANDIDATE, p) for p in paths]
for r in leaves:
    p = r['path']
    if r['kind'] == 'absent':
        assert p not in index, p
        continue
    data = (CANDIDATE / p).read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    assert index[p]['blob'] == blob, p
    assert index[p]['mode'] == ('100755' if r['mode'] & 0o111 else '100644'), p
changed = git(CANDIDATE, 'diff', '--cached', '--name-only', '-z').split(b'\0')
changed = [p.decode() for p in changed if p]
assert set(changed).issubset(paths), sorted(set(changed) - set(paths))
source_leaves = [leaf(SOURCE, p) for p in paths]
copies = [r['path'] for r, s in zip(leaves, source_leaves) if r != s]
support = [leaf(CANDIDATE, p) for p in sorted(runtime)]
assert support == [leaf(SOURCE, p) for p in sorted(runtime)]
write('final-candidate-owned-inventory.json', leaves)
write('final-source-owned-inventory.json', source_leaves)
write('landing-copy-paths.json', copies)
write('final-candidate-runtime-support.json', support)
write('final-candidate-identity.json', {
    'at': datetime.now(timezone.utc).isoformat(), 'candidate': str(CANDIDATE),
    'branch': 'codex/chat-retirement-and-startup-repair', 'head': TARGET,
    'source': str(SOURCE), 'source_head': SOURCE_HEAD,
    'source_index_sha256': hashlib.sha256((SOURCE / '.git/index').read_bytes()).hexdigest(),
    'tree': git(CANDIDATE, 'write-tree').decode().strip(),
    'owned_path_count': len(paths), 'changed_path_count': len(changed),
    'changed_markdown_count': sum(p.endswith('.md') for p in changed),
    'landing_copy_count': len(copies), 'runtime_support_published': False,
    'frozen_source_rows_verified': len(frozen),
    'owned_inventory_sha256': hashlib.sha256((JOB / 'final-candidate-owned-inventory.json').read_bytes()).hexdigest(),
    'source_inventory_sha256': hashlib.sha256((JOB / 'final-source-owned-inventory.json').read_bytes()).hexdigest(),
    'paths_sha256': hashlib.sha256((JOB / 'final-commit-paths.z').read_bytes()).hexdigest(),
    'runtime_support_sha256': hashlib.sha256((JOB / 'final-candidate-runtime-support.json').read_bytes()).hexdigest(),
    'deferred_operational_paths': sorted(deferred),
    'product_refs': git(SOURCE, 'for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads/', 'refs/remotes/').decode(),
    'source_branch': git(SOURCE, 'branch', '--show-current').decode().strip(),
    'remote_configuration': git(SOURCE, 'remote', '-v').decode(),
    'candidate_diff_stat': git(CANDIDATE, 'diff', '--cached', '--stat').decode()
})
print(json.dumps({k:v for k,v in json.loads((JOB / 'final-candidate-identity.json').read_text()).items()
                  if k in ['tree', 'owned_path_count', 'changed_path_count', 'changed_markdown_count', 'landing_copy_count', 'frozen_source_rows_verified']}))
