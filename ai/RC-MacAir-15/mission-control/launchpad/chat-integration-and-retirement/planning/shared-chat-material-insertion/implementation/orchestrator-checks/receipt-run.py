#!/usr/bin/env python3
"""Run an assigned verification command and preserve exact raw/source receipts."""
import argparse, datetime, hashlib, json, os, shutil, subprocess
from pathlib import Path
ap=argparse.ArgumentParser(); ap.add_argument('--cwd',required=True); ap.add_argument('--output',required=True); ap.add_argument('--label',required=True); ap.add_argument('command',nargs=argparse.REMAINDER); a=ap.parse_args()
cmd=a.command[1:] if a.command[:1]==['--'] else a.command
if not cmd: ap.error('command required')
cwd=Path(a.cwd).resolve(); out=Path(a.output).resolve(); out.mkdir(parents=True,exist_ok=True)
def git(*args): return subprocess.check_output(['git','-C',str(cwd),*args],text=True)
root=Path(git('rev-parse','--show-toplevel').strip())
def snapshot():
    names=set(git('diff','--name-only','HEAD').splitlines()) | set(git('ls-files','--others','--exclude-standard','--full-name').splitlines())
    files={}
    for name in sorted(names):
        f=root/name
        files[name]=({'symlink':os.readlink(f),'resolved':str(f.resolve()),'exists':f.exists()} if f.is_symlink()
            else {'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size} if f.is_file()
            else {'absent':True})
    return {'head':git('rev-parse','HEAD').strip(),'branch':git('branch','--show-current').strip(),'status':git('status','--porcelain=v1'),'files':files}
def dependencies():
    names=['fusion-studio-client/package.json','fusion-studio-client/package-lock.json',
        'fusion-studio-server/package.json','fusion-studio-server/package-lock.json',
        'fusion-studio-client/node_modules/.package-lock.json','fusion-studio-server/node_modules/.package-lock.json',
        'fusion-studio-client/node_modules/electron/package.json',
        'fusion-studio-client/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
        'fusion-studio-server/node_modules/better-sqlite3/build/Release/better_sqlite3.node',
        'fusion-studio-server/native/secure-file-observer/index.js',
        'fusion-studio-server/native/secure-file-observer/binding.gyp',
        'fusion-studio-server/native/secure-file-observer/secure_file_observer.c',
        'fusion-studio-server/native/secure-file-observer/runtime-smoke.js',
        'fusion-studio-server/native/secure-file-observer/build/Release/secure_file_observer.node',
        'fusion-studio-server/node_modules/node-gyp/package.json',
        'fusion-studio-server/node_modules/node-gyp/bin/node-gyp.js']
    values={}
    for name in names:
        f=root/name
        if f.is_file(): values[name]={'resolved':str(f.resolve()),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size}
        else: values[name]={'absent':True}
    for name in ['node','python3','npm']:
        resolved=shutil.which(name)
        values[name]={'path':resolved,'resolved':str(Path(resolved).resolve()) if resolved else None}
    return values
before=snapshot(); deps=dependencies(); start=datetime.datetime.now(datetime.timezone.utc).isoformat(); log=out/(a.label+'.log'); receipt=out/(a.label+'.json')
if receipt.exists(): raise RuntimeError('Refusing to overwrite verification receipt')
with log.open('x') as stream:
    result=subprocess.run(cmd,cwd=cwd,stdout=stream,stderr=subprocess.STDOUT)
r={'schemaVersion':2,'runner':{'path':str(Path(__file__).resolve()),'sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},'label':a.label,'root':str(root),'cwd':str(cwd),'command':cmd,'test_environment':{k:os.environ[k] for k in ['CHAT_TRANSPORT_TEST_PORT','FUSION_LOCAL_MACHINE','FUSION_APP_USER_DATA'] if k in os.environ},'started':start,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit_code':result.returncode,'before':before,'after':snapshot(),'dependencies_before':deps,'dependencies_after':dependencies(),'log':str(log),'log_sha256':hashlib.sha256(log.read_bytes()).hexdigest()}
receipt.write_text(json.dumps(r,indent=2)+'\n'); print(json.dumps({'label':a.label,'exit_code':result.returncode,'log':str(log),'receipt':str(receipt)})); raise SystemExit(result.returncode)
