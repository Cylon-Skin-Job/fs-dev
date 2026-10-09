"""Closeout-only readbacks; no product, Git index/ref or runtime mutations."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, stat, subprocess, sys
C=Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
R=C.parents[2]; E=C/'planning/commit-supervisor/execution'; O=E/'S6-closeout'
J=C/'jobs/commit-supervisor/rehearsal-20261004-s6'
P=Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate')
W=R/'ai/RC-MacAir-15/Wiki'
PAGE=W/'007-Chat_System/005-Testing_And_Operations/004-Fusion_Restart/PAGE.md'
DOCS=[C/n for n in ['AGENTS.md','todo.md','registry.md','handoff.md','deployment.md','skills-and-agents.md']]+[PAGE]
env={k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
env.update(GIT_OPTIONAL_LOCKS='0',GIT_LITERAL_PATHSPECS='1',PYTHONDONTWRITEBYTECODE='1')
sys.path.insert(0,str(C/'.agents/skills/mc-commit-supervisor/scripts'))
from snapshot_state import relevant_state
def now():return datetime.now(timezone.utc).isoformat()
def sha(data):return hashlib.sha256(data).hexdigest()
def save(path,x):
    with Path(path).open('x') as f:json.dump(x,f,indent=2);f.write('\n')
def leaf(path):
    path=Path(path)
    try:s=path.lstat()
    except FileNotFoundError:return {'exists':False}
    kind='file' if stat.S_ISREG(s.st_mode) else 'symlink' if stat.S_ISLNK(s.st_mode) else 'directory'
    x={'exists':True,'kind':kind,'mode':s.st_mode,'dev':s.st_dev,'ino':s.st_ino,'size':s.st_size,'mtime_ns':s.st_mtime_ns}
    if kind in ['file','symlink']:x['sha256']=sha(os.fsencode(os.readlink(path)) if kind=='symlink' else path.read_bytes())
    return x
def tree(path):return {str(p.relative_to(path)):leaf(p) for p in sorted(Path(path).rglob('*')) if p.is_file() or p.is_symlink()}
def command(tag,args,cwd=C,data=None):
    start=now();r=subprocess.run(args,cwd=cwd,env=env,input=data,capture_output=True)
    raw={}
    for name,body in [('stdout',r.stdout),('stderr',r.stderr)]:
        p=O/(tag+'.'+name)
        with p.open('xb') as f:f.write(body)
        raw[name]={'path':str(p),'sha256':sha(body),'size':len(body)}
    x={'started':start,'finished':now(),'command':args,'cwd':str(cwd),'exit_code':r.returncode,'environment_overrides':{'GIT_OPTIONAL_LOCKS':'0','GIT_LITERAL_PATHSPECS':'1','PYTHONDONTWRITEBYTECODE':'1'},'git_environment':'All inherited GIT_* stripped',**raw}
    save(O/(tag+'.command.json'),x);return r,x
def git(repo,*args):
    r=subprocess.run(['git','-C',str(repo),*args],env=env,capture_output=True)
    assert r.returncode==0,(args,r.stderr)
    return r.stdout
def snapshot(tag):
    names=set(os.fsdecode(n) for n in git(R,'ls-files','-z','--cached','--others','--exclude-standard').split(b'\0') if n)
    omitted=[str(O.relative_to(R))+'/',str((E/'S6-closeout-builder.md').relative_to(R)),str((E/'S6-closeout-manifest.json').relative_to(R))]
    source={n:leaf(R/n) for n in sorted(names) if not any(n.startswith(x) for x in omitted)}
    prior=json.loads((J/'recovery-1/after-original.json').read_bytes())
    manifest=json.loads((J/'recovery/manifest.json').read_bytes())
    x={'at':now(),'actor':'/root/s6_builder','source':source,'source_omissions':omitted,'source_caches':{n:leaf(R/n) for n in prior['source_build_caches']},'protected_storage':{n:leaf(n) for n in prior['protected_profile_storage']},'private_profile':tree(P.parent/'profile'),'candidate':relevant_state(P,manifest['owned'],manifest['protected_repos']),'old_wiki_versions':tree(PAGE.parent/'.versions'),'git':{}}
    for label,repo in [('source',R),('candidate',P)]:
        x['git'][label]={}
        for n,args in [('head',['rev-parse','HEAD']),('refs',['for-each-ref','--format=%(refname)%00%(objectname)']),('stage',['ls-files','--stage','-z']),('flags',['ls-files','-v','-z']),('config',['config','--null','--list','--show-origin']),('remotes',['remote','-v']),('status',['status','--porcelain=v1','-z','--untracked-files=all']),('reflogs',['reflog','show','--all','--format=%H%x00%gD%x00%gs'])]:
            result,receipt=command(tag+'-'+label+'-'+n,['git','-C',str(repo),*args]);assert result.returncode==0
            x['git'][label][n]=receipt
        x['git'][label]['physical_index']=leaf(repo/'.git/index')
    save(O/(tag+'.json'),x)
    print(json.dumps({'tag':tag,'source':len(source),'cache':len(x['source_caches']),'candidate':len(x['candidate']['paths']),'profile':len(x['private_profile']),'index':x['git']['source']['physical_index']['sha256']}))
    return x
if __name__=='__main__':snapshot(sys.argv[1])
