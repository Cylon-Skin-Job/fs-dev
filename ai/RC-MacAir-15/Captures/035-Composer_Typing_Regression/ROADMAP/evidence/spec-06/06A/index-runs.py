from pathlib import Path
import json, re
folder=Path(__file__).resolve().parent
evidence=folder.parents[1]
rows=[]
for log in sorted(folder.glob('*.log')):
    body=log.read_text(errors='replace')
    match=re.search(r'^CHAT_ARCH_RUN_MANIFEST (.+)$',body,re.M)
    if match:
        manifest=json.loads(match[1]); run_id=manifest['runId']
        root=evidence/'spec-01/01B'/run_id
        result_file=root/'run-result.json'
        result=json.loads(result_file.read_text()) if result_file.exists() else None
        rows.append({'log':log.name,'runId':run_id,'evidenceRoot':str(root),
            'requested':manifest['requested'],'result':result})
    else:
        match=re.search(r'(?:CHAT_ARCH_SERVER_FOCUSED_OK|CHAT_ARCH_BOOT_REGRESSIONS_OBSERVED) ([\w-]+)',body)
        if match:
            root=evidence/'spec-01/01C'/match[1]
            rows.append({'log':log.name,'runId':match[1],'evidenceRoot':str(root),
                'result':json.loads((root/'launcher-result.json').read_text())})
(folder/'RUN-INDEX.json').write_text(json.dumps(rows,indent=2)+'\n')
for row in rows:
    r=row['result'] or {}
    print(row['log'],row['runId'],r.get('status',r.get('result',{}).get('code')),
        'rootRemoved='+str(r.get('ownedRunRootRemoved')))
