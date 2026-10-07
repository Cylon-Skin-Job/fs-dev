"""One-shot S05 evidence assembly; not a live wiki writer."""
import copy,datetime,hashlib,json,pathlib,subprocess,difflib,re
C=pathlib.Path(__file__).resolve().parent; R=C.parents[3]
def read(n):return json.loads((C/n).read_text())
def save(n,d):
 with (C/n).open('w') as f:json.dump(d,f,indent=2);f.write('\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
G='ai/RC-MacAir-15/Wiki/011-Platform_And_Plugins/000-Platform_And_Plugins/002-Unfinished_Work/PAGE.md'
anchors=['pp-g01--component-host-and-contributions','pp-g02--shell-and-canonical-file-reuse','pp-g03--hybrid-custom-region-interface','pp-g04--external-store-mediation']
claims=read('CLAIMS.json');by={x['id']:x for x in claims['claims']}
for n,a in [('01',0),('02',0),('03',1),('04',1),('08',2),('07',3)]:
 row=copy.deepcopy(by['PP-CUR'+n]);row.update(id='PP-S05-CUR'+n,output=G,anchor=anchors[a],reviewer_conclusion='verified',review_evidence='S05-SELF-REVIEW.md; builder independent gate pending')
 if n=='04':
  row['claim']='Code-owned file target identity is consumed by Files placement ports.'
  row['sources']=[s for s in row['sources'] if s['path'].endswith('fileConnectedOwnerPorts.ts')]
 claims['claims'].append(row)
for i,auth in enumerate(['D04/D05/O02/O06','D02/D06/O02/O06','D10/O05','D03/D11/O07']):
 claims['claims'].append(dict(id=f'PP-G{i+1:02}',classification='gap',authority=auth,output=G,anchor=anchors[i],limits='Bounded source-inspected foundations; end-to-end target unverified, not an exhaustive absence conclusion.',reviewer_conclusion='verified',review_evidence='S05-SELF-REVIEW.md; builder independent gate pending'))
save('CLAIMS.json',claims)
coverage=read('COVERAGE.json');coverage['phase']='S05 documentation coverage verified; builder gate, S05 acceptance and final integration tracked separately'
coverage['status_semantics']='verified means earned documentation/output/evidence coverage. AC07 and AC08 are not fully accepted until the orchestrator records S05 acceptance, final integration CLEAN and final HANDOFF. No future review is claimed.'
for row in coverage['entries']:
 row['status']='verified'
 row.setdefault('evidence',[]).append(dict(slice='S05',output=G,anchor='workspace-gaps-keep-their-existing-owners',check='S05-SELF-REVIEW.md and S05-OUTPUTS.json; final source/hash, link, snapshot, metadata, staging and timestamp checks; prior evidence retained',review='Self-review verified; fresh S05 builder review pending; parent acceptance and integration pending'))
 if row['id'] in ['C09','C10'] and G not in row['outputs']:row['outputs'].append(G)
 if row['id'] in ['AC07','AC08']:
  row['completion_status']='pending_orchestrator_gates'
  row['pending_obligations']=['S05 builder gate (before handoff)','S05 orchestrator acceptance','fresh final SPEC integration review CLEAN','parent final HANDOFF.md and owner review readiness']
save('COVERAGE.json',coverage)
mandatory=[]
for x in read('SOURCES.json')['sources']:
 p=pathlib.Path(x['path']);p=p if p.is_absolute() else R/p;now=sha(p)
 mandatory.append(dict(path=x['path'],sha256=now,preparation_sha256=x['preparation_sha256'],changed=now!=x['preparation_sha256'],assessment='Authorized mapped article edit and final stamp; current product-source claim unchanged' if now!=x['preparation_sha256'] else 'Unchanged; prior inspection retained'))
claim_sources={}
for x in claims['claims']:
 if x['classification']=='current':claim_sources[x['path']]=dict(path=x['path'],sha256=sha(R/x['path']),expected_sha256=x['source_sha256'],scope=x['symbol'])
 for s in x.get('sources',[]):claim_sources[s['path']]=dict(path=s['path'],sha256=sha(R/s['path']),expected_sha256=s['sha256'],scope=s['symbol'])
assert all(x['sha256']==x['expected_sha256'] for x in claim_sources.values())
tooling=[]
for x in read('S00-OUTPUTS.json')['files']:
 if x['path'].endswith('.py') or pathlib.Path(x['path']).name in ['BASELINE.json','NAVIGATION-BASELINE.json','TOOLING.md']:
  tooling.append(dict(path=x['path'],sha256=sha(R/x['path']),expected_sha256=x['sha256']))
assert all(x['sha256']==x['expected_sha256'] for x in tooling)
nav=sorted((C/'runs').glob('*-navigation.json'))
outputs=[]
for x in read('PAGE-MAP.json')['entries']:
 p=R/x['path'];outputs.append(dict(path=x['path'],sha256=sha(p),owning_slice=x['slice']))
save('S05-OUTPUTS.json',dict(entries=outputs,stamped_at=read('TIMESTAMP-RECEIPT.json')['stamped_at'],timestamp_receipt='TIMESTAMP-RECEIPT.json',navigation_reports=[str(p.relative_to(C)) for p in nav]))
save('S05-SOURCE-INSPECTION.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),mandatory=mandatory,claim_sources=list(claim_sources.values()),tooling_unchanged=tooling,limits='New gap material owners freshly read at named boundaries; earlier exact source evidence retained for unchanged prior claims. No product tests/runtime; no universal absence or isolation proof.',tests_read_only=['fusion-studio-client/e2e/component-tab-connected-owner.spec.ts','fusion-studio-server/test/resources/save-controller.test.js']))
paths=[x['path'] for x in outputs];tracked=[];fail=[]
for p in paths:
 if subprocess.run(['git','ls-files','--error-unmatch',p],cwd=R,capture_output=True).returncode==0:tracked.append(p)
 for i,line in enumerate((R/p).read_text().splitlines(),1):
  if line.rstrip()!=line or re.match(r'^(<<<<<<<|=======|>>>>>>>)',line):fail.append(dict(path=p,line=i,text=line))
cmd=['git','diff','--check','--',*tracked];check=subprocess.run(cmd,cwd=R,text=True,capture_output=True)
save('S05-HYGIENE.json',dict(command=cmd,exit_code=check.returncode,stdout=check.stdout,stderr=check.stderr,tracked=len(tracked),untracked=len(paths)-len(tracked),direct_scan_paths=paths,failures=fail))
assert not fail and check.returncode==0
edits=[x for x in read('EDIT-RECEIPTS.json')['edits'] if x['slice']=='S05'];diff=[]
for x in edits:
 if x['phase']=='content':
  before=(R/x['snapshot']).read_text() if x['snapshot'] else ''
  proposal='S05-guidance-proposal.md' if x['snapshot'] else 'S05-gaps-proposal.md'
  diff.extend(difflib.unified_diff(before.splitlines(True),(C/proposal).read_text().splitlines(True),fromfile=x['path']+' predecessor',tofile=x['path']+' content proposal (writer stamps separately)'))
(C/'S05-PROSE-DIFF.patch').write_text(''.join(diff))
print(json.dumps(dict(outputs=len(outputs),source_drifts=sum(x['changed'] for x in mandatory),claim_sources=len(claim_sources),tooling_unchanged=len(tooling),hygiene_failures=len(fail))))
