#!/usr/bin/env python3
"""Compare-before-write page editor with exclusive predecessor snapshots and edit ledger."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time

CAP=Path(__file__).resolve().parent
ROOT=CAP.parents[3]
MAP=json.loads((CAP/'PAGE-MAP.json').read_text())
ALLOWED={e['path']:e for e in MAP['entries'] if e['action']!='retain_reference'}
LEDGER=CAP/'EDIT-RECEIPTS.json'

def digest(data): return hashlib.sha256(data).hexdigest() if data is not None else None

def read(path): return path.read_bytes() if path.is_file() else None

def save_json(data):
    with tempfile.NamedTemporaryFile('w',dir=CAP,delete=False,prefix='.edit-receipts-') as tmp:
        json.dump(data,tmp,indent=2);tmp.write('\n');name=tmp.name
    os.replace(name,LEDGER)

def snapshot(path,data):
    folder=path.parent/'.versions';folder.mkdir(exist_ok=True)
    for _ in range(7):
        name=dt.datetime.now().strftime('%Y-%m-%d-%H%M%S')+'.md'
        target=folder/name
        try:
            with target.open('xb') as f:f.write(data)
            return target
        except FileExistsError:time.sleep(1)
    raise RuntimeError('Could not acquire exclusive snapshot name')

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('action',choices=['write','retire'])
    ap.add_argument('path',help='exact repository-relative PAGE.md')
    ap.add_argument('proposal',nargs='?',help='proposed Markdown file for write')
    ap.add_argument('--expect',required=True,help='SHA-256 of currently read page, or absent')
    a=ap.parse_args()
    entry=ALLOWED.get(a.path)
    if not entry:ap.error('not an approved writable wiki path')
    if a.action=='retire' and entry['action']!='retire':ap.error('only mapped retirement may be deleted')
    if a.action=='write' and entry['action']=='retire':ap.error('retired page may not be written')
    if a.action=='write' and not a.proposal:ap.error('write requires proposed file')
    if a.action=='retire' and a.proposal:ap.error('retire takes no proposal')
    path=ROOT/a.path
    before=read(path); before_hash=digest(before)
    expected=None if a.expect=='absent' else a.expect
    if before_hash!=expected: raise RuntimeError('compare-before-write mismatch: '+str(before_hash))
    after=None if a.action=='retire' else Path(a.proposal).read_bytes()
    after_hash=digest(after)
    if before_hash==after_hash:raise RuntimeError('no-op edit refused; no timestamp or snapshot needed')
    baseline=json.loads((CAP/'BASELINE.json').read_text())
    baseline_hash=next(x['sha256'] for x in baseline['entries'] if x['path']==a.path)
    log=json.loads(LEDGER.read_text()) if LEDGER.exists() else {'schema_version':1,'edits':[]}
    rows=[x for x in log['edits'] if x['path']==a.path]
    prior=rows[-1]['after_sha256'] if rows else baseline_hash
    if prior!=before_hash:raise RuntimeError('edit chain mismatch; reconcile latest bytes before writing')
    if after is not None:
        path.parent.mkdir(parents=True,exist_ok=True)
    snap=snapshot(path,before) if before is not None else None
    row={'path':a.path,'action':a.action,'at':dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
         'before_sha256':before_hash,'after_sha256':after_hash,'snapshot':snap.relative_to(ROOT).as_posix() if snap else None,
         'status':'pending'}
    log['edits'].append(row);save_json(log)
    if read(path)!=before:raise RuntimeError('concurrent change after snapshot; pending edit must be reconciled')
    if after is None:path.unlink()
    else:
        with tempfile.NamedTemporaryFile('wb',dir=path.parent,delete=False,prefix='.wv01-write-') as tmp:
            tmp.write(after);tmp.flush();os.fsync(tmp.fileno());name=tmp.name
        if read(path)!=before:
            os.unlink(name);raise RuntimeError('concurrent change before replacement; pending edit must be reconciled')
        os.replace(name,path)
    if digest(read(path))!=after_hash:raise RuntimeError('postwrite hash mismatch')
    row['status']='complete';save_json(log)
    print(json.dumps(row,indent=2))
if __name__=='__main__':
    try:main()
    except Exception as exc:print(str(exc),file=sys.stderr);sys.exit(1)
