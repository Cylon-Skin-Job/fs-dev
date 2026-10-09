"""Read back assigned S5 artifacts; keep raw commands and current-byte identity."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import stat
import subprocess
import tomllib
from urllib.parse import unquote

C = Path(__file__).resolve().parents[4]
E = Path(__file__).resolve().parent
R = C.parents[2]
K = C / '.agents/skills/mc-commit-supervisor'
pre = json.loads((E / 'preimages.json').read_text())
paths = [Path(x['path']) for x in pre]
checks = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def command(args, name, env=None):
    p = subprocess.run(args, cwd=C, env=env, text=True, capture_output=True)
    log = E / (name + '.log')
    log.write_text(p.stdout + p.stderr)
    checks.append(dict(command=args, cwd=str(C), exit=p.returncode, log=str(log), log_sha256=digest(log)))
    assert p.returncode == 0, f'{name}: {p.stdout}{p.stderr}'

env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
command(['/opt/homebrew/bin/python3.12', '-B', str(C / '.agents/skills/mc-memory-maintenance/scripts/validate_index.py'), str(C)], 'index', env)
yaml_root = '/Users/rccurtrightjr./.cache/uv/archive-v0/1UkvUmdhPW76cwEoYNqku'
assert (Path(yaml_root) / 'yaml/__init__.py').exists()
yaml_env = dict(env, PYTHONPATH=yaml_root)
for name in ['mc-commit-supervisor', 'mc-code-review-orchestrator', 'mc-commit-repair-worker', 'mission-control', 'monitor', 'status', 'mc-roadmap-implementation-supervisor']:
    command(['/opt/homebrew/bin/python3.12', '-B', '/Users/rccurtrightjr./.codex/skills/.system/skill-creator/scripts/quick_validate.py', str(C / '.agents/skills' / name)], 'skill-' + name, yaml_env)

config = tomllib.loads((C / '.codex/config.toml').read_text())
oldconfig = tomllib.loads((E / 'preimages/.codex/config.toml').read_text())
assert {k: v for k, v in config.items() if k != 'agents'} == {k: v for k, v in oldconfig.items() if k != 'agents'}
assert config['sandbox_mode'] == 'danger-full-access' and config['approval_policy'] == 'never'
assert 'mc-review-and-merge' not in config['agents']
assert len(config['agents']) == 12
for name, mapping in config['agents'].items():
    path = C / '.codex' / mapping['config_file']
    profile = tomllib.loads(path.read_text())
    assert profile['name'] == name
    assert not any(k in profile for k in ['model', 'model_reasoning_effort', 'reasoning_effort'])
    if name in oldconfig['agents']:
        assert mapping == oldconfig['agents'][name]
assert len(list((C / '.agents/skills').glob('*/SKILL.md'))) + len(list((C / 'launchpad/.agents/skills').glob('*/SKILL.md'))) == 22

for x in pre:
    p = Path(x['path'])
    if p.exists() and not x.get('absent'):
        assert stat.S_IMODE(p.stat().st_mode) == x['mode'], str(p)
old_workflow = (E / 'preimages/.agents/skills/mc-commit-supervisor/references/workflow.md').read_bytes()
assert (K / 'references/workflow.md').read_bytes().startswith(old_workflow)
old_template = (E / 'preimages/.agents/skills/mc-commit-supervisor/references/job-template.md').read_bytes()
assert (K / 'references/job-template.md').read_bytes().startswith(old_template)
assert len((K / 'references/workflow.md').read_text().splitlines()) < 400

links = []
bad = []
for p in paths:
    if p.suffix != '.md' or not p.exists():
        continue
    text = p.read_text()
    for m in re.finditer(r'\]\((?:<([^>]+)>|([^\s)]+))\)', text):
        target = m.group(1) or m.group(2)
        if '://' in target or target.startswith('#'):
            continue
        file = unquote(target.split('#')[0])
        if not file:
            continue
        dest = (p.parent / file).resolve()
        links.append(dict(source=str(p), target=target, resolved=str(dest)))
        if not dest.exists():
            bad.append(links[-1])
assert not bad, json.dumps(bad, indent=2)
(E / 'links.json').write_text(json.dumps(links, indent=2) + '\n')

raw = subprocess.run(['rg', '-n', '--hidden', '-i', 'mc-review-and-merge|Review and Merge', '.agents', '.codex', 'AGENTS.md', 'session-contract.md', 'record-templates.md', 'mission-control.md', 'deployment.md', 'registry.md', 'todo.md', 'handoff.md', 'skills-and-agents.md', 'index.json', 'review-and-merge-design.md', 'review-and-merge-handoff.md', 'decisions.md', 'changelog.md'], cwd=C, text=True, capture_output=True)
assert raw.returncode in (0, 1)
(E / 'legacy-sweep.log').write_text(raw.stdout + raw.stderr)
aliases = []
for line in raw.stdout.splitlines():
    path, number, prose = line.split(':', 2)
    if path == 'AGENTS.md' or path == 'mission-control.md':
        classification = 'explicit historical alias under D-024'
    elif path == 'registry.md':
        classification = 'explicit searchable historical alias; canonical entry current'
    elif path.startswith('.agents/'):
        assert path.endswith('references/owner-publication.md'), line
        classification = 'legacy-job evidence preservation/successor rule; no actual legacy job found'
    elif path.startswith('.codex/') or path in ['session-contract.md', 'record-templates.md']:
        raise AssertionError('Active legacy route: ' + line)
    elif path in ['review-and-merge-design.md', 'review-and-merge-handoff.md']:
        classification = 'historical design/hierarchy; new cutover note explicitly routes current entry/profile'
    elif path == 'deployment.md':
        classification = 'historical D-021 installation or explicit S5 retirement record'
    elif path == 'handoff.md':
        classification = 'earlier dated setup/planning/creation outcome under new current continuation'
    elif path == 'todo.md':
        classification = 'historical installation or explicit current retirement record'
    elif path == 'skills-and-agents.md':
        classification = 'explicit current retirement record'
    elif path in ['decisions.md', 'changelog.md', 'index.json']:
        classification = 'immutable decision/dated history or static historical heading/provenance route'
    else:
        raise AssertionError(line)
    aliases.append(dict(path=path, line=int(number), text=prose, classification=classification))
(E / 'legacy-classification.json').write_text(json.dumps(aliases, indent=2) + '\n')

baseline = json.loads((E / 'baseline.json').read_text())
head = subprocess.check_output(['git', '--no-optional-locks', 'rev-parse', 'HEAD'], cwd=R, text=True).strip()
assert head == baseline['head']
assert digest(R / '.git/index') == baseline['index_sha256']
owned = {str(p.relative_to(R)) for p in paths}
ledger = json.loads((E.parent / 'slice-ledger.json').read_text())
for s in ledger['slices'][:4]:
    assert s['state'] == 'accepted'
    for x in s['current_revision']:
        p = Path(x['path'])
        if p.is_relative_to(R):
            owned.add(str(p.relative_to(R)))
        if p not in paths:
            assert p.exists() and digest(p) == x['sha256'], str(p)
            if 'mode' in x:
                assert stat.S_IMODE(p.stat().st_mode) == x['mode'], str(p)
sourcebaseline = json.loads((E.parent / 'source-file-baseline.json').read_text())
preserved = []
drift = []
for rel, x in sourcebaseline.items():
    if rel in owned:
        continue
    p = R / rel
    if x['kind'] == 'file':
        if not p.is_file() or digest(p) != x['sha256'] or stat.S_IMODE(p.stat().st_mode) != x['mode']:
            drift.append(rel)
        else:
            preserved.append(rel)
    elif x['kind'] == 'symlink':
        if not p.is_symlink() or os.readlink(p) != x['target']:
            drift.append(rel)
        else:
            preserved.append(rel)
assert not drift, drift
command(['/opt/homebrew/bin/python3.12', '-B', '-m', 'unittest', 'discover', '-s', str(K / 'tests'), '-p', 'test_*.py', '-v'], 'cumulative-python', env)
node_env = dict(env, FUSION_RESTART_TEST_EVIDENCE=str(E / 'restart-fixture-evidence'))
command(['/opt/homebrew/bin/node', '--test', str(K / 'tests/test_restart_runtime.mjs')], 'cumulative-node', node_env)
manifest = []
for p in paths:
    rel = str(p.relative_to(C))
    if p.exists():
        manifest.append(dict(path=str(p), relative=rel, sha256=digest(p), mode=stat.S_IMODE(p.stat().st_mode), bytes=p.stat().st_size, lines=len(p.read_text().splitlines())))
    else:
        manifest.append(dict(path=str(p), relative=rel, absent=True))
(E / 'current-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
result = dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), checks=checks,
              static=dict(profiles=12, skills=22, all_profile_paths_resolve=True, model_override=False,
                          non_agent_config_unchanged=True, full_access_retained=True, indexed_documents=21,
                          links=len(links), remaining_aliases=len(aliases), each_alias_classified=True,
                          legacy_entry_profile_absent=True, accepted_workflow_and_template_prefixes_equal=True,
                          current_modes_equal=True), source=dict(head=head, index_sha256=digest(R / '.git/index'),
                          preserved_unowned_baseline_files=len(preserved), unowned_drift=drift),
              runtime='S6 required; S5 does not claim actual app/profile/role rehearsal',
              manifest=str(E / 'current-manifest.json'), manifest_sha256=digest(E / 'current-manifest.json'))
(E / 'checks.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
