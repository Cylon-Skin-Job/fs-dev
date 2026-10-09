"""Bounded Guide edit with exclusive preimage and exact dependency readbacks."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
R = C.parents[2]
P = Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate')
W = C.parent / 'Wiki'
J = C / 'jobs/commit-supervisor/rehearsal-20261004-s6'
O = J / 'workers'
U = J / 'recovery-supplements/fix-xy-wiki-1'
PAGE = 'rehearsal-workspace/ai/MC-S6/Wiki/001-Checklist/001-Checklist_Guide/PAGE.md'
VERSION = 'rehearsal-workspace/ai/MC-S6/Wiki/001-Checklist/001-Checklist_Guide/.versions/2026-10-04-095624.md'
MANIFEST_SHA = '5227a7a7d38dddec138aff13c16f2ee8a22bda1a53657f203a47d80857827617'
sys.path.insert(0, str(C / '.agents/skills/mc-commit-supervisor/scripts'))
from job_snapshot import load
from snapshot_state import digest, encoded, git, relevant_state, unrelated

def now():
    return datetime.now(timezone.utc).isoformat()

def read(path):
    return json.loads(Path(path).read_bytes())

def save(name, data):
    with (O / name).open('x') as output:
        json.dump(data, output, indent=2, ensure_ascii=False)
        output.write('\n')

def fp(path):
    path = Path(path)
    if not path.exists():
        return {'exists': False}
    before = path.stat()
    assert path.is_file() and not path.is_symlink(), str(path)
    data = path.read_bytes()
    after = path.stat()
    assert (before.st_ino, before.st_size, before.st_mtime_ns, before.st_mode) == (after.st_ino, after.st_size, after.st_mtime_ns, after.st_mode), str(path)
    return {'exists': True, 'kind': 'file', 'sha256': digest(data), 'mode': oct(after.st_mode), 'mtime_ns': after.st_mtime_ns, 'bytes': len(data)}

def matches(path, expected):
    actual = fp(path)
    for key, value in expected.items():
        if key in actual:
            assert actual[key] == value, (str(path), key, value, actual[key])
    return actual

def dependencies():
    coverage = read(J / 'fix-xy-wiki-original-coverage.json')
    acceptance = read(J / 'evidence/fix-xy-code-handoff-acceptance.json')
    reuse = read(J / 'evidence/fix-xy-unaffected-suite-reuse.json')
    routes = read(J / 'evidence/fix-xy-routed-standards.json')
    assert acceptance['result'] == 'HANDOFF_VALIDATED' and acceptance['actual_native_terminal'] is True
    assert acceptance['covered_identity_sha256'] == coverage['settled_source_identity']
    assert len(reuse['dependencies']) == 35 and reuse['mismatches'] == []
    result = {}
    for name, value in coverage['sources'].items():
        result[str(P / name)] = matches(P / name, value)
    for name, value in acceptance['dependencies'].items():
        result[str(P / name)] = matches(P / name, value)
    for group in ['authority_dependencies', 'configuration_dependencies']:
        for name, value in acceptance[group].items():
            result[name] = matches(name, value)
    for name, value in routes['routes'].items():
        result[name] = matches(name, value)
    for value in reuse['dependencies']:
        result[value['path']] = matches(value['path'], value)
    for value in [*reuse['raw'].values(), *reuse['commands']]:
        result[value['path']] = matches(value['path'], value)
    for name, absent in coverage['data_instruction_absences'].items():
        assert absent and not Path(name).exists(), name
        result[name] = fp(name)
    extra = [C / 'AGENTS.md', R / 'AGENTS.md', P / 'AGENTS.md', C / 'session-contract.md',
        W / '.codex/agents/wiki-repair-worker.toml', J / 'fix-xy-wiki-1-assignment.md',
        J / 'fix-xy-original-authority.md', J / 'fix-xy-wiki-original-coverage.json',
        J / 'evidence/fix-xy-code-handoff-acceptance.json', J / 'evidence/fix-xy-routed-standards.json',
        J / 'evidence/fix-xy-unaffected-suite-reuse.json', J / 'evidence/fix-xy-wiki-version-selection.json',
        J / 'evidence/fix-xy-wiki-union-capture-command.json', J / 'evidence/fix-xy-wiki-union-verify-command.json',
        P / 'fusion-studio-client/src/components/wiki/WikiExplorer.tsx',
        P / 'fusion-studio-client/src/lib/wiki-frontmatter.ts', P / 'fusion-studio-client/src/lib/front-matter.ts']
    for path in extra:
        result[str(path)] = fp(path)
    assert len(routes['routes']) == 2
    for value in reuse['commands']:
        receipt = read(value['path'])
        assert receipt['exit_code'] == 0
    for name in ['capture', 'verify']:
        receipt = read(J / f'evidence/fix-xy-wiki-union-{name}-command.json')
        assert receipt['exit_code'] == 0
        output = json.loads(receipt['stdout'])
        assert output['manifest_sha256'] == MANIFEST_SHA
        if name == 'verify':
            assert all(output[k] is True for k in ['payloads_valid', 'matches_checkpoint', 'status_equal'])
        else:
            assert output['paths'] == 130
    return result

def union():
    checkpoint, manifest = load(U)
    assert digest((checkpoint / 'manifest.json').read_bytes()) == MANIFEST_SHA
    assert len(manifest['owned']) == 130
    declared = manifest['owned'][VERSION]
    assert declared['job_created'] is True and declared['worktree'] == {'kind': 'missing'}
    assert declared['base'] == [] and declared['index'] == []
    return checkpoint, manifest

def all_pages():
    return {name: fp(P / name) for name in read(J / 'fix-xy-wiki-original-coverage.json')['pages']}

def precheck():
    checkpoint, manifest = union()
    state = relevant_state(P, manifest['owned'], manifest['protected_repos'])
    assert state == manifest['baseline']
    assert git(P, 'status', '--porcelain=v1', '-z', '--untracked-files=all').hex() == manifest['status_z_hex']
    assert not (P / VERSION).exists() and (P / VERSION).parent.is_dir()
    pages = all_pages()
    for name, expected in read(J / 'fix-xy-wiki-original-coverage.json')['pages'].items():
        matches(P / name, expected)
    deps = dependencies()
    data = {'at': now(), 'state': state, 'dependencies': deps, 'pages': pages,
        'manifest_sha256': MANIFEST_SHA, 'version_absent': True,
        'identity': {'actual_runtime_child': '/root/s6_supervisor_fix_xy_1/fix_xy_wiki_leaf_1',
        'manager': '/root/s6_supervisor_fix_xy_1', 'actual_cwd': str(Path.cwd()), 'controller_home': str(C),
        'permissions': 'danger-full-access / approval never', 'root_inheritance': 'model/effort inherited; no overrides; concrete values unexposed',
        'fallback': 'default runtime agent explicitly loaded exact installed Wiki Repair skill and TOML developer instructions', 'leaf': True}}
    assert Path.cwd() == C
    save('fix-xy-wiki-1-precheck.json', data)
    print(json.dumps({'at': data['at'], 'owned_leaves': 130, 'manifest_sha256': MANIFEST_SHA,
        'dependencies_read_back': len(deps), 'full_union_equal': True, 'page_sha256': pages[PAGE]['sha256'], 'version_absent': True}))

def body(stamp):
    return f'''---
name: Checklist Guide
description: How to complete, reset and revisit the disposable checklist.
metadata:
  source-files:
    - rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/checklist-controller.js
    - rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/checklist-view.js
    - rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/index.html
    - scripts/fusion-restart-target.mjs
    - scripts/fusion-restart.mjs
  last-modified: "{stamp}"
---

# Checklist Guide

The checklist contains Review report (`draft`), Review sources (`review`) and Send summary (`send`). These task IDs remain stable. Select a task checkbox to complete it; clear the checkbox to make it incomplete again. All three task rows and their checkboxes remain visible, including completed tasks.

The summary uses `N remaining of 3`, where N counts incomplete tasks. With all tasks incomplete it reads `3 remaining of 3`. Complete Review report to reach `2 remaining of 3`, then Review sources to reach `1 remaining of 3`; clear Review report to return to `2 remaining of 3`. Completing every task reaches `0 remaining of 3`, and clearing every checkbox returns to `3 remaining of 3`.

An ordinary iframe or shell reload within the same profile retains completion. After the example above, reloading keeps Review sources checked, Review report and Send summary incomplete, and the summary at `2 remaining of 3`.

Select Reset completion to uncheck all three tasks. The summary immediately becomes `3 remaining of 3`, and the reset completion state is saved immediately. All three rows, task IDs and labels remain. For example, complete Review report and Review sources, then reset: all three tasks become incomplete. An ordinary reload within the same profile retains this reset, with every checkbox unchecked and `3 remaining of 3`.

A full canonical development restart clears browser storage, including Local Storage and Session Storage, before the checklist initializes, so it starts with all three tasks incomplete and `3 remaining of 3`.

Open the built-in Wiki view to return to this guide. See the [Navigation Guide](../002-Navigation_Guide/PAGE.md) for movement between views.
'''

def write():
    before = read(O / 'fix-xy-wiki-1-precheck.json')
    checkpoint, manifest = union()
    assert dependencies() == before['dependencies']
    assert all_pages() == before['pages']
    state = relevant_state(P, manifest['owned'], manifest['protected_repos'])
    assert state == before['state']
    current = (P / PAGE).read_bytes()
    assert digest(current) == 'a3d372eba6208c2fbee71cd046f305a91fc7c44185c5dae42b5da50e5cbcfdce'
    with (P / VERSION).open('xb') as output:
        output.write(current)
        output.flush()
        os.fsync(output.fileno())
    captured_at = now()
    snapshot = (P / VERSION).read_bytes()
    assert snapshot == current and digest(snapshot) == digest(current)
    # The final recheck occurs after exclusive preimage readback and before replacement.
    assert dependencies() == before['dependencies']
    assert all_pages() == before['pages']
    state = relevant_state(P, manifest['owned'], manifest['protected_repos'])
    prior = json.loads(json.dumps(before['state']))
    prior['paths'][VERSION] = state['paths'][VERSION]
    assert state == prior
    assert (P / PAGE).read_bytes() == current and (P / VERSION).read_bytes() == current
    rechecked_at = now()
    write_clock = datetime.now(timezone.utc)
    stamp = write_clock.strftime('%Y-%m-%dT%H:%M:%SZ')
    replacement = body(stamp).encode()
    with (P / PAGE).open('r+b') as output:
        output.write(replacement)
        output.truncate()
        output.flush()
        os.fsync(output.fileno())
    assert (P / PAGE).read_bytes() == replacement
    data = {'captured_at': captured_at, 'preimage_path': str(P / VERSION),
        'complete_preimage_bytes': len(snapshot), 'preimage_sha256': digest(snapshot),
        'complete_preimage_readback': snapshot.decode(), 'dependencies_rechecked_at': rechecked_at,
        'write_clock': write_clock.isoformat(), 'quoted_last_modified': stamp,
        'written_at': now(), 'final_page': fp(P / PAGE), 'final_version': fp(P / VERSION)}
    save('fix-xy-wiki-1-write.json', data)
    print(json.dumps({k: v for k, v in data.items() if k != 'complete_preimage_readback'}, indent=2))

def check():
    before = read(O / 'fix-xy-wiki-1-precheck.json')
    written = read(O / 'fix-xy-wiki-1-write.json')
    checkpoint, manifest = union()
    assert dependencies() == before['dependencies']
    pages = all_pages()
    for name, original in before['pages'].items():
        if name != PAGE:
            assert pages[name] == original
    assert (P / VERSION).read_text() == written['complete_preimage_readback']
    assert fp(P / VERSION) == written['final_version']
    assert fp(P / PAGE) == written['final_page']
    state = relevant_state(P, manifest['owned'], manifest['protected_repos'])
    assert state['refs'] == before['state']['refs'] and state['protected'] == before['state']['protected']
    changed = [name for name in state['paths'] if state['paths'][name] != before['state']['paths'].get(name)]
    assert set(changed) == {PAGE, VERSION}
    assert unrelated(state, manifest['owned']) == unrelated(before['state'], manifest['owned'])
    for name in manifest['owned']:
        assert state['paths'][name]['index'] == before['state']['paths'][name]['index']
        assert state['paths'][name]['flag'] == before['state']['paths'][name]['flag']
    page = (P / PAGE).read_text()
    assert page == body(written['quoted_last_modified'])
    assert 'Draft report' not in page
    assert not any(token in page for token in ['incoming-edges:', 'outgoing-edges:', 'connected-skills:', 'related-trigger-files:', 'section-toc:', 'SPEC', 'HANDOFF', 'Supervisor', 'rehearsal-20261004-s6'])
    links = re.findall(r'\[[^]]+\]\(([^)]+)\)', page)
    assert links == ['../002-Navigation_Guide/PAGE.md']
    assert all(((P / PAGE).parent / link).resolve().is_file() for link in links)
    parser = '''const fs=require('node:fs');const yaml=require(process.cwd()+'/fusion-studio-server/node_modules/js-yaml');const text=fs.readFileSync(process.argv[1],'utf8');const front=text.split('---\\n')[1];console.log(JSON.stringify(yaml.load(front)));'''
    result = subprocess.run(['node', '-e', parser, str(P / PAGE)], cwd=P,
        env=dict(os.environ, GIT_OPTIONAL_LOCKS='0'), capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    parsed = json.loads(result.stdout)
    assert isinstance(parsed['name'], str) and parsed['name'].strip()
    assert isinstance(parsed['description'], str) and parsed['description'].strip()
    assert parsed['metadata']['last-modified'] == written['quoted_last_modified']
    assert re.search(r'last-modified: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"', page)
    sources = parsed['metadata']['source-files']
    assert len(sources) == len(set(sources)) == 5
    assert all((P / path).is_file() and not Path(path).is_absolute() and '*' not in path for path in sources)
    assert sources[2].endswith('/app/index.html')
    data = {'at': now(), 'result': 'SELF_CHECK_PASSED', 'independent_acceptance': False,
        'candidate_root': str(P), 'candidate_head': state['refs']['head'], 'candidate_branch': state['refs']['branch'],
        'full_130_changes': sorted(changed), 'unchanged_128_owned': True,
        'index_refs_configuration_and_protected_repositories_unchanged': True,
        'unrelated_candidate_entries_unchanged': True, 'source_authority_configuration_and_35_suite_dependencies_unchanged': True,
        'root_navigation_bytes_metadata_times_and_mtimes_unchanged': True,
        'preimage_exact_full_page_and_historical_metadata': True, 'strict_yaml': parsed,
        'links': links, 'current_pages': pages, 'version': fp(P / VERSION),
        'source_dependencies': dependencies(), 'full_current_state_sha256': digest(encoded(state)),
        'reused_suite_receipts': read(J / 'evidence/fix-xy-unaffected-suite-reuse.json')['commands'],
        'limits': 'Source/documentation self-check only; no independent acceptance, product test rerun or actual app/runtime verification.'}
    save('fix-xy-wiki-1-check.json', data)
    print(json.dumps({k: v for k, v in data.items() if k not in ['source_dependencies', 'strict_yaml', 'reused_suite_receipts']}, indent=2))

{'precheck': precheck, 'write': write, 'check': check}[sys.argv[1]]()
