"""One-shot authorized S06 page edits; no application imports or execution."""
import datetime
import difflib
import hashlib
import json
import pathlib
import re

C = pathlib.Path(__file__).parent
sha = lambda b: hashlib.sha256(b).hexdigest()
pages = json.loads((C / 'PAGE-MAP.json').read_text())['pages']
manifest = {'slice': 'S06', 'pages': [], 'candidate': 'PW01-f24d5cd427b9ca14'}
assert not (C / 'S06-CHANGE-MANIFEST.json').exists(), 'One-shot writer already ran'
diffs = []
for row in pages:
    p = pathlib.Path(row['path'])
    old = p.read_bytes()
    text = old.decode()
    header, body = text[4:].split('\n---\n', 1)
    if row['slice'] in ['S04', 'S05']:
        continue
    # Preserve authored scalar/source bytes and all unrelated domain metadata.
    header = re.sub(r'^  (?:incoming-edges|outgoing-edges|connected-skills|related-trigger-files):[^\n]*(?:\n    [^\n]*)*\n?', '', header, flags=re.M)
    header = header.replace('fusion-studio-server/lib/thread/ThreadRuntimeManager.js', 'fusion-studio-server/lib/thread/thread-runtime-manager.js')
    header = header.replace('    - fusion-studio-server/lib/thread/\n', '    - fusion-studio-server/lib/thread/ThreadManager.js\n    - fusion-studio-server/lib/thread/HistoryFile.js\n')
    header = re.sub(r'^    - fusion-studio-server/lib/chat-metadata/$', '    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js', header, flags=re.M)
    if row == pages[0]:
        first = body.lstrip().split('\n\n', 1)[0]
        assert first.startswith('Status: the System boundary')
        body = body.replace(first, 'Status: reconciled on 2026-09-19 across the 24 Events And Ledger articles and the bounded System/provenance subjects in three supporting articles. The inspected development checkout is `/Users/rccurtrightjr./projects/fs-dev`, at HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, with dirty working files. Claims follow the inspected working bytes rather than HEAD alone; unrelated concurrent changes were preserved. This is source and documentation inspection, not a product test, runtime pass, whole-app storage audit or whole-wiki certification. Installed Alpha is a separate, unverified baseline. Generated navigation below is a topic map, not proof that every described subsystem exists.', 1)
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    stamp = now.isoformat().replace('+00:00', 'Z')
    header = header.rstrip() + '\n  last-modified: "' + stamp + '"\n'
    new = ('---\n' + header + '---\n' + body).encode()
    assert old != new
    snapshot = p.parent / '.versions' / (now.astimezone().strftime('%Y-%m-%d-%H%M%S') + '.md')
    snapshot.parent.mkdir(exist_ok=True)
    with snapshot.open('xb') as f:
        f.write(old)
    assert sha(p.read_bytes()) == sha(old), f'Concurrent edit: {p}'
    p.write_bytes(new)
    manifest['pages'].append({'path': str(p), 'at': stamp, 'snapshot': str(snapshot), 'before_sha256': sha(old), 'snapshot_sha256': sha(snapshot.read_bytes()), 'after_sha256': sha(new), 'reason': 'Current owner metadata policy; exact supporting code pointers; overview completion scope/baseline where applicable'})
    diffs.extend(difflib.unified_diff(text.splitlines(True), new.decode().splitlines(True), fromfile=str(snapshot), tofile=str(p)))
(C / 'S06-CHANGE-MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
(C / 'S06-PAGES.diff').write_text(''.join(diffs))
print(json.dumps({'changed_pages': len(manifest['pages']), 'snapshots': len(manifest['pages'])}))
