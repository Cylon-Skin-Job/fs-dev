"""One assigned worktree-leaf restoration with read-only preservation checks."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import stat
import subprocess

HOME = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
JOB = HOME / 'jobs/commit-supervisor/chat-ar-20261006'
REPORT = JOB / 'restart-wiki-scope-repair'
RECOVERY = JOB / 'restart-wiki-deferral-recovery'
CANDIDATE = Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
SOURCE = Path('/Users/rccurtrightjr./projects/fs-dev')
OWNED = 'ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/004-Fusion_Restart/PAGE.md'
TARGET = '3356e1b73cc5d44028eac5baa02fd542a8bbc385'
PREIMAGE_HASH = 'b3b4526b10f15e1a7305fbb55bdf62660c95dba41d58f3a29c35d3840b506977'
CURRENT_HASH = 'ccf7a76b4201ce3f5a95b29816f72f85cf1506b6f94172a581c100170dd4b94e'
TARGET_HASH = 'fa7ecb9041a4d4c9f2f24cba9386b3e844a6dbe98c9af52063b05fe90345a9f0'
COMMANDS = []


def sha(data):
    return hashlib.sha256(data).hexdigest()


def run(args, cwd=HOME):
    result = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    number = len(COMMANDS) + 1
    for stream in ['stdout', 'stderr']:
        with (REPORT / f'command-{number:03d}.{stream}.bin').open('xb') as output:
            output.write(getattr(result, stream))
    COMMANDS.append({'argv': args, 'cwd': str(cwd), 'exit_code': result.returncode,
                     'stdout_sha256': sha(result.stdout), 'stdout_path': f'command-{number:03d}.stdout.bin',
                     'stderr_path': f'command-{number:03d}.stderr.bin', 'stderr': result.stderr.decode(errors='replace')})
    if result.returncode:
        raise RuntimeError(str(COMMANDS[-1]))
    return result.stdout


def git(repo, *args):
    return run(['git', '--no-optional-locks', '-C', str(repo), *args])


def write_json(name, data):
    with (REPORT / name).open('x') as output:
        json.dump(data, output, indent=2, sort_keys=True)
        output.write('\n')


def leaf(path):
    if not path.exists() and not path.is_symlink():
        return {'kind': 'missing'}
    details = path.lstat()
    if stat.S_ISLNK(details.st_mode):
        return {'kind': 'symlink', 'target': os.readlink(path)}
    assert stat.S_ISREG(details.st_mode), str(path)
    return {'kind': 'file', 'mode': stat.S_IMODE(details.st_mode), 'sha256': sha(path.read_bytes())}


def inventory(repo):
    names = git(repo, 'ls-files', '--cached', '--others', '--exclude-standard', '-z')
    return {name: leaf(repo / name) for name in sorted(set(os.fsdecode(v) for v in names.split(b'\0') if v))}


def sentinel(repo):
    directory = Path(git(repo, 'rev-parse', '--absolute-git-dir').decode().strip())
    assert not (directory / 'index.lock').exists()
    return {'head': git(repo, 'rev-parse', 'HEAD').decode().strip(),
            'branch': git(repo, 'symbolic-ref', 'HEAD').decode().strip(),
            'index_raw_sha256': sha((directory / 'index').read_bytes()),
            'index_semantic_sha256': sha(git(repo, 'ls-files', '--stage', '-z')),
            'refs_sha256': sha(git(repo, 'show-ref', '--head')),
            'config_sha256': sha((directory / 'config').read_bytes())}


def source_leaves():
    dependencies = [OWNED, 'restart-fusion.sh', 'scripts/fusion-restart.mjs',
                    'scripts/fusion-restart-target.mjs', 'scripts/fusion-restart-processes.mjs',
                    'scripts/fusion-restart-probe.mjs', 'AGENTS.md',
                    'ai/RC-MacAir-15/Wiki/AGENTS.md']
    dependencies.extend(str(p.relative_to(SOURCE)) for p in sorted((SOURCE / OWNED).parent.glob('.versions/*')))
    return {p: leaf(SOURCE / p) for p in dependencies}


manifest_bytes = (RECOVERY / 'recovery/manifest.json').read_bytes()
assert sha(manifest_bytes) == PREIMAGE_HASH
manifest = json.loads(manifest_bytes)
assert manifest['repository']['root'] == str(CANDIDATE)
assert manifest['repository']['git_dir'] == str(CANDIDATE / '.git')
assert manifest['repository']['common_dir'] == str(CANDIDATE / '.git')
assert list(manifest['owned']) == [OWNED]
assert manifest['target_commit'] == TARGET
seal = json.loads((JOB / 'final-review/seal.json').read_text())
assert seal['state'] == 'REVIEW_COMPLETE' and seal['reviewers_terminal'] is True
assert seal['tree'] == '1befa26e94a3487ef91d309665ff389b2e959b65'
assert 'FINAL-DOC-001' in seal['pending_material_ids']
sealed_files = {p: sha((JOB / 'final-review' / p).read_bytes()) for p in seal['files']}
assert sealed_files == seal['files']
verify_argv = ['python3', str(HOME / '.agents/skills/mc-commit-supervisor/scripts/job_snapshot.py'),
               'verify', '--job', str(RECOVERY)]
verification = run(verify_argv)
with (REPORT / 'pre-edit-verify.raw.json').open('xb') as output:
    output.write(verification)
verified = json.loads(verification)
assert verified['payloads_valid'] is True and verified['matches_checkpoint'] is True
assert verified['manifest_sha256'] == PREIMAGE_HASH

target = git(CANDIDATE, 'show', TARGET + ':' + OWNED)
target_entry = git(CANDIDATE, 'ls-tree', TARGET, '--', OWNED).decode().strip()
assert target_entry.startswith('100644 blob 441285d978daaee194b9c9cdfb864cff4a80b731\t')
assert sha(target) == TARGET_HASH
before = {'candidate': sentinel(CANDIDATE), 'source': sentinel(SOURCE),
          'candidate_leaves': inventory(CANDIDATE), 'source_leaves': source_leaves(),
          'seal_sha256': sha((JOB / 'final-review/seal.json').read_bytes()), 'sealed_files': sealed_files}
assert before['candidate']['head'] == TARGET
assert before['candidate']['branch'] == 'refs/heads/codex/chat-retirement-and-startup-repair'
assert before['source']['head'] == 'd15792920731f85e45b743519d4af2b807d95a9c'
assert before['source']['index_raw_sha256'] == manifest['baseline']['protected'][str(SOURCE)]['index_file_sha256']
assert before['candidate']['index_raw_sha256'] == manifest['baseline']['refs']['index_file_sha256']
assert before['candidate_leaves'][OWNED] == {'kind': 'file', 'mode': 420, 'sha256': CURRENT_HASH}
assert before['source_leaves'][OWNED]['sha256'] == CURRENT_HASH
write_json('pre-edit-state.json', before)

# Final immediate readback: no parent traversal or latest-byte replacement.
path = CANDIDATE / OWNED
assert path.resolve() == path
assert leaf(path) == before['candidate_leaves'][OWNED]
assert sentinel(CANDIDATE) == before['candidate']
assert sentinel(SOURCE) == before['source']
assert source_leaves() == before['source_leaves']
with path.open('wb') as output:
    output.write(target)
    output.flush()
    os.fsync(output.fileno())
assert leaf(path) == {'kind': 'file', 'mode': 420, 'sha256': TARGET_HASH}
assert path.read_bytes() == target

after = {'candidate': sentinel(CANDIDATE), 'source': sentinel(SOURCE),
         'candidate_leaves': inventory(CANDIDATE), 'source_leaves': source_leaves(),
         'seal_sha256': sha((JOB / 'final-review/seal.json').read_bytes()),
         'sealed_files': {p: sha((JOB / 'final-review' / p).read_bytes()) for p in seal['files']}}
changed = sorted(p for p in set(before['candidate_leaves']) | set(after['candidate_leaves'])
                 if before['candidate_leaves'].get(p) != after['candidate_leaves'].get(p))
assert changed == [OWNED], changed
assert after['candidate'] == before['candidate']
assert after['source'] == before['source']
assert after['source_leaves'] == before['source_leaves']
assert after['seal_sha256'] == before['seal_sha256'] and after['sealed_files'] == before['sealed_files']
write_json('post-edit-state.json', after)
receipt = {'state': 'WORKTREE_RESTORED_PENDING_INDEPENDENT_REVIEW', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'controller_home': str(HOME), 'memory_cwd': str(HOME), 'worker': '/root/restart_wiki_scope_repair',
           'manager': '/root', 'finding': 'FINAL-DOC-001', 'assigned_paths': [OWNED],
           'candidate': str(CANDIDATE), 'source': str(SOURCE), 'target': TARGET,
           'target_entry': target_entry, 'preimage_manifest_sha256': PREIMAGE_HASH,
           'preimage_article_sha256': CURRENT_HASH, 'current_article_sha256': TARGET_HASH,
           'current_article_size': len(target), 'mode': '100644/0644', 'changed_candidate_paths': changed,
           'unrelated_candidate_leaves_checked': len(before['candidate_leaves']) - 1,
           'candidate_index_raw_and_semantic_unchanged': True, 'candidate_refs_unchanged': True,
           'source_index_raw_and_semantic_refs_unchanged': True, 'source_article_versions_and_dependencies_unchanged': True,
           'sealed_review_unchanged': True, 'candidate_article_index_remains_preimage': True,
           'root_must_stage_only_this_entry_and_remove_current_revision_from_publication_selectors': True,
           'runtime_effects': False, 'independent_review_performed_by_worker': False}
write_json('restoration-receipt.json', receipt)
write_json('commands.json', COMMANDS)
print(json.dumps(receipt, indent=2))
