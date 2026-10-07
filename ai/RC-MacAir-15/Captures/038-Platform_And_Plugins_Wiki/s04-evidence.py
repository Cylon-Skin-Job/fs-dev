from pathlib import Path
import json,hashlib,datetime,difflib,subprocess,re
C=Path(__file__).resolve().parent;R=C.parents[3]
def sha(p):return hashlib.sha256((R/p).read_bytes()).hexdigest()
def save(n,d):(C/n).write_text(json.dumps(d,indent=2)+'\n')
P='ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/'
pg=lambda p:P+p+'/PAGE.md'
claims=json.loads((C/'CLAIMS.json').read_text())
for row in claims['claims']:
 if row['id']=='PP-D09':row.update(anchor='approved-agent-orientation',reviewer_conclusion='pending S04 builder review')
 if row['id']=='PP-CUR06':
  row.update(anchor='current-implementation-and-gap',reviewer_conclusion='pending S04 builder review')
  row['claim']='Inspected thread activation validates workspace manager projectRoot and passes it through compat to OpenCode; adapter uses it for --dir and process cwd. Instance-local context assembly remains unverified end to end.'
  row['sources']=[{'path':p,'symbol':s,'sha256':sha(p)} for p,s in [('fusion-studio-server/lib/harness/compat.js','spawnThreadWire; startHarness'),('fusion-studio-server/lib/ws/thread-ws-handlers.js','spawnAndSetupWire'),('fusion-studio-server/lib/views/index.js','listV2ViewFolders; loadV2ViewShellFromEntry')]]
for authority,page,anchor in [('D04','002-View_Architecture','approved-presentation-boundary'),('D05','002-View_Architecture','approved-presentation-boundary'),('D06','002-View_Architecture','approved-presentation-boundary'),('D07','021-Workspace_Compositions','approved-provisioning'),('D08','022-View_Configuration_And_Agents','approved-agent-orientation'),('D10','006-Custom_Iframe','current-status-and-limits'),('O04','000-Workspaces_And_Views/002-Decisions','open-product-choices')]:
 claims['claims'].append({'id':'PP-S04-'+authority,'classification':'open' if authority.startswith('O') else 'approved','authority':authority,'output':pg(page),'anchor':anchor,'reviewer_conclusion':'pending S04 builder review'})
claims['claims'].append({'id':'PP-S04-G04','classification':'gap','authority':'D09/O04; WV-G04/WV-O06','output':pg('000-Workspaces_And_Views/003-Unfinished_Work'),'anchor':'wv-g04--view-local-agent-context','limits':'Current supplied projectRoot launch and registry inspection do not establish end-to-end local context. No exhaustive absence or runtime claim.','reviewer_conclusion':'pending S04 builder review'})
save('CLAIMS.json',claims)
coverage=json.loads((C/'COVERAGE.json').read_text())
for row in coverage['entries']:
 if row['id'] in ['D02','D03','D04','D05','D06','D07','D08','D09','D10','D12','C01','C02','C04','C05','C06','C08','C09','C10','AC01','AC02','AC03','AC04','AC05','AC06','AC07','AC08']:
  page=pg('022-View_Configuration_And_Agents');anchor='approved-agent-orientation'
  if row['id'] in ['D02','D03','D04','D05','D06','C01','C02','C04']:page=pg('002-View_Architecture');anchor='approved-presentation-boundary'
  if row['id'] in ['D07','D08','D12','C05']:page=pg('021-Workspace_Compositions');anchor='approved-provisioning'
  if row['id'] in ['D10','C08']:page=pg('006-Custom_Iframe');anchor='current-status-and-limits'
  row.setdefault('evidence',[]).append({'slice':'S04','output':page,'anchor':anchor,'check':'S04-SELF-REVIEW.md; S04-PROSE-DIFF.patch; slice S04 validation; applicable portion only','review':'pending S04 builder review; final generated links/stamp/integration remain S05'})
save('COVERAGE.json',coverage)
sources={
'fusion-studio-server/lib/harness/opencode/index.js':'buildRunArgs 43–47; startThread/sendMessage 135–205',
'fusion-studio-server/lib/harness/compat.js':'spawnThreadWire/startHarness 245–305',
'fusion-studio-server/lib/ws/thread-ws-handlers.js':'spawnAndSetupWire 656–705; manager binding and supplied projectRoot',
'fusion-studio-server/lib/views/index.js':'listV2ViewFolders/loadV2ViewShellFromEntry 315–410',
'fusion-studio-server/lib/workspace/create-service.js':'template constants 28–30; scaffoldProjectV2Unchecked 65–125',
'fusion-studio-client/src/components/ContentArea.tsx':'CONTENT_COMPONENTS/ContentFrame/ContentArea 34–120',
'fusion-studio-server/lib/thread/thread-runtime-controller.js':'getRuntimeKey and activation projectRoot references; inspection only, not a new output claim',
'fusion-studio-server/lib/wire/process-manager.js':'projectRoot routing symbols; inspection only, not a new output claim',
'fusion-studio-server/test/harness/opencode/harness-send-message.test.js':'source-only expectations around --dir/cwd at 128–168; not executed',
'fusion-studio-server/test/harness/compat.test.js':'search/read for adapter boundary; not executed'}
save('S04-SOURCE-INSPECTION.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':[{'path':p,'sha256':sha(p),'scope':scope} for p,scope in sources.items()],'limits':'Bounded named source/symbol inspection; prior source evidence retained for unchanged paragraphs. No runtime certification, app launch, build or product tests. Missing guessed thread-runtime.js resolved to thread-runtime-controller.js; no claim uses nonexistent file.'})
with (C/'SOURCE-INSPECTION.md').open('a') as f:f.write('\n## S04 execution inspection\n\nSee `S04-SOURCE-INSPECTION.json` for fresh exact hashes and symbol scope. Activation checks the workspace manager root, compat passes that root unchanged, and OpenCode uses it for both --dir and process cwd. The registry loads System/Views and does not establish the target context assembly. Current source assertions are bounded observations, with no runtime or product test certification. All nine S04 predecessor hashes matched BASELINE before writes. The validator will report these mapped source-article edits as source drift; EDIT-RECEIPTS attributes them to S04, and normative preparation hashes remain untouched.\n')
# Every S04 raw predecessor equals the approved execution baseline, so this diff is both the raw slice and baseline diff.
edits=[x for x in json.loads((C/'EDIT-RECEIPTS.json').read_text())['edits'] if x['slice']=='S04']
baseline=json.loads((C/'BASELINE.json').read_text())
raw=[];outs=[];fail=[];counts=[]
for e in edits:
 before=(R/e['snapshot']).read_text();after=(R/e['path']).read_text();assert e['before_sha256']==next(x['sha256'] for x in baseline['entries'] if x['path']==e['path'])
 raw+=difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile=e['snapshot'],tofile=e['path'])
 outs.append({'path':e['path'],'sha256':sha(e['path']),'snapshot':e['snapshot'],'predecessor_sha256':e['before_sha256']})
 for i,line in enumerate(after.splitlines(),1):
  if line.rstrip()!=line or re.match(r'^(<<<<<<<|=======|>>>>>>>)',line):fail.append({'path':e['path'],'line':i})
 sm=difflib.SequenceMatcher(None,before.splitlines(),after.splitlines());counts.append({'path':e['path'],'changed_line_groups':len([x for x in sm.get_opcodes() if x[0]!='equal'])})
(C/'S04-PROSE-DIFF.patch').write_text(''.join(raw));save('S04-OUTPUTS.json',outs)
paths=[x['path'] for x in outs];tracked=subprocess.run(['git','ls-files','--',*paths],capture_output=True,text=True,check=True).stdout.splitlines();cmd=['git','diff','--check','--',*tracked];r=subprocess.run(cmd,capture_output=True,text=True)
save('S04-HYGIENE.json',{'paths':paths,'whitespace_conflict_failures':fail,'raw_diff':'S04-PROSE-DIFF.patch','predecessors_equal_BASELINE':True,'counts':counts,'git_diff_check':{'argv':cmd,'exit_code':r.returncode,'stdout':r.stdout,'stderr':r.stderr},'untracked_pages':sorted(set(paths)-set(tracked)),'scan_scope':'All 9 pages directly scanned; tracked git diff is supplemental because it includes earlier owner changes. Generated body preserved by safe writer.'})
print('Evidence captured:',len(outs),'outputs;',len(fail),'hygiene failures; git diff --check',r.returncode)
