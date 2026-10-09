from pathlib import Path
from datetime import datetime, timezone
import ast, hashlib, json, os, shutil, stat, subprocess, sys, sysconfig
C=Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control');J=C/'jobs/commit-supervisor/rehearsal-20261004-s6';R=C.parents[2];K=C/'.agents/skills/mc-commit-supervisor'
def fp(p):
 p=Path(p)
 if not p.exists() and not p.is_symlink():return {'exists':False}
 s=p.lstat();b=os.fsencode(os.readlink(p)) if p.is_symlink() else p.read_bytes()
 return {'exists':True,'kind':'symlink' if p.is_symlink() else 'file','mode':oct(s.st_mode),'sha256':hashlib.sha256(b).hexdigest()}
def save(path,data):
 with path.open('x') as f:json.dump(data,f,indent=2);f.write('\n')
 os.chmod(path,0o444)
def graph():return json.loads(json.loads((J/'evidence/fix-xy-python-js-closure-2-command.json').read_text())['stdout'])
def capture(label, baseline=None):
 g=graph();paths=set(g['code_files'])|set(g['package_files'])|{g['parser_tool']}
 local=sorted([*K.joinpath('tests').glob('*.py'),*K.joinpath('scripts').glob('*.py')]);paths.update(map(str,local))
 discovered=sorted(K.joinpath('tests').glob('test_*.py'));tests=[];imports=[]
 for p in local:
  tree=ast.parse(p.read_text())
  imports.extend({'file':str(p),'line':n.lineno,'kind':type(n).__name__,'module':getattr(n,'module',None),'names':[x.name for x in n.names]} for n in ast.walk(tree) if isinstance(n,(ast.Import,ast.ImportFrom)))
  if p in discovered:
   for n in tree.body:
    if isinstance(n,ast.ClassDef):tests.extend({'file':str(p),'class':n.name,'test':x.name,'line':x.lineno} for x in n.body if isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef)) and x.name.startswith('test_'))
 # Bind the selected Python standard runtime conservatively; no site-packages
 # participate in these stdlib-only Python tests.
 stdlib=Path(sysconfig.get_path('stdlib'))
 for p in stdlib.rglob('*'):
  if 'site-packages' in p.parts or '__pycache__' in p.parts:continue
  if p.is_file() and p.suffix in {'.py','.so','.dylib'}:paths.add(str(p))
 selected={}
 for name in ['python3.12','node','git','bash','ps','lsof']:
  q=shutil.which(name);assert q,name;selected[name]={'selected':q,'realpath':str(Path(q).resolve())};paths.update([q,str(Path(q).resolve())])
 selected['python3.12']['version']=sys.version;selected['python3.12']['sys_executable']=sys.executable;selected['python3.12']['prefix']=sys.prefix
 selected['node']['version']=subprocess.check_output([selected['node']['selected'],'--version'],text=True).strip()
 selected['git']['version']=subprocess.check_output([selected['git']['selected'],'--version'],text=True,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')).strip()
 for q in ['AGENTS.md','README.md','fusion-studio-server/scripts/wiki.js','fusion-studio-client/package.json','fusion-studio-server/package.json','ai/RC-MacAir-15/Wiki/.audit-state.json','.git/index','.git/config']:
  paths.add(str(R/q))
 paths.update(str(p) for p in R.joinpath('fusion-studio-server/lib').rglob('*.js'))
 paths.update([str(Path(__file__).resolve()),str(J/'python_suite_js_dependencies_v2.mjs')])
 deps={p:fp(p) for p in sorted(paths)}
 source={arg:subprocess.check_output(['git','-C',str(R),*args],env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')).decode() for arg,args in {'head':['rev-parse','HEAD'],'refs':['show-ref'],'staged_tree_inputs':['ls-tree','HEAD','--','AGENTS.md','README.md','restart-fusion.sh','fusion-studio-server/package.json','fusion-studio-client/package.json']}.items()}
 data={'schema':1,'kind':'EXECUTION_DEPENDENCY_BINDINGS','at':datetime.now(timezone.utc).isoformat(),'actor':'/root/s6_supervisor_fix_xy_1','cwd':str(C),'discovery_pattern':'test_*.py','discovered_modules':[str(p) for p in discovered],'test_methods':tests,'python_imports':imports,'local_python_files':[str(p) for p in local],'javascript_resolution':g,'selected_executables':selected,'python_stdlib':str(stdlib),'source_git':source,'dependencies':deps,'dependency_count':len(deps),'expected_test_count':55,'limits':'Actual source/test/fixture/runtime bindings; generated disposable test inputs derive from bound fixture literals. Standard Node builtins bind to selected Node binary. Static optional driver absences are not executed successes; actual Node coverage is checked separately. No product-runtime readiness claim.'}
 assert len(tests)==55,len(tests)
 if baseline:
  old=json.loads(Path(baseline).read_text());data['pre_path']=str(Path(baseline));data['pre_sha256']=hashlib.sha256(Path(baseline).read_bytes()).hexdigest();data['dependency_mismatches']=[p for p in set(old['dependencies'])|set(deps) if old['dependencies'].get(p)!=deps.get(p)];data['discovery_equal']=old['discovered_modules']==data['discovered_modules'];data['imports_equal']=old['python_imports']==imports;data['source_git_equal']=old['source_git']==source;data['executables_equal']=old['selected_executables']==selected
  assert not data['dependency_mismatches'];assert all(data[k] for k in ['discovery_equal','imports_equal','source_git_equal','executables_equal'])
 out=J/('evidence/'+label+'.json');save(out,data);print(json.dumps({'path':str(out),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'dependency_count':len(deps),'discovered_modules':len(discovered),'test_methods':len(tests),'mismatches':data.get('dependency_mismatches',[])}))
if __name__=='__main__':capture(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else None)
