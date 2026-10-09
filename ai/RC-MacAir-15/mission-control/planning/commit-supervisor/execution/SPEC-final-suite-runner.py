"""Root-owned final check orchestration; execute only after all six slices accepted."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, shutil, subprocess, sys
from urllib.parse import unquote, urlparse

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
R = C.parents[2]
E = C / 'planning/commit-supervisor/execution'
J = C / 'jobs/commit-supervisor/rehearsal-20261004-s6'
K = C / '.agents/skills/mc-commit-supervisor'
P = Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate')
OUT = E / 'SPEC-final-suite'

def now():
    return datetime.now(timezone.utc).isoformat()

def fp(path):
    path = Path(path)
    if not path.exists() and not path.is_symlink():
        return {'exists': False}
    s = path.lstat()
    data = os.fsencode(os.readlink(path)) if path.is_symlink() else path.read_bytes()
    return {'exists': True, 'kind': 'symlink' if path.is_symlink() else 'file',
            'mode': oct(s.st_mode), 'sha256': hashlib.sha256(data).hexdigest()}

def save(name, value):
    path = OUT / name
    with path.open('x') as f:
        json.dump(value, f, indent=2)
        f.write('\n')
    path.chmod(0o444)
    return path

def run(name, argv, cwd=C, overrides=None):
    env = dict(os.environ, GIT_OPTIONAL_LOCKS='0', PYTHONDONTWRITEBYTECODE='1')
    for key in list(env):
        if key.startswith('GIT_'):
            env.pop(key)
    env['GIT_OPTIONAL_LOCKS'] = '0'
    env.update(overrides or {})
    started = now()
    completed = subprocess.run(argv, cwd=cwd, env=env, capture_output=True, text=True)
    receipt = {'actor': '/root', 'argv': list(map(str, argv)), 'cwd': str(cwd),
               'started_at': started, 'finished_at': now(), 'exit_code': completed.returncode,
               'stdout': completed.stdout, 'stderr': completed.stderr,
               'environment_overrides': {'GIT_OPTIONAL_LOCKS': '0', 'PYTHONDONTWRITEBYTECODE': '1', **(overrides or {})},
               'executable': fp(shutil.which(argv[0]) or argv[0])}
    save(name, receipt)
    assert completed.returncode == 0, (name, completed.returncode)
    return receipt

def main():
    ledger = json.loads((E / 'slice-ledger.json').read_text())
    # Require the controller's explicit current all-slices acceptance receipt;
    # ledger shape is retained as raw input rather than guessed here.
    activation = json.loads((E / 'SPEC-final-check-activation.json').read_text())
    assert activation['accepted_slices'] == ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
    assert activation['actual_recovery_complete'] and activation['private_preview_stopped']
    OUT.mkdir(exist_ok=False)
    save('activation-readback.json', {'at': now(), 'activation': activation,
         'activation_fingerprint': fp(E / 'SPEC-final-check-activation.json'),
         'slice_ledger_fingerprint': fp(E / 'slice-ledger.json'),
         'runner_fingerprint': fp(__file__), 'bindings_fingerprint': fp(E / 'SPEC-final-python-bindings.py')})
    node = shutil.which('node'); assert node
    python = '/opt/homebrew/bin/python3.12'
    run('closure-command.json', [node, str(J / 'python_suite_js_dependencies_v3.mjs')])
    run('python-pre-command.json', [python, '-B', str(E / 'SPEC-final-python-bindings.py'), 'python-pre'])
    coverage = OUT / 'python-node-coverage'
    coverage.mkdir()
    py = run('python-command.json', [python, '-B', '-m', 'unittest', 'discover', '-v', '-s',
             str(K / 'tests'), '-p', 'test_*.py'], overrides={'NODE_V8_COVERAGE': str(coverage)})
    run('python-post-command.json', [python, '-B', str(E / 'SPEC-final-python-bindings.py'),
         'python-post', str(OUT / 'python-pre.json')])
    pre = json.loads((OUT / 'python-pre.json').read_text())
    post = json.loads((OUT / 'python-post.json').read_text())
    methods = pre['test_methods']
    log = py['stdout'] + py['stderr']
    assert len(methods) == 55 and 'Ran 55 tests' in log and '\nOK\n' in log
    for method in methods:
        assert method['test'] + ' (' in log, method
    executed = set()
    coverage_files = sorted(coverage.glob('*.json'))
    assert coverage_files
    for path in coverage_files:
        for item in json.loads(path.read_text())['result']:
            if item['url'].startswith('file:'):
                executed.add(unquote(urlparse(item['url']).path))
    missing = sorted(executed - set(pre['dependencies']))
    assert not missing, missing
    assert not post['dependency_mismatches']
    save('python-verification.json', {'at': now(), 'named_tests': len(methods),
         'dependency_count': len(pre['dependencies']), 'executed_js_files': sorted(executed),
         'executed_js_unbound': missing, 'coverage_files': {str(p): fp(p) for p in coverage_files},
         'pre': fp(OUT / 'python-pre.json'), 'post': fp(OUT / 'python-post.json'),
         'command': fp(OUT / 'python-command.json'), 'all_named_tests_reported': True,
         'dependency_mismatches': post['dependency_mismatches']})
    sources = ['restart-fusion.sh', 'scripts/fusion-restart.mjs',
               'scripts/fusion-restart-target.mjs', 'scripts/fusion-restart-processes.mjs',
               'scripts/fusion-restart-probe.mjs']
    paths = [K / 'tests/test_restart_runtime.mjs', *[base / leaf for base in [R, P] for leaf in sources],
             Path(node), Path(node).resolve(), Path(__file__).resolve()]
    before = {str(p): fp(p) for p in paths}
    save('node-pre.json', {'at': now(), 'dependencies': before,
         'version': run('node-version-command.json', [node, '--version'])['stdout'].strip()})
    evidence = OUT / 'node-fixtures'
    evidence.mkdir()
    n = run('node-command.json', [node, '--test', str(K / 'tests/test_restart_runtime.mjs')],
            overrides={'FUSION_RESTART_TEST_EVIDENCE': str(evidence)})
    after = {str(p): fp(p) for p in paths}
    assert before == after
    assert '# pass 17' in n['stdout'] and '# fail 0' in n['stdout']
    save('node-post.json', {'at': now(), 'dependencies': after, 'all_equal': True,
         'pass': 17, 'fail': 0, 'fixture_receipts': {str(p): fp(p) for p in sorted(evidence.glob('*.json'))}})
    run('bash-syntax-command.json', ['bash', '-n', str(R / 'restart-fusion.sh')])
    for i, leaf in enumerate(sources[1:]):
        run(f'node-source-syntax-{i}.json', [node, '--check', str(R / leaf)])
    for i, path in enumerate(sorted((K / 'tests').glob('*.mjs'))):
        run(f'node-helper-syntax-{i}.json', [node, '--check', str(path)])
    run('default-dry-run-command.json', ['bash', str(R / 'restart-fusion.sh'), '--dry-run'], cwd=R)
    print(json.dumps({'status': 'FINAL_SUITES_PASSED', 'python': 55, 'node': 17,
          'python_dependencies': len(pre['dependencies']), 'executed_js_bound': len(executed),
          'output': str(OUT)}), flush=True)

if __name__ == '__main__':
    main()
