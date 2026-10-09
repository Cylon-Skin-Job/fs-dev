from pathlib import Path
import hashlib, json, os, stat, subprocess
from datetime import datetime, timezone

JOB = Path(__file__).resolve().parent
CANDIDATE = Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
SOURCE = Path('/Users/rccurtrightjr./projects/fs-dev')

def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})

def check_leaf(repo, row):
    p = repo / row['path']
    if row['kind'] == 'absent':
        assert not p.exists() and not p.is_symlink(), row['path']
        return
    assert p.is_file() and not p.is_symlink(), row['path']
    assert hashlib.sha256(p.read_bytes()).hexdigest() == row['sha256'], row['path']
    if 'mode' in row:
        mode = row['mode']
        if isinstance(mode, str):
            mode = int(mode, 8)
        assert stat.S_IMODE(p.stat().st_mode) == mode, row['path']

identity = json.loads((JOB / 'final-candidate-identity.json').read_text())
assert git(CANDIDATE, 'rev-parse', '--show-toplevel').decode().strip() == str(CANDIDATE)
assert git(CANDIDATE, 'branch', '--show-current').decode().strip() == identity['branch']
assert git(CANDIDATE, 'ls-files', '--stage', '-z') == git(CANDIDATE, 'ls-tree', '-r', '-z', '--format=%(objectmode) %(objectname) 0%x09%(path)', identity['tree'])
check_leaf(CANDIDATE, identity['deferred_restart_article'])
for r in json.loads((JOB / 'final-candidate-owned-inventory.json').read_text()):
    check_leaf(CANDIDATE, r)
support = json.loads((JOB / 'final-candidate-runtime-support.json').read_text())
for r in support:
    check_leaf(CANDIDATE, r)
runtime = {r['path'] for r in support}
unstaged = {p.decode() for p in git(CANDIDATE, 'diff', '--name-only', '-z').split(b'\0') if p}
untracked = {p.decode() for p in git(CANDIDATE, 'ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if p}
assert unstaged.issubset(runtime), sorted(unstaged - runtime)
assert untracked.issubset(runtime), sorted(untracked - runtime)
server = json.loads((JOB / 'unaffected-evidence-dependencies.json').read_text())
for r in server['comparisons']:
    check_leaf(CANDIDATE, {'path': r['path'], **r['candidate']})
    check_leaf(SOURCE, {'path': r['path'], **r['source']})
wiki = json.loads((JOB / 'wiki-editor/current-byte-evidence.json').read_text())
for r in wiki['sources']:
    check_leaf(CANDIDATE, r)
for packet in ['wiki-editor/handoff-manifest.json', 'screenshot-repair/handoff-manifest.json']:
    for r in json.loads((JOB / packet).read_text())['files']:
        assert hashlib.sha256(Path(r['path']).read_bytes()).hexdigest() == r['sha256'], r['path']
receipt = {'at': datetime.now(timezone.utc).isoformat(), 'candidate': str(CANDIDATE),
           'tree': identity['tree'], 'candidate_head': git(CANDIDATE, 'rev-parse', 'HEAD').decode().strip(),
           'owned_paths_match': identity['owned_path_count'], 'runtime_support_match': len(support),
           'unchanged_backend_electron_comparisons': len(server['comparisons']),
           'wiki_source_dependencies': len(wiki['sources']),
           'unstaged_runtime_only': sorted(unstaged), 'untracked_runtime_only': sorted(untracked),
           'sealed_leaf_evidence_matches': True}
print(json.dumps(receipt))
