from pathlib import Path
import os,subprocess,json,datetime,time
c=Path.cwd(); r=c.parents[2]; e=c/'planning/commit-supervisor/execution'; k=c/'.agents/skills/mc-commit-supervisor'; py='/opt/homebrew/bin/python3.12'
commands=[
 ('focused-current',['node','--test',str(k/'tests/test_restart_runtime.mjs')],{'FUSION_RESTART_TEST_EVIDENCE':str(e/'S4-race-smoke-current')}),
 ('cumulative-python',[py,'-B','-m','unittest','discover','-s',str(k/'tests'),'-p','test_*.py','-v'],{}),
 ('bash-syntax',['bash','-n',str(r/'restart-fusion.sh')],{}),
 *[(p.name+'-syntax',['node','--check',str(p)],{}) for p in sorted((r/'scripts').glob('fusion-restart*.mjs'))],
 ('canonical-dry-run',['bash',str(r/'restart-fusion.sh'),'--repo',str(r),'--machine','RC-MacAir-15','--dry-run'],{'FUSION_APP_USER_DATA':'','FUSION_LOCAL_MACHINE':''}),
 ('skill-validate',['/Users/rccurtrightjr./.local/bin/uv','run','--offline','--python',py,'--with','PyYAML','python','-B','/Users/rccurtrightjr./.codex/skills/.system/skill-creator/scripts/quick_validate.py','/Users/rccurtrightjr./.codex/skills/fusion-electron-restart'],{}),
 ('index-validate',[py,'-B',str(c/'.agents/skills/mc-memory-maintenance/scripts/validate_index.py'),str(c)],{})]
results=[]
for label,args,extra in commands:
 start=time.monotonic(); out=e/f'S4-race-{label}.log'
 with out.open('wb') as log:
  result=subprocess.run(args,cwd=c,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',GIT_OPTIONAL_LOCKS='0',**extra),stdout=log,stderr=subprocess.STDOUT)
 results.append({'label':label,'argv':args,'cwd':str(c),'environment_changes':extra,'exit':result.returncode,'duration_seconds':time.monotonic()-start,'log':str(out),'at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 (e/'S4-race-checks.json').write_text(json.dumps(results,indent=2)+'\n')
 print(label,result.returncode,flush=True)
 if result.returncode: raise SystemExit(result.returncode)
