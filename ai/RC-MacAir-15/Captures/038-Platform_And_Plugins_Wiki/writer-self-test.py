#!/usr/bin/env python3
"""Exercise real safe-writer entry point inside disposable fixture roots only."""
import contextlib,datetime,hashlib,importlib.util,io,json,sys,tempfile
from pathlib import Path
import sys
sys.dont_write_bytecode = True
C=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('editor',C/'wiki-edit.py');e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
spec=importlib.util.spec_from_file_location('validator',C/'validate-wiki.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
cases=[]
def check(name,okay):cases.append({'case':name,'passed':bool(okay)})
with tempfile.TemporaryDirectory(prefix='ppw01-writer-fixture-',dir=C) as td:
 root=Path(td);cap=root/'capture';cap.mkdir();rp='ai/RC-MacAir-15/Wiki/fixture/PAGE.md';p=root/rp;p.parent.mkdir(parents=True)
 good='---\nname: Test\ndescription: Intent guidance fixture.\nmetadata:\n  source-files: []\n  last-modified: "2026-09-23T00:00:00Z"\n---\n# Example\n\nBody.\n\n<!-- section-toc:start -->\n<!-- section-toc:end -->\n'
 e.ROOT=root;e.CAP=cap;e.LEDGER=cap/'EDIT-RECEIPTS.json';e.ALLOWED={rp:{'slice':'S01','action':'create'}}
 (cap/'BASELINE.json').write_text(json.dumps({'entries':[{'path':rp,'sha256':None}]}))
 def call(body,expect,phase='content',path=rp,slice='S01'):
  proposal=cap/'proposal.md';proposal.write_text(body);sys.argv=['wiki-edit.py','write',path,str(proposal),'--expect',expect,'--slice',slice,'--phase',phase]
  try:
   with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):e.main()
   return True
  except (Exception,SystemExit):return False
 check('writer_rejects_unauthorized_path',not call(good,'absent',path='outside.md'))
 check('writer_rejects_wrong_slice',not call(good,'absent',slice='S02'))
 check('writer_rejects_invalid_yaml',not call(good.replace('name: Test','name: [broken'),'absent'))
 check('writer_rejects_handwritten_generated_body',not call(good.replace('<!-- section-toc:end -->','made up\n<!-- section-toc:end -->'),'absent'))
 check('writer_creates_absent_page',call(good,'absent') and p.is_file())
 first=p.read_bytes();first_hash=e.digest(first)
 check('writer_rejects_stale_predecessor',not call(good+'new\n','0'*64) and p.read_bytes()==first)
 edited=first.decode().replace('Body.','Changed body.')
 check('writer_rejects_stamp_body_change',not call(edited,first_hash,'stamp') and p.read_bytes()==first)
 check('writer_rejects_generation_body_change',not call(edited,first_hash,'generation') and p.read_bytes()==first)
 check('writer_records_exact_preimage',call(edited,first_hash))
 log=json.loads(e.LEDGER.read_text());row=log['edits'][-1]
 check('snapshot_bytes_exact',(root/row['snapshot']).read_bytes()==first)
 check('receipt_slice_phase_and_current_hash',row['slice']=='S01' and row['phase']=='content' and row['after_sha256']==e.digest(p.read_bytes()))
 check('actual_chain_validator_accepts',not v.edit_ledger_errors({rp:None},{rp:e.digest(p.read_bytes())},log['edits'],{rp},root))
 check('writer_rejects_noop',not call(p.read_text(),e.digest(p.read_bytes())))
report={'command':'python3 writer-self-test.py','checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'tool_sha256':hashlib.sha256((C/'wiki-edit.py').read_bytes()).hexdigest(),'cases':cases,'counts':{'passed':sum(r['passed'] for r in cases),'total':len(cases)},'failures':[r['case'] for r in cases if not r['passed']],'exclusions':['Fixture-only; no live wiki mutation, product runtime or builds.']}
out=C/'runs'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'-writer-self-test.json')
with out.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({'report':str(out),'counts':report['counts'],'failures':report['failures']}))
sys.exit(bool(report['failures']))
