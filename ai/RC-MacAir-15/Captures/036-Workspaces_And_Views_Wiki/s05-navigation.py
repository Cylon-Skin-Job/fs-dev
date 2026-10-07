#!/usr/bin/env python3
"""Import only audit-generated navigation blocks from an isolated Wiki copy."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

CAP=Path(__file__).resolve().parent
ROOT=CAP.parents[3]
WIKI=ROOT/'ai/RC-MacAir-15/Wiki'
OWNED=[
    WIKI/'000-Wiki_Guidance/PAGE.md',
    WIKI/'001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md',
]
PAT=re.compile(r'<!-- section-toc:start -->.*?<!-- section-toc:end -->',re.S)
def sha(b):return hashlib.sha256(b).hexdigest()
def blocks(s):
    m=PAT.findall(s)
    if len(m)!=1:raise RuntimeError('expected exactly one section-toc block')
    return m[0]
def hashes(tree):return {p.relative_to(tree).as_posix():sha(p.read_bytes()) for p in tree.rglob('*') if p.is_file()}

def main():
    syms=[str(p) for p in WIKI.rglob('*') if p.is_symlink()]
    if syms:raise RuntimeError('Wiki symlinks rejected: '+str(syms[:10]))
    with tempfile.TemporaryDirectory(prefix='wv01-s05-navigation-',dir=CAP) as td:
        stage=Path(td)/'Wiki';shutil.copytree(WIKI,stage)
        command=['node',str(ROOT/'fusion-studio-server/scripts/wiki.js'),'audit',str(stage)]
        stage_before=hashes(stage);runs=[]
        for i in (1,2):
            result=subprocess.run(command,cwd=ROOT,text=True,capture_output=True)
            runs.append({'run':i,'exit_code':result.returncode,'stdout_tail':result.stdout[-2000:],'stderr_tail':result.stderr[-1000:]})
            if result.returncode:raise RuntimeError('staged audit failed: '+str(runs[-1]))
            if i==1:
                first={p.relative_to(WIKI).as_posix():blocks((stage/p.relative_to(WIKI)).read_text()) for p in OWNED}
                stage_after_first=hashes(stage)
        second={p.relative_to(WIKI).as_posix():blocks((stage/p.relative_to(WIKI)).read_text()) for p in OWNED}
        if first!=second:raise RuntimeError('second stage run changed generated blocks')
        imports=[]
        for p in OWNED:
            before=p.read_text();newblock=first[p.relative_to(WIKI).as_posix()]
            after=PAT.sub(lambda _:newblock,before,count=1)
            if after==before:continue
            rp=p.relative_to(ROOT).as_posix()
            with tempfile.NamedTemporaryFile('w',dir=CAP,prefix='.s05-proposal-',delete=True) as f:
                f.write(after);f.flush()
                edited=subprocess.run(['python3',str(CAP/'wiki-edit.py'),'write',rp,f.name,'--expect',sha(before.encode())],cwd=ROOT,text=True,capture_output=True)
                if edited.returncode:raise RuntimeError('wiki-edit failed: '+edited.stderr)
                imports.append(json.loads(edited.stdout))
        evidence={'at':dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                  'command':' '.join(command),'runs':runs,
                  'stage_modified_after_first':sorted(p for p in stage_before.keys()|stage_after_first.keys() if stage_before.get(p)!=stage_after_first.get(p)),
                  'idempotent_owned_blocks':True,'imports':imports,
                  'excluded_imports':'No staged whole pages, state files, generated edges or unowned changes imported.'}
    output=CAP/'S05-NAVIGATION.json'
    with output.open('x') as f:json.dump(evidence,f,indent=2);f.write('\n')
    print(json.dumps({'evidence':output.relative_to(ROOT).as_posix(),'imported':[x['path'] for x in imports],'stage_modified_count':len(evidence['stage_modified_after_first'])},indent=2))
if __name__=='__main__':main()
