"""Retain disposable S3 procedure evidence; no agent/app gate is claimed."""
from datetime import datetime
import hashlib
import json
from pathlib import Path
import sys

C = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(C / '.agents/skills/mc-commit-supervisor/tests'))
from wiki_fixture import WikiFixture, article, digest

e = Path(__file__).resolve().parent
f = WikiFixture(e / 'S3-smoke-fixture')
baseline = {'sources': dict(f.sources), 'pages': dict(f.pages)}
findings = f.coverage()
before = (f.wiki / f.count).read_bytes()
second = datetime.now().strftime('%Y-%m-%d-%H%M%S')
first = f.edit(f.count, before.replace(b'n + 1', b'n'), version_second=second)
intermediate = (f.wiki / f.count).read_bytes()
collision = f.edit(f.count, intermediate.replace(b'display choice', b'separate display choice'), version_second=second)
assert Path(first['preimage']).read_bytes() == before
assert Path(collision['preimage']).read_bytes() == intermediate
retained_before = (f.wiki / f.retained).read_bytes()
no_op = f.edit(f.retained, retained_before)
assert not no_op['changed']
assert (f.wiki / f.retained).read_bytes() == retained_before
source = f.source / 'src/count.js'
source.write_bytes(b'exports.count = n => n + 2;\n')
page_before_drift = (f.wiki / f.count).read_bytes()
try:
    f.edit(f.count, page_before_drift.replace(b'returns n.', b'returns n + 2.'))
    raise AssertionError('expected source drift refusal')
except ValueError as exc:
    refusal = str(exc)
assert (f.wiki / f.count).read_bytes() == page_before_drift
f.sources['src/count.js'] = digest(source)  # Explicit source read/recheck, no scanner.
rechecked = f.edit(f.count, page_before_drift.replace(b'returns n.', b'returns n + 2.'))
renamed_path = f.claims['renamed-owner']['page']
rename_before = (f.wiki / renamed_path).read_bytes()
renamed = f.edit(renamed_path, rename_before.replace(b'src/owner-old.js', b'src/owner-new.js').replace(b'the old path', b'the new path'))
new_page = f.edit(f.missing, article('New capability', ['src/new.js'], '# New capability\n\nCurrent source enables the capability.'))
assert f.coverage() == []
guide_before = (f.wiki / '000-Guide/PAGE.md').read_bytes()
stage = f.stage()
legacy = stage / '002-Legacy/001-Leaf/PAGE.md'
legacy.parent.mkdir(parents=True)
legacy.write_text(article('Legacy leaf', [], '# Staged only'))
f.generate(stage)
generated = (stage / f.heading).read_bytes()
(stage / f.heading).write_bytes(generated.replace(b'Hand-written routing survives.', b'UNAUTHORIZED STAGED PROSE'))
imported = f.import_block(stage, f.heading)
stable_before = (f.wiki / f.heading).read_bytes()
f.generate(stage)
stable = f.import_block(stage, f.heading)
assert not stable['changed']
assert (f.wiki / f.heading).read_bytes() == stable_before
assert (f.wiki / '000-Guide/PAGE.md').read_bytes() == guide_before
assert not (f.wiki / '002-Legacy').exists()
assert b'UNAUTHORIZED' not in stable_before
assert (f.wiki / f.retained).read_bytes() == retained_before
f.assert_sentinels()
parses = {p: f.parsed(p) for p in (f.count, f.retained, renamed_path, f.missing, f.heading)}
raw = {'fixture_root': str(f.root), 'agent_gate_proof': False, 'runtime_proof': False,
       'baseline': baseline, 'first_edit': first, 'same_second_collision': collision,
       'retained_no_op': no_op, 'source_drift_refusal': refusal,
       'source_recheck': {'read_bytes_sha256': digest(source), 'repair': rechecked},
       'original_coverage_findings': findings, 'renamed_source_repair': renamed,
       'new_article': new_page, 'final_coverage_findings': f.coverage(),
       'generated_import': imported, 'stable_import': stable,
       'commands': f.commands, 'parsed_pages': parses,
       'final_sources': f.sources, 'final_pages': f.pages,
       'operational_state_not_imported': True, 'unselected_guide_retained': True,
       'unexpected_legacy_page_not_imported': True, 'unrelated_stage_prose_not_imported': True,
       'real_sentinels': [{'path': str(p), 'sha256': h, 'unchanged': digest(p) == h} for p,h in f.real_sentinels.items()]}
for index, command in enumerate(f.commands, 1):
    (e / f'S3-wiki-audit-{index}.log').write_text(json.dumps(command['command']) + '\n' + command['stdout'] + command['stderr'])
(e / 'S3-smoke.json').write_text(json.dumps(raw, indent=2) + '\n')
print(json.dumps({'fixture_root': str(f.root), 'checks': 'pass', 'raw': str(e / 'S3-smoke.json'), 'commands': len(f.commands)}))
