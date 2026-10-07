"""Final read-only documentation integration checks. Never starts the product."""
import base64, difflib, hashlib, json, re, subprocess
from pathlib import Path
from urllib.parse import unquote
root=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
c=root/'ai/RC-MacAir-15/Captures/033-Chat_Wiki_Reconciliation'
b=json.loads((c/'EXECUTION-BASELINE.json').read_text())
sha=lambda value:hashlib.sha256(value).hexdigest()
errors=[];counts={}; exclusions=[]
def check(kind,ok,detail):
 counts[kind]=counts.get(kind,0)+1
 if not ok: errors.append(f'{kind}: {detail}')
expected={p['path']:p['sha256'] for p in b['pages']}; snapshots=[]
for n in range(1,8):
 records=json.loads((c/f'PART-{n:02}-SNAPSHOTS.json').read_text())
 for r in records:
  raw=(root/r['snapshot']).read_bytes(); snapshots.append(r['snapshot'])
  check('snapshot_chain',sha(raw)==r['pre_sha256']==expected[r['path']],r['snapshot'])
 if n<7: expected.update(json.loads((c/f'PART-{n:02}-CHECKS.json').read_text())['candidate_pages'])
 else:
  changed={r['path'] for r in records}
  expected.update({p:sha((root/p).read_bytes()) for p in changed})
pattern=rb'<!--\s*(section-toc|children):start\s*-->.*?<!--\s*\1:end\s*-->'
for r in b['pages']:
 p=root/r['path'];raw=p.read_bytes();old=base64.b64decode(r['content_base64'])
 check('current_candidate',sha(raw)==expected[r['path']],r['path'])
 check('generated_blocks',[m.group(0) for m in re.finditer(pattern,old,re.S)]==[m.group(0) for m in re.finditer(pattern,raw,re.S)],r['path'])
 added=[line[1:] for line in difflib.unified_diff(old.decode().splitlines(),raw.decode().splitlines()) if line.startswith('+') and not line.startswith('+++')]
 check('no_new_ephemeral_dependency',not any(re.search(r'SPEC-|Captures/|PART-0',line) for line in added),r['path'])
for r in b['protected_files']:
 p=root/r['path'];check('protected_files',p.is_file() and sha(p.read_bytes())==r['sha256'],r['path'])
for field in ('approved_spec','preparation_baseline'):
 r=b[field];check('authority_unchanged',sha((root/r['path']).read_bytes())==r['sha256'],r['path'])
check('execution_baseline_unchanged',sha((c/'EXECUTION-BASELINE.json').read_bytes())=='b68afcb2f6e31b898b759e7115e6a64eb7749ec5cf7a48e118730737848dd916','execution baseline')
check('revision',subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==b['head'],'HEAD')
check('product_inventory',set(subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard','--','fusion-studio-client','fusion-studio-server']).decode().split('\0'))-{''}<={r['path'] for r in b['protected_files']},'no new product paths')
paths=list(expected);node="const fs=require('fs'),m=require('./fusion-studio-client/node_modules/gray-matter');process.stdout.write(JSON.stringify(JSON.parse(process.argv[1]).map(p=>({path:p,data:m(fs.readFileSync(p,'utf8')).data}))));"
parsed=json.loads(subprocess.check_output(['node','-e',node,json.dumps(paths)],cwd=root,text=True))
for item in parsed:
 p=root/item['path'];data=item['data'];check('frontmatter',bool(data.get('name') and data.get('description') and isinstance(data.get('metadata'),dict)),item['path'])
 for src in data['metadata'].get('source-files',[]):
  target=root/src.replace('<machine>','RC-MacAir-15');check('source_code_files',target.is_file() and target.suffix in ('.js','.ts','.tsx','.css','.mjs','.cjs') and not any(x in src for x in '*?{}'),src)
 body=p.read_text()
 for example in re.findall(r'```json\n(.*?)```',body,re.S):
  try:json.loads(example);valid=True
  except json.JSONDecodeError:valid=False
  check('json_examples',valid,item['path'])
 body=re.sub(r'```.*?```','',body,flags=re.S)
 for url in re.findall(r'(?<!!)\[[^\]]+\]\(([^)]+)\)',body):
  if re.match(r'\w+://',url):exclusions.append({'external_url_not_fetched':url,'reason':'external navigation outside local documentation verification'});continue
  path,_,fragment=unquote(url).partition('#');target=(p.parent/path).resolve() if path else p
  check('relative_links',target.is_file(),f'{item["path"]}: {url}')
  if fragment and target.is_file():
   headings=re.findall(r'^#{1,6}\s+(.+?)\s*#*$',target.read_text(),re.M);slugs=[re.sub(r'[^\w\- ]','',h.lower()).replace(' ','-') for h in headings]
   check('heading_fragments',fragment in slugs,f'{item["path"]}: {url}')
sweep=json.loads((c/'PART-07-SWEEP.json').read_text())
check('sweep_inventory',{r['path'] for r in sweep['pages']}==set(expected) and len(sweep['pages'])==39,'39 pages')
for r in sweep['pages']:check('sweep_current_bytes',r['sha256']==sha((root/r['path']).read_bytes()) and bool(r['claim_scope']) and r['disposition'] in ('changed and checked','read and consistent for this reconciliation'),r['path'])
# Include untracked evidence and snapshots; ordinary git diff excludes them.
for p in sorted(c.iterdir()):
 if not p.is_file() or p.suffix not in ('.md','.json','.py'):continue
 raw=p.read_bytes();check('evidence_whitespace',raw.endswith(b'\n') and all(not line.endswith((b' ',b'\t')) for line in raw.splitlines()),p.name)
 if p.suffix=='.json':
  try:json.loads(raw);valid=True
  except json.JSONDecodeError:valid=False
  check('evidence_json',valid,p.name)
for name in snapshots:
 raw=(root/name).read_bytes();check('snapshot_whitespace',raw.endswith(b'\n') and all(not line.endswith((b' ',b'\t')) for line in raw.splitlines()),name)
for name in ('PART-07.md','HANDOFF.md'):
 if (c/name).exists():
  item=json.loads(subprocess.check_output(['node','-e',node,json.dumps([str(c/name)])],cwd=root,text=True))[0]['data'];check('evidence_frontmatter',bool(item.get('name') and item.get('description') and isinstance(item.get('metadata'),dict)),name)
result=subprocess.run(['git','diff','--check','--','ai/RC-MacAir-15/Wiki/007-Chat_System','ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections'],cwd=root,capture_output=True,text=True)
check('scoped_diff_check',result.returncode==0,result.stdout+result.stderr)
print(json.dumps({'counts':counts,'passed':sum(counts.values())-len(errors),'errors':errors,'warnings':[],'exclusions':exclusions,'candidate_pages':{p:sha((root/p).read_bytes()) for p in sorted(changed)},'integrated_pages':{p:sha((root/p).read_bytes()) for p in sorted(expected)}},indent=2))
raise SystemExit(bool(errors))
