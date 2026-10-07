"""Read-only Part 0 baseline verification; run from any directory in this checkout."""
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess

root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
capture = root / 'ai/RC-MacAir-15/Captures/033-Chat_Wiki_Reconciliation'
baseline = json.loads((capture / 'EXECUTION-BASELINE.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
errors = []
checks = {}

def check(name, condition):
    checks[name] = bool(condition)
    if not condition:
        errors.append(name)

check('primary_development_root', str(root) == baseline['root'] == '/Users/rccurtrightjr./projects/fs-dev')
check('head_unchanged', subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == baseline['head'])
check('branch_unchanged', subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip() == baseline['branch'])
for key in ('preparation_baseline', 'approved_spec'):
    item = baseline[key]
    check(key + '_unchanged', sha((root / item['path']).read_bytes()) == item['sha256'])
wiki = root / 'ai/RC-MacAir-15/Wiki/007-Chat_System'
active = {str(p.relative_to(root)) for p in wiki.rglob('PAGE.md') if '.versions' not in p.parts}
related = 'ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections/PAGE.md'
expected = active | {related}
check('inventory_exact_38_plus_1', len(active) == 38 and len(baseline['pages']) == 39 and expected == {p['path'] for p in baseline['pages']})
blocks = 0
for item in baseline['pages']:
    stored = base64.b64decode(item['content_base64'], validate=True)
    current = (root / item['path']).read_bytes()
    check('stored_bytes:' + item['path'], sha(stored) == item['sha256'] and len(stored) == item['bytes'])
    check('current_bytes:' + item['path'], current == stored)
    pattern = rb'<!--\s*(section-toc|children):start\s*-->.*?<!--\s*\1:end\s*-->'
    previous_blocks = [match.group(0) for match in re.finditer(pattern, stored, re.S)]
    current_blocks = [match.group(0) for match in re.finditer(pattern, current, re.S)]
    # Exact page equality above is stronger than marker-only equality.
    check('marker_bytes:' + item['path'], previous_blocks == current_blocks)
    blocks += len(previous_blocks)
for item in baseline['protected_files']:
    path = root / item['path']
    actual = sha(path.read_bytes()) if path.is_file() else None
    check('protected:' + item['path'], actual == item['sha256'])
check('no_new_product_paths', set(subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'fusion-studio-client', 'fusion-studio-server']).decode().split('\0')) - {''} <= {item['path'] for item in baseline['protected_files']})
check('status_short_unchanged', subprocess.check_output(['git', 'status', '--short'], text=True) == baseline['status_short'])
result = {'check_count': len(checks), 'passed': sum(checks.values()), 'errors': errors, 'chat_pages': len(active), 'related_pages': 1, 'exact_bytes': 39, 'generated_blocks': blocks, 'protected_files': len(baseline['protected_files']), 'baseline_sha256': sha((capture / 'EXECUTION-BASELINE.json').read_bytes())}
print(json.dumps(result, indent=2))
raise SystemExit(bool(errors))
