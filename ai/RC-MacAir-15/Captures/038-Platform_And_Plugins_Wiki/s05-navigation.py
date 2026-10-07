#!/usr/bin/env python3
"""Stage wiki audit twice and optionally import only approved generated marker bodies."""
import argparse, datetime as dt, hashlib, json, re, shutil, subprocess, tempfile
from pathlib import Path
CAP=Path(__file__).resolve().parent
ROOT=CAP.parents[3]
WIKI=ROOT/'ai/RC-MacAir-15/Wiki'
ENTRIES=json.loads((CAP/'PAGE-MAP.json').read_text())['entries']
PAT=re.compile(r'<!-- (section-toc|children):start -->.*?<!-- \1:end -->',re.S)
def sha(b):return hashlib.sha256(b).hexdigest()
def blocks(s):return [m.group() for m in PAT.finditer(s)]
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--import-blocks',action='store_true');a=ap.parse_args()
    if any(p.is_symlink() for p in WIKI.rglob('*')):raise RuntimeError('Wiki symlink staging rejected')
    owned={e['path']:(ROOT/e['path']).read_text() for e in ENTRIES if (ROOT/e['path']).is_file()}
    with tempfile.TemporaryDirectory(prefix='ppw01-stage-',dir=CAP) as td:
        stage=Path(td)/'Wiki';shutil.copytree(WIKI,stage)
        command=['node',str(ROOT/'fusion-studio-server/scripts/wiki.js'),'audit',str(stage)]
        runs=[];passes=[]
        for i in (1,2):
            r=subprocess.run(command,cwd=ROOT,text=True,capture_output=True)
            runs.append({'run':i,'exit_code':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
            if r.returncode:raise RuntimeError('staged audit failed: '+r.stderr)
            passes.append({rp:blocks((stage/(ROOT/rp).relative_to(WIKI)).read_text()) for rp in owned})
        if passes[0]!=passes[1]:raise RuntimeError('owned generated blocks not idempotent')
        changes=[]
        for rp,before in owned.items():
            fresh=iter(passes[1][rp]);old=blocks(before)
            if len(old)!=len(passes[1][rp]):raise RuntimeError('marker count changed: '+rp)
            after=PAT.sub(lambda _:next(fresh),before)
            if after==before:continue
            row={'path':rp,'before_sha256':sha(before.encode()),'proposed_sha256':sha(after.encode())}
            if a.import_blocks:
                with tempfile.NamedTemporaryFile('w',dir=CAP,prefix='.nav-proposal-',delete=True) as f:
                    f.write(after);f.flush()
                    r=subprocess.run(['python3',str(CAP/'wiki-edit.py'),'write',rp,f.name,'--expect',row['before_sha256'],'--slice','S05','--phase','generation'],cwd=ROOT,text=True,capture_output=True)
                    if r.returncode:raise RuntimeError(r.stderr)
                    row['receipt']=json.loads(r.stdout)
            changes.append(row)
        evidence={'at':dt.datetime.now(dt.timezone.utc).isoformat(),'command':command,'runs':runs,'owned_input_hashes':{p:sha(b.encode()) for p,b in owned.items()},'idempotent':True,'imported':a.import_blocks,'changes':changes,'exclusions':'No whole pages, unowned marker regions, legacy TOCs, audit state, or relationship metadata imported. No product runtime.'}
    folder=CAP/'runs';folder.mkdir(exist_ok=True)
    output=folder/(dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'-navigation.json')
    with output.open('x') as f:json.dump(evidence,f,indent=2);f.write('\n')
    print(json.dumps({'report':str(output),'changes':len(changes),'imported':a.import_blocks,'idempotent':True}))
if __name__=='__main__':main()
