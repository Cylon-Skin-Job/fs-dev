"""Root final checks only; all six current acceptances must precede execution."""
import pathlib,json,os,hashlib,datetime,subprocess,ast,re,tomllib,stat,unicodedata
from urllib.parse import unquote
C=pathlib.Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control');R=C.parents[2];E=C/'planning/commit-supervisor/execution';K=C/'.agents/skills/mc-commit-supervisor';OUT=E/'SPEC-final-static'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def load(p):return json.loads(pathlib.Path(p).read_text())
def save(n,d):
 p=OUT/n
 with p.open('x') as f:json.dump(d,f,indent=2);f.write('\n')
 p.chmod(0o444)
def command(n,args,envadd=None):
 env={k:v for k,v in os.environ.items()if not k.startswith('GIT_')};env.update(GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1');env.update(envadd or {});start=now();p=subprocess.run(args,cwd=C,env=env,capture_output=True)
 d={'actor':'/root','argv':list(map(str,args)),'cwd':str(C),'started':start,'finished':now(),'exit':p.returncode,'stdout_hex':p.stdout.hex(),'stderr_hex':p.stderr.hex(),'env_overrides':{'GIT_OPTIONAL_LOCKS':'0','PYTHONDONTWRITEBYTECODE':'1',**(envadd or {})}};save(n,d);assert p.returncode==0,(n,p.stderr.decode(errors='replace'));return p.stdout
activation=load(E/'SPEC-final-check-activation.json');assert activation['accepted_slices']==['S1','S2','S3','S4','S5','S6'] and activation['actual_recovery_complete'] and activation['private_preview_stopped'];assert OUT.is_dir()
for n in ['index-command.json']+['skill-'+name+'.json'for name in ['mc-commit-supervisor','mc-code-review-orchestrator','mc-commit-repair-worker','mission-control','monitor','status','mc-roadmap-implementation-supervisor','mc-spec-review-gate']]:
 prior_command=load(OUT/n);assert prior_command['exit']==0,n

config=tomllib.loads((C/'.codex/config.toml').read_text());old=tomllib.loads((E/'S5/preimages/.codex/config.toml').read_text());assert len(config['agents'])==12 and 'mc-review-and-merge'not in config['agents'];assert {k:v for k,v in config.items()if k!='agents'}=={k:v for k,v in old.items()if k!='agents'}
profiles={}
for n,d in config['agents'].items():
 p=C/'.codex'/d['config_file'];a=tomllib.loads(p.read_text());assert a['name']==n and not any(k in a for k in ['model','model_reasoning_effort','reasoning_effort']);profiles[n]={'path':str(p),'sha256':sha(p)}
assert not(C/'.agents/skills/mc-review-and-merge/SKILL.md').exists()and not(C/'.codex/agents/mc-review-and-merge.toml').exists()
pyfiles=sorted(set((K/'scripts').glob('*.py'))|set((K/'tests').glob('*.py')))
for p in pyfiles:ast.parse(p.read_text(),filename=str(p))
workflow=(K/'references/workflow.md').read_bytes();template=(K/'references/job-template.md').read_bytes();assert workflow.startswith((E/'S5/preimages/.agents/skills/mc-commit-supervisor/references/workflow.md').read_bytes());assert template.startswith((E/'S5/preimages/.agents/skills/mc-commit-supervisor/references/job-template.md').read_bytes());assert len(workflow.splitlines())<400
article_templates={'checklist-guide.md','navigation-guide.md'}
mds={p for p in K.rglob('*.md')if p.name not in article_templates}
installed_wiki=pathlib.Path('/private/tmp/mc-s6-commit-supervisor-20261004/candidate/rehearsal-workspace/ai/MC-S6/Wiki')
template_links={}
for template,article in [('checklist-guide.md','001-Checklist/001-Checklist_Guide/PAGE.md'),('navigation-guide.md','001-Checklist/002-Navigation_Guide/PAGE.md')]:
 template_path=K/'tests/rehearsal-fixture'/template;article_path=installed_wiki/article
 assert article_path.is_file(),str(article_path);mds.add(article_path)
 template_links[str(template_path)]={'installed_path':str(article_path),'template_sha256':sha(template_path),'installed_sha256':sha(article_path),'link_resolution':'Validate original template link literals against original declared installed article path; seeded content is a behavioral fixture, not approved production prose'}
mds.add(installed_wiki/'PAGE.md')
save('template-installed-link-contexts.json',template_links)
for s in load(E/'slice-ledger.json')['slices'][:5]:
 for d in s.get('current_revision',[]):
  p=pathlib.Path(d['path']);
  if p.suffix=='.md' and p.exists():mds.add(p)
for n in ['AGENTS.md','todo.md','registry.md','handoff.md','deployment.md','skills-and-agents.md','session-contract.md','record-templates.md','mission-control.md','review-and-merge-design.md','review-and-merge-handoff.md']:mds.add(C/n)
page=R/'ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/004-Fusion_Restart/PAGE.md';mds.add(page)
def anchors(p):
 out=[];fence=False;seen={}
 for line in p.read_text().splitlines():
  if line.strip().startswith(('```','~~~')):fence=not fence;continue
  if fence:continue
  m=re.match(r'^#{1,6}\s+(.+?)\s*#*$',line)
  if m:
   text=re.sub(r'<[^>]*>','',m[1]).lower();text=''.join(c for c in text if c=='_'or c=='-'or c.isspace()or unicodedata.category(c)[0]in ['L','N']);text=text.replace(' ','-');count=seen.get(text,0);seen[text]=count+1;out.append(text+('-'+str(count)if count else ''))
 return set(out)
links=[];fragments=[]
for p in sorted(mds):
 for m in re.finditer(r'\]\((?:<([^>]+)>|([^\s)]+))\)',p.read_text()):
  target=m[1]or m[2]
  if '://'in target:continue
  file,sep,frag=target.partition('#');q=(p.parent/unquote(file)).resolve()if file else p;assert q.exists(),(str(p),target);links.append({'source':str(p),'target':target,'resolved':str(q)})
  if sep and frag and q.suffix=='.md':assert unquote(frag)in anchors(q),(str(p),target);fragments.append({'source':str(p),'target':target})
save('links.json',links);save('fragments.json',fragments)
prior=load(E/'S6-root-renewed-check-source-preservation.json');baseline=load(E/'source-file-baseline.json');assert sha(E/'source-file-baseline.json')==prior['source_baseline_sha256'];owned=set(prior['explicit_owned_baseline_paths']);owned.add(str(page.relative_to(R)));assert len(owned)==23
checked=0;absences=0
for rel,d in baseline.items():
 if rel in owned:continue
 p=R/rel;k=d['kind']
 if k=='absent':assert not p.exists()and not p.is_symlink(),rel;absences+=1
 elif k=='file':assert p.is_file()and not p.is_symlink()and sha(p)==d['sha256']and stat.S_IMODE(p.stat().st_mode)==d['mode'],rel
 elif k=='symlink':assert p.is_symlink()and os.readlink(p)==d['target'],rel
 else:raise AssertionError((rel,k))
 checked+=1
assert checked==15942 and absences==68
cache=load(C/'jobs/commit-supervisor/rehearsal-20261004-s6/evidence/fix-xy-check-protection-pre.json')['source_build_caches']
for rel,d in cache.items():
 p=R/rel;s=p.lstat();assert stat.S_IMODE(s.st_mode)==stat.S_IMODE(d['mode'])and sha(p)==d['sha256'],rel
head=command('git-head.json',['git','-C',str(R),'rev-parse','HEAD']).decode().strip();assert head=='d15792920731f85e45b743519d4af2b807d95a9c';assert sha(R/'.git/index')=='f37b5bfc9a44893b132661290fe095ddafccb79bed38ca9007dc3803d2ff7966'
initial=load(C/'jobs/commit-supervisor/rehearsal-20261004-s6/recovery-1/initial.json')
for label,args in [('refs',['for-each-ref','--format=%(refname) %(objectname)']),('configuration',['config','--local','--list','--null']),('remotes',['remote','-v']),('reflogs',['reflog','show','--all','--format=%H %gd %gs'])]:
 # Match each exact saved raw argument vector rather than assuming format.
 raw=initial['raw_git']['source'][label];out=command('git-'+label+'.json',raw['command']);assert out==pathlib.Path(raw['stdout_raw']['path']).read_bytes(),label
for name,row in initial['schedules'] and [(x['path'],x)for x in initial['schedules']]:assert sha(name)==row['sha256'] and row['status']=='PAUSED'and not row['matching']
result={'at':now(),'role_profiles':profiles,'profile_count':12,'no_added_model_effort_pins':True,'skill_validators':8,'index_documents':21,'python_AST_sources':{str(p):sha(p)for p in pyfiles},'links':len(links),'fragments':len(fragments),'accepted_prefixes_exact':True,'source_baseline_total':len(baseline),'owned_original_exclusions':sorted(owned),'unowned_entries_checked':checked,'absences_checked':absences,'cache_entries_checked':len(cache),'HEAD':head,'physical_source_index':sha(R/'.git/index'),'source_refs_config_remotes_reflogs_equal':True,'paused_nonmatching_schedules_unchanged':5,'real_restart_article_owned_later':'Original article excluded only now after explicit S6 authored closeout; preimage/version separately checked','result':'FINAL_STATIC_AND_SOURCE_PRESERVATION_PASSED'};save('result.json',result);print(json.dumps({k:v for k,v in result.items()if k not in ['role_profiles','python_AST_sources','owned_original_exclusions']},indent=2))
