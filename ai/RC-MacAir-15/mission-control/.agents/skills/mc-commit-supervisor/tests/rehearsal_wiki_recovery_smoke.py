"""Prove exact Wiki preimages and newest-first supplemental public recovery."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

config = json.loads(Path(sys.argv[1]).read_text())
evidence = Path(sys.argv[2]).resolve()
repo = Path(config['candidate'])
assert str(repo).startswith('/private/tmp/mc-s6-')
helper = Path(__file__).resolve().parents[1] / 'scripts/job_snapshot.py'
original = evidence / 'preparation-recovery'
scope = json.loads((evidence / 'owned-paths.json').read_text())
names = [item['path'] for item in scope['paths']]
page = Path(config['wiki']) / '001-Checklist/001-Checklist_Guide/PAGE.md'
navigation = Path(config['wiki']) / '001-Checklist/002-Navigation_Guide/PAGE.md'
assert page.is_file() and navigation.is_file()
page_name = str(page.relative_to(repo))
assert page_name in names
records, stages = [], []

def sha(data):
    return hashlib.sha256(data).hexdigest()

def state():
    def git(*args):
        return subprocess.check_output(['git', '-C', str(repo), *args], env=dict(os.environ, GIT_OPTIONAL_LOCKS='0'))
    return {'status_z': git('status', '--porcelain=v1', '-z', '--untracked-files=all').hex(),
            'index': sha((repo / '.git/index').read_bytes()), 'head': git('rev-parse', 'HEAD').decode(),
            'refs': git('show-ref').decode(),
            'leaves': {n: {'sha256': sha((repo / n).read_bytes()) if (repo / n).is_file() else None,
                           'symlink': os.readlink(repo / n) if (repo / n).is_symlink() else None,
                           'mode': (repo / n).lstat().st_mode if (repo / n).exists() or (repo / n).is_symlink() else None}
                       for n in names}}

def cli(command, job, paths=None, receipt=None, expected=0):
    args = [sys.executable, '-B', str(helper), command, '--job', str(job)]
    if command != 'verify': args += ['--repo', str(repo)]
    if paths: args += ['--paths-file', str(paths)]
    if receipt: args += ['--ownership-file', str(receipt)]
    result = subprocess.run(args, capture_output=True, text=True, env=dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))
    records.append({'command': args, 'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
    assert result.returncode == expected, records[-1]
    return json.loads(result.stdout if expected == 0 else result.stderr)

assert cli('verify', original)['matches_checkpoint']
baseline = state()
nav_before = navigation.read_bytes()
manifest_hashes = {str(original): sha((original / 'recovery/manifest.json').read_bytes())}
for number in (1, 2):
    # Local filename time is selected from the actual clock before capture.
    while True:
        selected = datetime.now().astimezone()
        version = page.parent / '.versions' / (selected.strftime('%Y-%m-%d-%H%M%S') + '.md')
        if not version.exists(): break
        time.sleep(0.1)
    version_name = str(version.relative_to(repo))
    assert version_name not in names
    names.append(version_name)
    declaration = dict(scope)
    declaration['paths'] = scope['paths'] + [{'path': s['version_name'], 'job_created': True} for s in stages] + [
        {'path': version_name, 'job_created': True}]
    declaration['ignored_runtime_paths'] = scope['ignored_runtime_paths']
    job = evidence / f'wiki-supplement-{number}'
    job.mkdir()
    paths, receipt = job / 'owned-paths.json', job / 'ownership.json'
    paths.write_text(json.dumps(declaration, indent=2) + '\n')
    receipt.write_text(json.dumps({'owner': scope['owner'], 'conflicting_writers': [], 'paths': names}, indent=2) + '\n')
    cli('capture', job, paths=paths)
    manifest_hashes[str(job)] = sha((job / 'recovery/manifest.json').read_bytes())
    manifest = json.loads((job / 'recovery/manifest.json').read_text())
    assert manifest['owned'][version_name]['worktree'] == {'kind': 'missing'}
    before = page.read_bytes()
    version.parent.mkdir(exist_ok=True)
    copy_at = datetime.now(timezone.utc).isoformat()
    with version.open('xb') as output: output.write(before)
    assert version.read_bytes() == before, 'version must retain the entire PAGE preimage'
    write_at = datetime.now(timezone.utc).isoformat()
    page.write_bytes(before + f'\n<!-- PREPARATION RECOVERY MECHANIC {number}; actual UTC {write_at} -->\n'.encode())
    stages.append({'job': str(job), 'version_name': version_name, 'selected_local_time': selected.isoformat(),
                   'copied_at_utc': copy_at, 'page_written_at_utc': write_at,
                   'page_preimage_sha256': sha(before), 'version_sha256': sha(version.read_bytes()),
                   'page_after_sha256': sha(page.read_bytes())})

before_refusal = state()
refusal = cli('guard', original, receipt=evidence / 'ownership.json', expected=1)
assert 'unrelated entries changed' in refusal['reason']
assert state() == before_refusal, 'original guard refusal must not mutate code/index/refs'
for stage in reversed(stages):
    job = Path(stage['job'])
    cli('guard', job, receipt=job / 'ownership.json')
    cli('restore', job)
    assert cli('verify', job)['matches_checkpoint']
    assert not (repo / stage['version_name']).exists()
cli('guard', original, receipt=evidence / 'ownership.json')
cli('restore', original)
assert cli('verify', original)['matches_checkpoint']
assert navigation.read_bytes() == nav_before
restored = state()
for stage in stages: restored['leaves'].pop(stage['version_name'])
assert restored['leaves'] == baseline['leaves'] and restored['status_z'] == baseline['status_z']
assert restored['head'] == baseline['head'] and restored['refs'] == baseline['refs']
assert all(sha((Path(job) / 'recovery/manifest.json').read_bytes()) == value for job, value in manifest_hashes.items())
(evidence / 'wiki-recovery-smoke.json').write_text(json.dumps({'kind': 'PREPARATION_SUPPLEMENTAL_RECOVERY_ONLY',
    'stages': stages, 'commands': records, 'immutable_manifest_hashes': manifest_hashes,
    'original_guard_refused_nonmutating': True, 'restore_order': [s['job'] for s in reversed(stages)] + [str(original)],
    'navigation_unchanged_sha256': sha(nav_before), 'final_original_matches': True,
    'index_physical_hash_equal': baseline['index'] == restored['index'],
    'actual_supervisor_wiki_checkpoints': 'required independently later'}, indent=2) + '\n')
print(json.dumps({'result': 'PASS', 'supplements': len(stages), 'original_refusal_nonmutating': True}))
