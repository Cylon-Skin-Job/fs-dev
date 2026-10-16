"""Disposable public A06 host producer; preserves saved canonical readbacks."""
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture,current,read_generation,uid,ref,file_hash,encode
from core.commands import INSTALLED
from test_lp02_coverage import CoverageTests

root=Path(sys.argv[1]).resolve();mode=sys.argv[2];root.mkdir(parents=True,exist_ok=True)
case=CoverageTests();case.raw=[];case.extra=[]
if mode=='prepare':
    case.fx=Fixture(root/'store');case.fx.actor['body']['granted_operations']=sorted(INSTALLED);case.fx.save(case.fx.actor)
    data={}
else:
    data=json.loads((root/'fixture.json').read_text());fx=Fixture.__new__(Fixture)
    for key,value in data['fixture'].items():setattr(fx,key,Path(value) if key in ('root','home','sources') else value)
    case.fx=fx;case.extra=data['extra']
raw=json.loads((root/'public.json').read_text()) if (root/'public.json').exists() else [];run=case.fx.run

def audited(request):
    code,response=run(request);raw.append(dict(request=request,exit=code,response=response));(root/'public.json').write_bytes(encode(raw));return code,response
case.fx.run=audited
if mode=='prepare':
    case.ok(case.fx.create('A06 actual Chrome fixture'));case.ok(case.fx.run(case.fx.seed(scope=['Retain source A','Retain source B'],todo=['Check source C'])));case.refresh()
    original=copy.deepcopy(case.capture);target=case.create('Current mapped scope');rows=case.rows(target)
    body={**target['body'],'content':'Explicit rewritten body after semantic merge','item_uuids':original['body']['item_uuids']}
    case.route([dict(operation='record.merge',args=dict(uuid=original['uuid'],target_uuid=target['uuid'],body=body,source_refs=original['source_refs'],reason='Actual body-changing host merge'))],rows)
    a=case.decision('Inference A');b=case.decision('Inference B');batch=case.present([a,b]);late=case.decision('Late inference C')
    issue=case.create('Issue awaiting reviewed direction');category=next(x for x in case.items if x['kind']=='category' and x['body']['category_key']=='issues')
    case.ok(case.fx.run(case.req('record.move_category',dict(uuid=issue['uuid'],category_uuid=category['uuid'],reason='Actual issue routing',source_refs=[]))));case.refresh()
    data.update(capture_original=original,target_original=target,decision_a=a,decision_b=b,late=late,issue_uuid=issue['uuid'],batch_uuid=batch['uuid'])
else:case.refresh()
if mode=='approve':
    batch=next(x for x in case.items if x['uuid']==data['batch_uuid']);approval=case.approval(batch)
    edge=dict(operation='decision.supersede',args=dict(old_uuid=data['issue_uuid'],new_uuid=data['decision_a']['uuid'],scope_item_uuids=[],authority_ref=ref(case.fx.authority),reverse_input=False))
    case.ok(case.fx.run(case.req('transaction.apply',dict(operations=[dict(operation='decision.approve_batch',args=approval['args']),edge]))));case.refresh()
elif mode=='edit':
    a=next(x for x in case.items if x['uuid']==data['decision_a']['uuid']);target=next(x for x in case.items if x['uuid']==data['target_original']['uuid'])
    case.ok(case.fx.run(case.req('transaction.apply',dict(operations=[dict(operation='record.update',args=dict(uuid=a['uuid'],body={**a['body'],'content':'Materially changed inference requires a new approval'},source_refs=a['source_refs'])),dict(operation='record.update',args=dict(uuid=target['uuid'],body={**target['body'],'content':'Later source mapping amendment makes old exact destinations incomplete'},source_refs=target['source_refs']))]))));case.refresh()
elif mode not in ('prepare','inspect'):raise ValueError(mode)
data['fixture']={k:str(v) if isinstance(v,Path) else v for k,v in case.fx.__dict__.items() if k!='run'};data['extra']=case.extra;(root/'fixture.json').write_bytes(encode(data))
proof={}
for key in ('decision_a','decision_b','late'):
    proof[key]=case.ok(case.fx.run(case.req('record.get',dict(uuid=data[key]['uuid'],fields=['body','revision_uuid']))))
proof['ticket']=case.ok(case.fx.run(case.req('record.get',dict(uuid=case.ticket['root_uuid'],fields=['body']))));proof['issue']=case.ok(case.fx.run(case.req('record.get',dict(uuid=data['issue_uuid'],fields=['body']))))
proof['source_pin']=case.ok(case.fx.run(case.req('record.get',dict(uuid=data['capture_original']['uuid'],revision_uuid=data['capture_original']['revision_uuid'],fields=list(data['capture_original'])))))
result=dict(mode=mode,generation=case.plan['root_revision_uuid'],plan_sha256=file_hash(case.folder/'plan.json'),prepared=json.loads((case.fx.home/'.prepared'/(case.plan['root_revision_uuid']+'.json')).read_text()),plan=case.plan,tickets=case.ts,proof=proof,child=str(case.fx.home/next(x for x in case.items if x['kind']=='ticket')['body']['current_home']/'ticket.html'))
(root/('readback-'+mode+'.json')).write_bytes(encode(result));print(json.dumps(result))
