"""Small persistent A07 fixture; all business setup and updates use saved public CLI."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_lp03_discussions import DiscussionsTests,INSTALLED
from support import Fixture,current,ref,file_hash,encode

root=Path(sys.argv[1]).resolve();mode=sys.argv[2];root.mkdir(parents=True,exist_ok=True)
t=DiscussionsTests();t.raw=[]
if mode=='prepare':
    t.fx=Fixture(root);t.fx.actor['body']['granted_operations']=sorted(INSTALLED);t.fx.save(t.fx.actor);t.fx.run=t.call
    t.ok(t.fx.create('A07 Chrome discussions'));t.ok(t.call(t.fx.seed('Concurrent phase conversations')));t.refresh()
    a,assignment,_=t.bind();b,_,_=t.bind();da,ra,_=t.register(a,0);db,rb,_=t.register(b,1)
    t.ok(t.call(t.summary(a,da,'Focus A: first phase',recorded=[ra['receipt_ref']])));t.refresh()
    fixture=dict(fx={k:str(v) if isinstance(v,Path) else v for k,v in t.fx.__dict__.items() if k!='run'},a=a,b=b,da=da,db=db,ra=ra,rb=rb,phase_a=t.phases[0]['uuid'],phase_b=t.phases[1]['uuid'])
else:
    fixture=json.loads((root/'fixture.json').read_text());t.fx=Fixture.__new__(Fixture)
    for key,value in fixture['fx'].items():setattr(t.fx,key,Path(value) if key in ('root','sources','home') else value)
    t.fx.run=t.call;t.refresh()
    if mode=='b':t.ok(t.call(t.summary(fixture['b'],fixture['db'],'Focus B: latest open phase',recorded=[fixture['rb']['receipt_ref']])))
    elif mode=='child':
        child,_,_=t.bind('inline-support','child',fixture['a']['uuid']);fixture['child']=child
        t.ok(t.call(t.summary(child,fixture['da'],'Focus child: actual inline writer')))
    elif mode=='a':t.ok(t.call(t.summary(fixture['a'],fixture['da'],'Focus A: switched back',recorded=[fixture['ra']['receipt_ref']])))
    elif mode=='fresh':
        actor,_,_=t.bind();discussion,_,_=t.register(actor,1);fixture['fresh']=discussion
    else:raise ValueError('Unsupported exact mode')
t.refresh();(root/'fixture.json').write_bytes(encode(fixture));(root/(mode+'-raw.json')).write_bytes(encode(t.raw))
prepared=json.loads((t.fx.home/'.prepared'/(t.plan['root_revision_uuid']+'.json')).read_text())
result=dict(mode=mode,child=str(t.fx.home/next(x['body']['current_home'] for x in t.items if x['kind']=='ticket')/'ticket.html'),plan=str(t.fx.home/'plan.HTML'),generation=t.plan['root_revision_uuid'],
    current_phase=next(x['body']['current_workflow_node_uuid'] for x in t.items if x['kind']=='ticket'),plan_readback=t.plan,ticket_readback=t.ticket,prepared=prepared,
    plan_sha256=file_hash(t.folder/'plan.json'),view_hashes={k:file_hash(t.folder/k) for k in prepared['view_hashes']},raw_public_evidence=str(root/(mode+'-raw.json')))
(root/(mode+'-readback.json')).write_bytes(encode(result));print(json.dumps(result))
