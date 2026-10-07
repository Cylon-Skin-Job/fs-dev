#!/usr/bin/env python3
"""Stamp exactly the changed live pages through wiki-edit and save final preimages."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
import re
import subprocess
import tempfile

CAP=Path(__file__).resolve().parent
ROOT=CAP.parents[3]
STAMP_LINE=re.compile(r'(?m)^(  last-modified: )["\']([^"\'\n]+)["\']$')
def sha(b):return hashlib.sha256(b).hexdigest()

def main():
    out=CAP/'TIMESTAMP-RECEIPT.json'
    if out.exists():raise RuntimeError('timestamp receipt already exists; preserve prior evidence before a repair pass')
    baseline=json.loads((CAP/'BASELINE.json').read_text())
    rows=[]
    stamp=dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    targets=[]
    for entry in baseline['entries']:
        if entry['action']=='retain_reference':continue
        p=ROOT/entry['path']
        if p.is_file() and sha(p.read_bytes())!=entry['sha256']:
            targets.append((entry['path'],p))
    for rp,p in targets:
        before=p.read_text()
        if len(STAMP_LINE.findall(before))!=1:raise RuntimeError('missing/duplicate quoted stamp: '+rp)
        after=STAMP_LINE.sub(lambda m:m.group(1)+'"'+stamp+'"',before,count=1)
        if after==before:raise RuntimeError('timestamp no-op: '+rp)
        with tempfile.NamedTemporaryFile('w',dir=CAP,prefix='.s05-stamp-',delete=True) as f:
            f.write(after);f.flush()
            run=subprocess.run(['python3',str(CAP/'wiki-edit.py'),'write',rp,f.name,'--expect',sha(before.encode()),'--slice','S05','--phase','stamp'],cwd=ROOT,text=True,capture_output=True)
            if run.returncode:raise RuntimeError('stamp failed: '+rp+' '+run.stderr)
        edit=json.loads(run.stdout)
        import importlib.util
        spec=importlib.util.spec_from_file_location('wiki_validator',CAP/'validate-wiki.py');validator=importlib.util.module_from_spec(spec);spec.loader.exec_module(validator)
        if not validator.timestamp_only(before,p.read_text()):raise RuntimeError('stamp modified body/other metadata')
        rows.append({'path':rp,'snapshot':edit['snapshot'],'before_sha256':edit['before_sha256'],'after_sha256':edit['after_sha256']})
    receipt={'schema_version':1,'stamped_at':stamp,'entries':rows,'scope':'Only live PAGE-MAP pages changed since execution baseline; no retired, untouched, retained or historical pages.'}
    with out.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
    print(json.dumps({'receipt':out.relative_to(ROOT).as_posix(),'stamped_at':stamp,'count':len(rows)},indent=2))
if __name__=='__main__':main()
