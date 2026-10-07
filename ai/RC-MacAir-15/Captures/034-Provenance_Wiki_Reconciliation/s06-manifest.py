"""Refresh the capture-only attributable file inventory after receipts change."""
import datetime
import hashlib
import json
import pathlib

C = pathlib.Path(__file__).parent
m = json.loads((C / 'S06-CHANGE-MANIFEST.json').read_text())
paths = {r['path']: 'S06 article edit' for r in m['pages']}
for r in m['pages']:
    paths[r['snapshot']] = 'exclusive exact pre-edit article snapshot'
    for s in r.get('repair_snapshots', []):
        paths[s['snapshot']] = 'exclusive exact repair predecessor'
for p in C.iterdir():
    if p.name.startswith(('S06-', 's06-', 'FINAL-ARTICLE-HASHES')) and p.name != 'S06-FILE-MANIFEST.json':
        paths[str(p)] = 'S06 capture-only artifact'
for r in json.loads((C / 'S06-SUPPLEMENT-MANIFEST.json').read_text())['supplements']:
    paths[r['path']] = 'append-only S06 supplement; prior bytes excluded from attribution'
out = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'candidate': 'PW01-f24d5cd427b9ca14', 'excludes': ['S06-FILE-MANIFEST.json (self-reference)'], 'files': [{'path': p, 'sha256': hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest(), 'attribution': reason} for p, reason in sorted(paths.items())]}
(C / 'S06-FILE-MANIFEST.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps({'attributable_files': len(paths)}))
