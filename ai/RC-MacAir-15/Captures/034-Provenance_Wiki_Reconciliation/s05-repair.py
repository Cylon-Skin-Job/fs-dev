"""Self-review metadata precision; exclusive complete preimage per edit."""
from pathlib import Path
from datetime import datetime, timezone
import json,re,hashlib,difflib
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
m=json.loads((C/'S05-CHANGE-MANIFEST.json').read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
descriptions=[
'Current legacy automation and settled history direction, with future governed run and captured-output decisions.',
'Implemented mediated-save UI context and the boundary to future general UI-action provenance.',
'Current bounded query transports and future saved audit, review, and recommendation contracts.',
'Current watcher and checkpoint limits, future change-storm summaries, and unresolved compaction policy.',
'Implemented save-context carrier and future shared UI-action design, including Wiki and File adapter boundaries.',
'Current Wiki navigation and attachment owners, with the future first-pair UI-action adapter boundary.',
'Current connected File save context and attachment owners, with the future prompt UI-action adapter boundary.'
]
for row,desc in zip(m['pages'],descriptions):
 p=Path(row['path']);old=p.read_bytes();before=sha(old);stamp=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
 new=re.sub(r'^description: .*$', 'description: '+desc,old.decode(),count=1,flags=re.M)
 new=re.sub(r'last-modified: "[^"]+"','last-modified: "'+stamp+'"',new,count=1)
 snap=p.parent/'.versions'/(datetime.now().strftime('%Y-%m-%d-%H%M%S')+'.md')
 with snap.open('xb') as out:out.write(old)
 assert sha(p.read_bytes())==before
 p.write_text(new)
 row.setdefault('repair_snapshots',[]).append({'snapshot':str(snap),'before_sha256':before,'snapshot_sha256':sha(snap.read_bytes()),'at':stamp,'reason':'Self-review: navigation-facing description must distinguish current narrower owners from future design.'})
 row['after_sha256']=sha(p.read_bytes())
(C/'S05-CHANGE-MANIFEST.json').write_text(json.dumps(m,indent=2)+'\n')
diff=[]
for r in m['pages']:diff.extend(difflib.unified_diff(Path(r['snapshot']).read_text().splitlines(True),Path(r['path']).read_text().splitlines(True),fromfile=r['snapshot'],tofile=r['path']))
(C/'S05-PAGES.diff').write_text(''.join(diff))
print('Seven descriptions clarified; seven repair snapshots')
