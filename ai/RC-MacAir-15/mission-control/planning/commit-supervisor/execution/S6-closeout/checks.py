"""Narrow documentation checks and protected readbacks; no runtime effects."""
import json,os,re,stat,difflib
from pathlib import Path
import readbacks as q
O,C,R,J=q.O,q.C,q.R,q.J
owner=json.loads((O/'ownership-and-preimages.json').read_bytes())
manifest=json.loads((q.E/'S6-closeout-manifest.json').read_bytes())
checks=[]
for name,args in [('index',[ 'python3.12','-B',str(C/'.agents/skills/mc-memory-maintenance/scripts/validate_index.py'),str(C)]),('bash-syntax',['bash','-n',str(R/'restart-fusion.sh')])]:
 result,receipt=q.command(name,args);assert result.returncode==0,receipt;checks.append(receipt)
for name in ['fusion-restart.mjs','fusion-restart-target.mjs','fusion-restart-processes.mjs','fusion-restart-probe.mjs']:
 result,receipt=q.command(name+'-syntax',['node','--check',str(R/'scripts'/name)]);assert result.returncode==0;checks.append(receipt)
node_code="""const {createRequire}=require('node:module');const fs=require('node:fs');const req=createRequire(process.argv[1]);const matter=req('gray-matter');const p=process.argv[2];const x=matter(fs.readFileSync(p,'utf8'));process.stdout.write(JSON.stringify(x.data));"""
result,receipt=q.command('wiki-metadata',['node','-e',node_code,str(R/'fusion-studio-client/package.json'),str(q.PAGE)])
assert result.returncode==0;data=json.loads(result.stdout);assert data['name']=='Fusion Restart';assert set(data['metadata'])=={'source-files','last-modified'}
assert data['metadata']['source-files']==['restart-fusion.sh','scripts/fusion-restart.mjs','scripts/fusion-restart-target.mjs','scripts/fusion-restart-processes.mjs','scripts/fusion-restart-probe.mjs']
write=json.loads((O/'write-receipt.json').read_bytes());assert data['metadata']['last-modified']==write['wiki_metadata_last_modified']
assert 'last-modified: "'+data['metadata']['last-modified']+'"' in q.PAGE.read_text()
checks.append(receipt)
version=Path(owner['future_exclusive_version']);preimage=Path(next(r for r in owner['owned_docs'] if r['source']==str(q.PAGE))['preimage'])
assert version.read_bytes()==preimage.read_bytes();old_versions=q.tree(version.parent)
for name,row in owner['existing_complete_versions'].items():assert old_versions[name]==row
assert set(old_versions)==set(owner['existing_complete_versions'])|{version.name}
baseline=json.loads((O/'before.json').read_bytes())
diffs=[];new_links=[];old_broken=[];checks_h2=[]
link=re.compile(r'(?<!!)\[[^\]]*\]\(([^)]+)\)')
def local_links(p,text):
 found={}
 for target in link.findall(text):
  target=target.strip('<>');dest=target.split('#',1)[0]
  if not dest or re.match(r'^[a-z]+:',dest):continue
  path=p.parent/dest
  found[target]=path.exists()
 return found
for row in owner['owned_docs']:
 p=Path(row['source']);old=Path(row['preimage']).read_text();new=p.read_text()
 assert stat.S_IMODE(p.stat().st_mode)==stat.S_IMODE(row['before']['mode'])
 old_h2=re.findall(r'^## (.+)$',old,re.M);new_h2=re.findall(r'^## (.+)$',new,re.M);assert old_h2==new_h2,p
 checks_h2.append({'path':str(p),'unchanged_H2':new_h2})
 old_links=local_links(p,old);current_links=local_links(p,new)
 for t,v in current_links.items():
  if t not in old_links:new_links.append({'page':str(p),'target':t,'exists':v});assert v,(p,t)
 old_broken.extend({'page':str(p),'target':t} for t,v in old_links.items() if not v)
 delta=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile=str(p)+'@preimage',tofile=str(p)+'@current'))
 dst=O/('restart-PAGE.diff' if p==q.PAGE else p.name+'.diff')
 with dst.open('x') as f:f.write(delta)
 diffs.append(q.leaf(dst)|{'path':str(dst)})
 assert not any(line.endswith(' ') or line.endswith('\t') for line in new.splitlines()),p
 for sentence in old.splitlines():
  if '2026-10-04T10:58:05.867587Z' in sentence:assert sentence in new,p
for name in owner['unchanged_adjacent']:
 rel=str(Path(name).relative_to(R));assert q.leaf(name)==baseline['source'][rel],name
# Exact reuse support: doc edits are observed exceptions, never universally unchanged claims.
py=json.loads((J/'evidence/fix-xy-python-pre2.json').read_bytes())
post=json.loads((J/'evidence/fix-xy-python-post2.json').read_bytes())
assert py['dependencies']==post['dependencies']
assert len(py['dependencies'])==3808
node=json.loads((J/'evidence/fix-xy-node17-current-bindings.json').read_bytes())
allowed={str(p) for p in q.DOCS};current_changes=[]
def matches(expected,current):
 if expected.get('exists')!=current.get('exists'):return False
 if not current.get('exists'):return True
 mode=int(expected['mode'],8) if isinstance(expected.get('mode'),str) else expected.get('mode')
 return current['kind']==expected.get('kind') and current['sha256']==expected.get('sha256') and current['mode']==mode
for name,row in py['dependencies'].items():
 cur=q.leaf(name)
 if not matches(row,cur):current_changes.append({'path':name,'historical':row,'current':cur,'assigned_documentation':name in allowed})
assert all(r['assigned_documentation'] for r in current_changes),current_changes
for name,row in node['unique_source_dependencies'].items():assert matches(row,q.leaf(name)),name
binding=json.loads((J/'evidence/fix-xy-python-current-2-bindings.json').read_bytes())
assert binding['exit_code']==0 and binding['test_count']==55 and not binding['unbound_actual_javascript_files']
assert node['exit_code']==0 and node['passes']==17
result,receipt=q.command('original-public-verify',['python3.12','-B',str(C/'.agents/skills/mc-commit-supervisor/scripts/job_snapshot.py'),'verify','--job',str(J)])
assert result.returncode==0;verified=json.loads(result.stdout);assert all(verified[k] for k in ['payloads_valid','matches_checkpoint','status_equal']);checks.append(receipt)
q.save(O/'documentation-checks.json',{'at':q.now(),'raw_commands':checks,'gray_matter_data':data,'unchanged_indexed_H2':checks_h2,'complete_version_preimage_equal':True,'older_versions_and_adjacent_exact':True,'new_local_links':new_links,'preexisting_broken_links_retained':old_broken,'historical_S5_dated_lines_retained':True,'diffs':diffs,'Python55_reuse':{'raw':str(J/'evidence/fix-xy-python-current-2-bindings.json'),'historical_complete3808_prepost_equal':True,'current_exceptions':current_changes,'bound_executed_JS':len(binding['actual_javascript_files']),'qualification':'Six assigned central records/article may now differ. Exact current exceptions are documented; implementation dependencies remain current. Historical binary and current source checks are not current runtime readiness.'},'Node17_reuse':{'raw':str(J/'evidence/fix-xy-node17-current-bindings.json'),'unique_current_source_dependencies':len(node['unique_source_dependencies']),'historical_executable_limit':node['limits']},'actual_private_original_verify':verified,'not_run':'No suite rerun, build/restart/UI/watcher/runtime/Git mutation; unchanged implementation and historical actual evidence retained.'})
print(json.dumps({'narrow_commands':len(checks),'new_links':len(new_links),'old_broken':len(old_broken),'Python55_current_documentation_exceptions':len(current_changes),'Node17_current_source':len(node['unique_source_dependencies']),'original_verify':verified['matches_checkpoint']}))
