# Root evidence audit only; invokes no product/test workloads.
from pathlib import Path
import hashlib, json
base = Path(__file__).resolve().parent
repo = Path.cwd()
evidence = base.parent
data = json.loads((base / 'FINAL-VERIFICATION.json').read_text())
checks = []
for gate in data['checks']:
    record = {'gate': gate['gate'], 'exit': gate.get('exit')}
    if gate.get('runId'):
        lane = '01C' if gate['gate'] == 'server' else '01B'
        raw = evidence / 'spec-01' / lane / gate['runId']
        receipt = raw / ('result.json' if lane == '01C' else 'run-result.json')
        record['receipt'] = json.loads(receipt.read_text())
        manifests = []
        for candidate in [raw / 'run-manifest.json', *raw.rglob('manifest.json')]:
            if not candidate.exists(): continue
            m = json.loads(candidate.read_text())
            hashes = m.get('sourceHashes', {}) or {row['relativePath']: row['sha256'] for row in m.get('source', {}).get('files', [])}
            bad = [name for name, expected in hashes.items() if not (repo / name).exists() or hashlib.sha256((repo / name).read_bytes()).hexdigest() != expected]
            roots = {key: {'path': m[key], 'exists': Path(m[key]).exists()} for key in ['stagedServer','profileRoot','workspaceRoot','testTmp'] if isinstance(m.get(key), str)}
            manifests.append({'path':str(candidate.relative_to(repo)), 'sourceCount':len(hashes), 'mismatches':bad, 'ownedRoots':roots})
        record['manifests'] = manifests
        if (raw / 'r8-ui-result.json').exists():
            ui = json.loads((raw / 'r8-ui-result.json').read_text())
            record['ui'] = {'status': ui['status'], 'flows':ui['flows'], 'cleanup':ui['cleanup'], 'errors':ui['errors'], 'consoleErrors':ui['consoleErrors']}
    checks.append(record)
manifest = base / 'INTEGRATED-SOURCE-SHA256.txt'
bad=[]
for line in manifest.read_text().splitlines():
    expected,name=line.split('  ',1)
    if hashlib.sha256((repo/name).read_bytes()).hexdigest()!=expected:bad.append(name)
result={'manifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'integratedMismatches':bad,'checks':checks}
(base / 'FINAL-EVIDENCE-AUDIT.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'manifest':result['manifestSha256'],'integratedMismatches':bad,'checks':[{'gate':x['gate'],'exit':x['exit'],'status':x.get('receipt',{}).get('status'),'manifestCount':len(x.get('manifests',[])),'sourceMismatches':sum(len(m['mismatches']) for m in x.get('manifests',[]))} for x in checks]}))
