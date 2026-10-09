import pathlib,json,subprocess,hashlib,datetime,difflib
home=pathlib.Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
out=home/'jobs/commit-supervisor/chat-ar-20261006/wiki-editor';root=pathlib.Path('/private/tmp/chat-ar-integration-r6pe5gmi/candidate')
navroot=pathlib.Path('/private/tmp/chat-ar-integration-r6pe5gmi/wiki-navigation/Wiki');live=root/'ai/RC-MacAir-15/Wiki'
freeze=json.loads((out/'pre-edit-freeze.json').read_text());edits=json.loads((out/'edit-receipt.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
def snapshot(p):return {str(q.relative_to(p)):sha(q.read_bytes()) for q in p.rglob('PAGE.md') if not any(x.startswith('.') for x in q.relative_to(p).parts)}
def state(p):return {'kind':'file','sha256':sha(p.read_bytes()),'bytes':len(p.read_bytes())} if p.exists() else {'kind':'absent'}
old_live=snapshot(live);state_before=state(live/'.audit-state.json')
for e in edits['pages']:
 p=e['page'];b=(root/p).read_bytes();assert sha(b)==e['final_sha256']
 rel=pathlib.Path(p).relative_to('ai/RC-MacAir-15/Wiki');(navroot/rel).write_bytes(b)
command=['node',str(root/'fusion-studio-server/scripts/wiki.js'),'audit',str(navroot)]
script_sha=sha((root/'fusion-studio-server/scripts/wiki.js').read_bytes());assert script_sha==freeze['navigation_input']['script_sha256']
results=[]
for n in (1,2):
 before=snapshot(navroot);bytes_before={p:(navroot/p).read_text() for p in before}
 run=subprocess.run(command,cwd=home,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (out/('navigation-run-'+str(n)+'.log')).write_text(run.stdout)
 after=snapshot(navroot);changed=[p for p in sorted(set(before)|set(after)) if before.get(p)!=after.get(p)]
 diffs={p:''.join(difflib.unified_diff(bytes_before.get(p,'').splitlines(True),(navroot/p).read_text().splitlines(True),fromfile=p+' before',tofile=p+' after')) for p in changed}
 results.append({'run':n,'command':command,'exit_status':run.returncode,'before_pages':before,'after_pages':after,'changed_pages':changed,'diffs':diffs,'raw_log':str(out/('navigation-run-'+str(n)+'.log')),'raw_log_sha256':sha(run.stdout.encode())})
 assert run.returncode==0
assert results[1]['changed_pages']==[],results[1]['changed_pages']
assert snapshot(live)==old_live,'live Wiki changed during disposable navigation check'
assert state(live/'.audit-state.json')==state_before
heading='010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md';current=(live/heading).read_text();generated=(navroot/heading).read_text()
import re
block=lambda t:re.search(r'<!-- section-toc:start -->.*?<!-- section-toc:end -->',t,re.S).group()
assert block(current)==block(generated)
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'script_sha256':script_sha,'tool_dependencies':[{'path':s['path'],'sha256':s['sha256']} for s in freeze['sources'] if '/wiki/audit/' in s['path'] or s['path'].endswith('scripts/wiki.js')],'disposable_wiki':str(navroot),'runs':results,'repeated_generation_stable':True,'imported_blocks':[{'page':heading,'block':'section-toc','description_deltas':['Change Storm Control: Current watcher -> Legacy bus','Structure: remove watcher from module-map description'],'matches_final_generator':True}],'generated_state_imported':False,'live_audit_state_before':state_before,'live_audit_state_after':state(live/'.audit-state.json'),'excluded_legacy_page':{'path':'006-System_Manager/PAGE.md','exists_in_disposable':(navroot/'006-System_Manager/PAGE.md').exists(),'exists_in_candidate':(live/'006-System_Manager/PAGE.md').exists(),'disposition':'exclude; existing 000 child owns heading; no article adopted'},'other_generated_deltas_disposition':{p:'Disposable-only generator delta; excluded from candidate. See exact diff in runs; no Guidance or additional parent block imported.' for r in results for p in r['changed_pages']},'live_pages_preserved_during_generation':True}
(out/'navigation-checks.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'runs':[{'run':r['run'],'exit_status':r['exit_status'],'changed_pages':r['changed_pages']} for r in results],'stable':True,'events_block_matches':True,'audit_state_imported':False,'legacy_candidate_exists':result['excluded_legacy_page']['exists_in_candidate']}))
