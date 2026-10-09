#!/usr/bin/env python3
"""Read-only comparison of protected runtime identities; never controls processes."""
import argparse, datetime, hashlib, json, subprocess
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--baseline',required=True);ap.add_argument('--output',required=True);a=ap.parse_args();p=Path(a.baseline);b=json.loads(p.read_text());out=Path(a.output);assert not out.exists(),'refusing receipt overwrite'
rows=[]
for row in b['process_rows']:
 fields=row.strip().split(None,7);pid=fields[0];result=subprocess.run(['ps','-p',pid,'-o','pid=,ppid=,lstart=,command='],text=True,capture_output=True);current=result.stdout.strip();rows.append({'pid':int(pid),'baseline':row.strip(),'current':current or None,'same_identity':current.split()==row.split(),'state':'same' if current.split()==row.split() else 'absent' if not current else 'changed'})
r={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'read-only protected process comparison; no health/restart claim','baseline':str(p.resolve()),'baseline_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'rows':rows,'counts':{state:sum(x['state']==state for x in rows) for state in ['same','absent','changed']},'limitation':'An independently exited/replaced process is recorded as observation; comparison alone does not establish who caused it. Job-owned lifecycle cleanup is assessed separately.'};out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'output':str(out.resolve()),'counts':r['counts']}))
