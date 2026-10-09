"""Read source hashes and protected process/storage metadata without user content."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

evidence = Path(__file__).resolve().parent
initial = json.loads((evidence / 'entry-baseline.json').read_text())
identity = json.loads((evidence / 'protected-identity-before-canonical.json').read_text())
repo = Path(initial['source_repo'])
owned = [str(evidence.relative_to(repo)) + '/', str((Path(initial['controller_home']) / '.agents/skills/mc-commit-supervisor/tests').relative_to(repo)) + '/']

def run(*args):
    return subprocess.check_output(args, env=dict(os.environ, GIT_OPTIONAL_LOCKS='0'))

def leaf(path):
    if not path.exists() and not path.is_symlink(): return {'exists': False}
    stat = path.lstat()
    data = os.fsencode(os.readlink(path)) if path.is_symlink() else path.read_bytes()
    return {'exists': True, 'sha256': hashlib.sha256(data).hexdigest(), 'dev': stat.st_dev,
            'ino': stat.st_ino, 'mode': stat.st_mode, 'size': stat.st_size}

names = set(initial['unowned'])
for args in [('diff', '--name-only', '-z'), ('diff', '--cached', '--name-only', '-z'), ('ls-files', '--others', '--exclude-standard', '-z')]:
    names.update(os.fsdecode(n) for n in run('git', '-C', str(repo), *args).split(b'\0') if n)
names = sorted(n for n in names if not any(n.startswith(p) for p in owned))
processes = []
for record in identity['processes']:
    pid = str(record['pid'])
    ps = subprocess.run(['ps', '-p', pid, '-o', 'pid=,ppid=,lstart=,command='], capture_output=True, text=True)
    files = subprocess.run(['lsof', '-a', '-p', pid, '-d', 'cwd,txt', '-Fn'], capture_output=True, text=True)
    processes.append({'pid': record['pid'], 'identity': ps.stdout.strip(), 'ps_exit': ps.returncode,
                      'cwd_executable': files.stdout, 'lsof_exit': files.returncode})
result = {'at': datetime.now(timezone.utc).isoformat(), 'phase': sys.argv[1], 'repo': str(repo),
    'head': run('git', '-C', str(repo), 'rev-parse', 'HEAD').decode().strip(),
    'refs': run('git', '-C', str(repo), 'show-ref').decode(), 'index': leaf(repo / '.git/index'),
    'unowned': {n: leaf(repo / n) for n in names},
    'source_build_caches': {n: leaf(repo / n) for n in initial['source_build_caches']},
    'profile_storage': {n: dict(leaf(Path(n)), volatile=True) for n in identity['profile_storage']},
    'processes': processes, 'owned_exclusions': owned,
    'limit': 'DB/profile hashes are read-only; no user content inspected. Live hashes may vary; process/inode/config preservation compared explicitly.'}
Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'phase': result['phase'], 'unowned_leaves': len(names), 'cache_leaves': len(result['source_build_caches']),
                  'protected_processes': len(processes), 'head': result['head']}))
