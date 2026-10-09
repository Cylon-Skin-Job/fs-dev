"""Bounded first-candidate Wiki measurements and guarded article replacement."""
import json
import os
from pathlib import Path
import re
import stat
import sys
from datetime import datetime, timezone

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
P = Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate')
J = C / 'jobs/commit-supervisor/rehearsal-20261004-s6'
U = J / 'recovery-supplements/first-wiki-1'
G = 'rehearsal-workspace/ai/MC-S6/Wiki/001-Checklist/001-Checklist_Guide/PAGE.md'
V = G.replace('PAGE.md', '.versions/2026-10-04-080936.md')
sys.path.insert(0, str(C / '.agents/skills/mc-commit-supervisor/scripts'))
from job_snapshot import load, read_payload
from snapshot_state import digest, encoded, relevant_state

SOURCES = [
    'rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/checklist-controller.js',
    'rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/checklist-view.js',
    'scripts/fusion-restart-target.mjs',
    'scripts/fusion-restart.mjs',
]
BODY = '''# Checklist Guide

The checklist contains Draft report, Review sources and Send summary. Select a task checkbox to complete it; clear the checkbox to make it incomplete again. All three task rows and their checkboxes remain visible, including completed tasks.

The summary uses `N remaining of 3`, where N counts incomplete tasks. With all tasks incomplete it reads `3 remaining of 3`. Complete Draft report to reach `2 remaining of 3`, then Review sources to reach `1 remaining of 3`; clear Draft report to return to `2 remaining of 3`. Completing every task reaches `0 remaining of 3`, and clearing every checkbox returns to `3 remaining of 3`.

An ordinary iframe or shell reload within the same profile retains completion. After the example above, reloading keeps Review sources checked, Draft report and Send summary incomplete, and the summary at `2 remaining of 3`. A full canonical development restart clears browser storage, including Local Storage and Session Storage, so the checklist starts with all three tasks incomplete and `3 remaining of 3`.

Open the built-in Wiki view to return to this guide. See the [Navigation Guide](../002-Navigation_Guide/PAGE.md) for movement between views.
'''


def jread(path):
    return json.loads(Path(path).read_bytes())


def page_info(path):
    data = path.read_bytes()
    s = path.stat()
    return {'sha256': digest(data), 'bytes': len(data), 'mode': stat.S_IMODE(s.st_mode),
            'mtime_ns': s.st_mtime_ns,
            'last_modified': re.search(r'last-modified: "([^"]+)"', data.decode()).group(1)}


def static_checks():
    checkpoint, manifest = load(U)
    _, original = load(J)
    assert digest((J / 'recovery/manifest.json').read_bytes()) == 'f827e476bb28bc720f14537ebf6a1edf514f122e3f6705c4e9fa0590912834fb'
    assert digest((checkpoint / 'manifest.json').read_bytes()) == '36c99f10ccdc4eed268e2859d2f737eac282181784ea0385572e64d3221c7e75'
    assert len(original['owned']) == 128 and len(manifest['owned']) == 129
    assert set(manifest['owned']) - set(original['owned']) == {V}
    assert manifest['owned'][V]['job_created'] and manifest['owned'][V]['worktree'] == {'kind': 'missing'}
    assert manifest['owned'][V]['index'] == [] and manifest['owned'][V]['base'] == []
    assert stat.S_IMODE((checkpoint / 'manifest.json').stat().st_mode) == 0o444
    selection = jread(J / 'evidence/first-wiki-version-selection.json')
    assert selection['exact_candidate_relative_leaf'] == V and not selection['pre_creation_exists']
    assert selection['union_owned_leaf_count'] == 129
    for action in ('capture', 'verify'):
        receipt = jread(J / f'evidence/first-wiki-union-{action}-command.json')
        assert receipt['exit_code'] == 0
        result = json.loads(receipt['stdout'])
        assert result['manifest_sha256'] == digest((checkpoint / 'manifest.json').read_bytes())
        if action == 'verify':
            assert all(result[k] for k in ('payloads_valid', 'matches_checkpoint', 'status_equal'))
    coverage = jread(J / 'first-wiki-original-coverage.json')
    source_checks = {}
    for name, expected in coverage['source_dependencies'].items():
        path = P / name
        assert path.is_file() and not path.is_symlink()
        assert digest(path.read_bytes()) == expected['sha256']
        source_checks[name] = expected['sha256']
    for name in coverage['instruction_absences']:
        assert not Path(name).exists()
    for path, expected in manifest['authority_hashes'].items():
        assert digest(Path(path).read_bytes()) == expected, path
    reuse = jread(J / 'evidence/first-unaffected-suite-reuse.json')
    for dependency in reuse['dependencies']:
        path = Path(dependency['path'])
        assert digest(path.read_bytes()) == dependency['sha256'], str(path)
        assert oct(path.stat().st_mode) == dependency['mode']
    for entry in reuse['raw'].values():
        assert digest(Path(entry['path']).read_bytes()) == entry['sha256']
    provider = jread(C / 'planning/commit-supervisor/execution/S6-provider-release.json')
    assert digest(Path(provider['sample_artifact']).read_bytes()) == provider['sample_sha256']
    assert provider['sample'] == jread(provider['sample_artifact'])
    assert provider['fixture_landed']['simulated'] and not provider['fixture_landed']['actual_landing']
    assert provider['adoption_evidence']['separate_from_landing'] and not provider['adoption_evidence']['production_adoption']
    intent = jread(C / 'planning/commit-supervisor/execution/S6-intent-resolution.json')
    assert intent['summaryFormat'] == 'N remaining of 3' and intent['future_fix_xy'].startswith('UNISSUED')
    retained = {name: page_info(P / name) for name in coverage['all_original_article_dependencies'] if name != G}
    for name, info in retained.items():
        assert info['sha256'] == coverage['all_original_article_dependencies'][name]['sha256']
    return checkpoint, manifest, {'union_manifest_sha256': digest((checkpoint / 'manifest.json').read_bytes()),
        'original_manifest_sha256': digest((J / 'recovery/manifest.json').read_bytes()),
        'owned_count': len(manifest['owned']), 'authority_count': len(manifest['authority_hashes']),
        'suite_dependency_count': len(reuse['dependencies']), 'source_dependencies': source_checks,
        'retained_articles': retained}


def current_delta(manifest, expected):
    current = relevant_state(P, manifest['owned'], manifest['protected_repos'])
    baseline = manifest['baseline']
    assert current['refs'] == baseline['refs'] and current['protected'] == baseline['protected']
    assert set(current['paths']) == set(baseline['paths'])
    changed = sorted(name for name in current['paths'] if current['paths'][name] != baseline['paths'][name])
    assert changed == sorted(expected), changed
    for name in changed:
        assert current['paths'][name]['index'] == baseline['paths'][name]['index']
        assert current['paths'][name]['flag'] == baseline['paths'][name]['flag']
    return {'changed_paths': changed, 'baseline_leaf_count': len(baseline['paths']),
            'current_state_sha256': digest(encoded(current)), 'refs': current['refs'],
            'protected': current['protected']}


def preflight():
    _, manifest, info = static_checks()
    assert not os.path.lexists(P / V)
    assert digest((P / G).read_bytes()) == manifest['owned'][G]['worktree']['sha256']
    return {**info, **current_delta(manifest, []), 'version_absent': True, 'guide': page_info(P / G)}


def repair():
    before = preflight()
    checkpoint, manifest = load(U)
    preimage = (P / G).read_bytes()
    assert preimage == read_payload(checkpoint, manifest['owned'][G]['worktree'])
    original_stat = (P / G).stat()
    # No alternate name: a collision fails before article replacement.
    (P / V).parent.mkdir(exist_ok=True)
    with (P / V).open('xb') as version:
        version.write(preimage)
        version.flush()
        os.fsync(version.fileno())
    os.chmod(P / V, stat.S_IMODE(original_stat.st_mode))
    os.utime(P / V, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns))
    assert (P / V).read_bytes() == preimage and digest((P / V).read_bytes()) == before['guide']['sha256']
    assert (P / V).stat().st_mtime_ns == original_stat.st_mtime_ns
    _, _, now = static_checks()
    assert now['retained_articles'] == before['retained_articles']
    assert (P / G).read_bytes() == preimage
    current_delta(manifest, [V])
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    frontmatter = '\n'.join(['---', 'name: Checklist Guide',
        'description: How to complete and revisit the disposable checklist.', 'metadata:',
        '  source-files:', *['    - ' + name for name in SOURCES],
        '  last-modified: "' + timestamp + '"', '---', '', ''])
    replacement = (frontmatter + BODY).encode()
    # Immediately re-read dependencies/page before the only PAGE write.
    static_checks()
    assert (P / G).read_bytes() == preimage
    assert (P / V).read_bytes() == preimage
    (P / G).write_bytes(replacement)
    assert (P / G).read_bytes() == replacement
    return {'page': page_info(P / G), 'version': page_info(P / V), 'write_utc': timestamp,
            'exclusive_create': 'xb', 'complete_preimage_equal': True,
            'before_retained_articles': before['retained_articles']}


def postflight():
    _, manifest, info = static_checks()
    delta = current_delta(manifest, [G, V])
    page = (P / G).read_text()
    version = (P / V).read_bytes()
    assert digest(version) == manifest['owned'][G]['worktree']['sha256']
    receipts = jread(J / 'workers/wiki-repair-1-commands.json')
    repair_receipt = next(r for r in receipts if r['command'][-1] == 'repair')
    repaired = json.loads(repair_receipt['stdout'])
    assert info['retained_articles'] == repaired['before_retained_articles']
    assert page == '\n'.join(['---', 'name: Checklist Guide',
        'description: How to complete and revisit the disposable checklist.', 'metadata:',
        '  source-files:', *['    - ' + name for name in SOURCES],
        '  last-modified: "' + repaired['write_utc'] + '"', '---', '', '']) + BODY
    assert all((P / source).is_file() for source in SOURCES) and len(SOURCES) == len(set(SOURCES))
    links = []
    for name in info['retained_articles'] | {G: {}}:
        for target in re.findall(r'\]\(([^)]+)\)', (P / name).read_text()):
            assert not target.startswith('/')
            resolved = ((P / name).parent / target.split('#')[0]).resolve()
            assert resolved.is_file()
            links.append({'from': name, 'to': str(resolved)})
    assert not re.search(r'incoming-edges|outgoing-edges|connected-skills|related-trigger-files', page)
    assert not re.search(r'SPEC|READY_FOR|supervisor|rehearsal-20261004|fix-X|Reset completion|Review report|section-toc', page)
    assert list((P / G).parent.joinpath('.versions').iterdir()) == [P / V]
    return {**info, **delta, 'page': page_info(P / G), 'version': page_info(P / V), 'links': links,
            'source_files': SOURCES, 'preimage_bytes_equal': version == (U / 'recovery' / manifest['owned'][G]['worktree']['payload']).read_bytes()}


if __name__ == '__main__':
    functions = {'preflight': preflight, 'repair': repair, 'postflight': postflight}
    print(json.dumps(functions[sys.argv[1]](), indent=2))
