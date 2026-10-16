"""Persist a disposable A09 Chrome fixture through actual public CLI operations."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_lp03_state import StateTests
from core.commands import INSTALLED
from support import Fixture,current,ref,file_hash,encode
root=Path(sys.argv[1]).resolve();mode=sys.argv[2];root.mkdir(parents=True,exist_ok=True);t=StateTests();t.raw=[]
if mode=='prepare':
    t.fx=Fixture(root);t.fx.actor['body']['granted_operations']=sorted(INSTALLED);t.fx.save(t.fx.actor);t.fx.run=t.call
    t.ok(t.fx.create('A09 scoped state and reviewed support'));t.ok(t.call(t.fx.seed('Concurrent source state')));t.refresh();discussion,_,_=t.register(t.fx.actor);t.ok(t.call(t.summary(t.fx.actor,discussion,'Main original focus')))
    child,assignment=t.bind('inline-support','child',t.fx.actor['uuid']);baseline=t.ok(t.call(t.check()))
    fixture=dict(fx={k:str(v) if isinstance(v,Path) else v for k,v in t.fx.__dict__.items() if k!='run'},discussion=discussion,child=child,baseline=baseline)
else:
    fixture=json.loads((root/'fixture.json').read_text());t.fx=Fixture.__new__(Fixture)
    for key,value in fixture['fx'].items():setattr(t.fx,key,Path(value) if key in ('root','sources','home') else value)
    t.fx.run=t.call;t.refresh()
    if mode=='self':
        t.ok(t.call(t.summary(t.fx.actor,fixture['discussion'],'Main self-only saved focus')));fixture['self_check']=t.ok(t.call(t.check()));assert not fixture['self_check']['added_refs'] and not fixture['self_check']['changed_refs']
    elif mode=='child':
        t.ok(t.call(t.summary(fixture['child'],fixture['discussion'],'Actual child contribution with parent attribution')))
        main,child,assignment,target,report,args=t.support_packet();fixture.update(support_child=child,support_assignment=assignment,target=target,report=report,submit_args=args)
        fixture['ready']=t.ok(t.call(t.request('support.report_submit',args,child)));fixture['child_check']=t.ok(t.call(t.check()))
    elif mode=='integrate':
        _,gate,raw,integrate=t.reviewed(t.fx.actor,fixture['support_assignment'],fixture['target'],fixture['report'],fixture['submit_args'])
        fixture['integrated']=t.ok(t.call(t.request('support.integrate',integrate)));t.ok(t.call(t.summary(t.fx.actor,fixture['discussion'],'Reviewed main integration saved',recorded=[fixture['integrated']['receipt_ref']])));fixture['post_check']=t.ok(t.call(t.check()))
    else:raise ValueError(mode)
t.refresh();(root/'fixture.json').write_bytes(encode(fixture));(root/(mode+'-raw.json')).write_bytes(encode(t.raw));prepared=json.loads((t.fx.home/'.prepared'/(t.plan['root_revision_uuid']+'.json')).read_text())
result=dict(mode=mode,child=str(t.fx.home/next(x['body']['current_home'] for x in t.items if x['kind']=='ticket')/'ticket.html'),plan=str(t.fx.home/'plan.HTML'),generation=t.plan['root_revision_uuid'],plan_readback=t.plan,ticket_readback=t.ticket,prepared=prepared,plan_sha256=file_hash(t.folder/'plan.json'),ticket_sha256=file_hash(t.folder/'tickets'/(t.ticket['root_uuid']+'.json')),view_hashes={k:file_hash(t.folder/k) for k in prepared['view_hashes']})
(root/(mode+'-readback.json')).write_bytes(encode(result));print(json.dumps(result))
