"""Owned M1 check runner: source bindings, command, isolated port and raw log."""
import hashlib, json, os, pathlib, socket, subprocess, sys, time

ROOT = pathlib.Path('/Users/rccurtrightjr./.codex/worktrees/chat-material-01/fs-dev')
OUT = pathlib.Path(__file__).parent
PACKAGE = OUT.parent.parent
CLIENT = ROOT / 'fusion-studio-client'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode().strip()

def seal():
    changed = set(git('diff', '--name-only').splitlines()) | set(git('ls-files', '--others', '--exclude-standard').splitlines())
    changed.discard('fusion-studio-server/node_modules')
    return {'root': str(ROOT), 'HEAD': git('rev-parse', 'HEAD'), 'branch': git('branch', '--show-current'),
        'diff_sha256': hashlib.sha256(subprocess.check_output(['git', 'diff', '--binary'], cwd=ROOT)).hexdigest(),
        'changed_files': {name: digest(ROOT / name) for name in sorted(changed) if (ROOT / name).is_file()},
        'inputs': {str(p): digest(p) for p in [PACKAGE / n for n in
            ['SPEC.md', 'TICKET.md', 'OWNER-REQUEST.md', 'OWNER-APPROVAL.md', 'CANDIDATE.json', 'implementation/PREFLIGHT.json']]
            + [CLIENT / n for n in ['package.json', 'package-lock.json', 'playwright.chat-architecture.config.ts', 'e2e/chat-transport-test-server.mjs']]
            + [p for p in (CLIENT / 'src').rglob('*') if p.is_file()]
            + [p for p in (CLIENT / 'e2e').rglob('*') if p.is_file()]
            + [ROOT / 'AGENTS.md', ROOT / 'fusion-studio-server/package.json', ROOT / 'fusion-studio-server/package-lock.json']
            + [ROOT / 'ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md']
            + list((ROOT / 'ai/RC-MacAir-15/Wiki/007-Chat_System').rglob('PAGE.md'))
            + list((ROOT / 'ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards').rglob('PAGE.md'))},
        'dependency_links': {str(ROOT / n): os.readlink(ROOT / n) for n in
            ['fusion-studio-client/node_modules', 'fusion-studio-server/node_modules']}}

name, mode, *tests = sys.argv[1:]
env = os.environ.copy()
if mode == 'build':
    command = ['npm', 'run', 'build']
else:
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0)); port = probe.getsockname()[1]
    env['CHAT_TRANSPORT_TEST_PORT'] = str(port)
    command = ['npx', '--no-install', 'playwright', 'test', '--config=playwright.chat-architecture.config.ts',
        *tests, '--workers=1', '--output=' + str(OUT / (name + '-output'))]
receipt = {'name': name, 'command': command, 'cwd': str(CLIENT),
    'environment': {key: env[key] for key in ['CHAT_TRANSPORT_TEST_PORT'] if key in env},
    'started_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'before': seal()}
path = OUT / (name + '.json')
path.write_text(json.dumps(receipt, indent=2) + '\n')
with (OUT / (name + '.log')).open('w') as raw:
    result = subprocess.run(command, cwd=CLIENT, env=env, stdout=raw, stderr=subprocess.STDOUT)
receipt.update(exit_code=result.returncode, ended_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    log_sha256=digest(OUT / (name + '.log')), after=seal())
path.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'receipt': str(path), 'command': command, 'exit': result.returncode}))
sys.exit(result.returncode)
