#!/usr/bin/env python3
"""Read-only product seal and M3 delta against the accepted M2 starting bytes."""
import pathlib, subprocess, hashlib, json, datetime, difflib
M = pathlib.Path(__file__).resolve().parent
R = pathlib.Path('/Users/rccurtrightjr./.codex/worktrees/chat-material-01/fs-dev')
sha = lambda b: hashlib.sha256(b).hexdigest()
start = json.loads((M/'START.json').read_text())
status = subprocess.check_output(['git','status','--porcelain'],cwd=R,text=True)
paths = sorted(set(line[3:] for line in status.splitlines() if line[3:] != 'fusion-studio-server/node_modules'))
current, delta, patch = [], [], []
for rel in paths:
    f = R/rel
    if not f.is_file() or f.is_symlink(): raise RuntimeError('unexpected product path '+rel)
    now = f.read_bytes()
    row = {'path':rel,'sha256':sha(now),'bytes':len(now),'lines':len(now.splitlines()),'mode':oct(f.stat().st_mode & 0o777)}
    current.append(row)
    baseline = M/'baseline'/rel
    if baseline.exists(): before = baseline.read_bytes(); origin='accepted-M2-start'
    else:
        result = subprocess.run(['git','show','HEAD:'+rel],cwd=R,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
        before=result.stdout if result.returncode == 0 else b''; origin='HEAD' if result.returncode == 0 else 'new'
    if before == now: continue
    pre = M/'preimages'/rel; pre.parent.mkdir(parents=True,exist_ok=True);pre.write_bytes(before)
    delta.append({**row,'before_sha256':sha(before),'before_origin':origin})
    patch.extend(difflib.unified_diff(before.decode().splitlines(True),now.decode().splitlines(True),fromfile='a/'+rel,tofile='b/'+rel))
(M/'M3-slice.patch').write_text(''.join(patch))
seal={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'builder':'/root/m3_builder','manager':'/root',
      'scope':'Current integrated product/Wiki/testing bytes; M3 delta from accepted M2. No commit/owner acceptance.',
      'checkout':str(R),'branch':subprocess.check_output(['git','branch','--show-current'],cwd=R,text=True).strip(),
      'HEAD':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'status':status,
      'product':current,'M3_changes':delta,'preserved_accepted_M2':[row['path'] for row in current if row['path'] not in {d['path'] for d in delta}],
      'excluded':'Untracked server node_modules symlink; ignored dist/addon artifacts are separately bound in raw schema2 checks and native receipts.',
      'patch_sha256':sha((M/'M3-slice.patch').read_bytes())}
(M/'SOURCE-SEAL.json').write_text(json.dumps(seal,indent=2)+'\n')
print(json.dumps({'seal_sha256':sha((M/'SOURCE-SEAL.json').read_bytes()),'product_files':len(current),'M3_changes':len(delta),'paths':[x['path'] for x in delta]},indent=2))
