"""Small actual seed-omission disclosure fixture through public A06 intake."""
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture,current,uid,ref,encode,file_hash
from core.commands import INSTALLED
from test_lp02_coverage import CoverageTests
root=Path(sys.argv[1]).resolve();mode=sys.argv[2];root.mkdir(parents=True,exist_ok=True);c=CoverageTests();c.extra=[]
if mode=='prepare':
    c.fx=Fixture(root/'store');c.fx.actor['body']['granted_operations']=sorted(INSTALLED);c.fx.save(c.fx.actor);data={}
else:
    data=json.loads((root/'fixture.json').read_text());c.fx=Fixture.__new__(Fixture)
    for key,value in data['fixture'].items():setattr(c.fx,key,Path(value) if key in ('root','home','sources') else value)
    c.extra=data['extra']
raw=json.loads((root/'public.json').read_text()) if (root/'public.json').exists() else [];run=c.fx.run

def audited(request):
    code,response=run(request);raw.append(dict(request=request,exit=code,response=response));(root/'public.json').write_bytes(encode(raw));return code,response
c.fx.run=audited
if mode=='prepare':
    c.ok(c.fx.create('A06 retained source disposition'));c.ok(c.fx.run(c.fx.seed(scope=['Current scope A','Current scope B'],todo=['Prior check C'])));c.refresh();dropped=next(x for x in c.items if x['kind']=='source_item' and x['body']['source_alias']=='todo-0');oldcontent=next(x for x in c.items if x['kind']=='content' and x['body']['title']=='ToDo');data.update(dropped_uuid=dropped['uuid'],old_content=copy.deepcopy(oldcontent))
else:c.refresh()
if mode=='omit':
    seed=c.fx.seed(content='New explicit seed omits prior Check C',scope=['Current scope A','Current scope B']);args={k:seed['args'][k] for k in ('seed_ref','scope_items','checklist_items')};args['checklist_items']=[];rows=c.rows(c.capture)
    for row in rows:
        if row['source_item_uuid']==data['dropped_uuid']:
            decision=c.evidence('Actual owner drop instruction','Drop prior check C only','owner_decision',[data['dropped_uuid']]);row.update(disposition='dropped',note='Owner dropped the prior check C',destination_refs=[],disposition_decision={**ref(decision),'scope_item_uuids':[data['dropped_uuid']]})
        else:row['source_revision_uuid']=args['seed_ref']['revision_uuid']
    c.route([dict(operation='ticket.seed_apply',args=args)],rows)
elif mode!='prepare':raise ValueError(mode)
data['fixture']={k:str(v) if isinstance(v,Path) else v for k,v in c.fx.__dict__.items() if k!='run'};data['extra']=c.extra;(root/'fixture.json').write_bytes(encode(data));target=next(x for x in c.items if x['kind']=='ticket')
result=dict(mode=mode,generation=c.plan['root_revision_uuid'],plan_sha256=file_hash(c.folder/'plan.json'),prepared=json.loads((c.fx.home/'.prepared'/(c.plan['root_revision_uuid']+'.json')).read_text()),plan=c.plan,tickets=c.ts,old_content=data['old_content'],current_retained_content=next(x for x in c.items if x['uuid']==data['old_content']['uuid']),ticket=c.ok(c.fx.run(c.req('record.get',dict(uuid=target['uuid'],fields=['body'])))),child=str(c.fx.home/target['body']['current_home']/'ticket.html'))
(root/('readback-'+mode+'.json')).write_bytes(encode(result));print(json.dumps(result))
