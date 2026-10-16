"""Persistent Chrome A08 setup and actual public checkpoint operations."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_lp03_checkpoints import CheckpointsTests
from core.commands import INSTALLED
from support import Fixture,current,ref,uid,envelope,file_hash,encode
root=Path(sys.argv[1]).resolve();mode=sys.argv[2];root.mkdir(parents=True,exist_ok=True)
t=CheckpointsTests();t.raw=[]
if mode=='prepare':
    t.fx=Fixture(root);t.fx.actor['body']['granted_operations']=sorted(INSTALLED);t.fx.save(t.fx.actor);t.fx.run=t.call
    t.ok(t.fx.create('A08 Chrome checkpoint closure'));t.ok(t.call(t.fx.seed('Reviewed discussion closure')));t.refresh()
    a,_,_=t.register(t.fx.actor);t.ok(t.call(t.summary(t.fx.actor,a,'Original correction and question')))
    identity=uid();assignment=t.fx.save(envelope('assignment',{**t.fx.assignment['body'],'ticket_uuid':t.ticket['root_uuid'],'role':'launchpad','eligible_actor_uuid':identity,'report_path':str(t.fx.home/'reports'/identity)},t.fx.writer))
    body={**t.fx.actor['body'],'role':'launchpad','assignment_refs':[ref(assignment)]}
    t.ok(t.call(t.request('actor.bind',dict(body=body,binding_evidence_ref=ref(t.fx.binding),authority_ref=ref(t.fx.authority)),ticket=False)));t.refresh();peer=next(x for x in current(t.plan) if x['uuid']==identity);b,_,_=t.register(peer);t.ok(t.call(t.summary(peer,b,'Peer unresolved question')))
    child,_,_=t.bind('inline-support','child',t.fx.actor['uuid']);t.ok(t.call(t.summary(child,a,'Covered child correction and open Threads')));
    cp,_,_=t.prepare_cp(a);t.ok(t.call(t.summary(child,a,'Uncovered tail after freeze')));cp=t.apply_cp(cp)
    fixture=dict(fx={k:str(v) if isinstance(v,Path) else v for k,v in t.fx.__dict__.items() if k!='run'},a=a,b=b,peer=peer,child=child,cp=cp,phase=t.phases[0]['uuid'])
else:
    fixture=json.loads((root/'fixture.json').read_text());t.fx=Fixture.__new__(Fixture)
    for key,value in fixture['fx'].items():setattr(t.fx,key,Path(value) if key in ('root','sources','home') else value)
    t.fx.run=t.call;t.refresh()
    if mode=='close-a':
        closed,_,_=t.close_cp(fixture['cp']);fixture['closed_a']=closed
    elif mode=='close-b':
        original=t.fx.actor;t.fx.actor=fixture['peer']
        try:cp,_,_=t.prepare_cp(fixture['b'],ref(fixture['closed_a']));cp=t.apply_cp(cp)
        finally:t.fx.actor=original
        review=t.review_cp(cp);t.fx.actor=fixture['peer']
        try:t.ok(t.call(t.close_req(cp,review)))
        finally:t.fx.actor=original
    elif mode=='reopen':fixture['later'],_,_=t.register(t.fx.actor)
    elif mode=='other-phase':
        t.ok(t.call(t.summary(t.fx.actor,fixture['later'],'Latest still-open phase A')));fixture['phase_other']=t.phases[1]['uuid'];fixture['other'],_,_=t.register(t.fx.actor,1);t.ok(t.call(t.summary(t.fx.actor,fixture['other'],'Newer phase B to close')));cp,_,_=t.prepare_cp(fixture['other']);fixture['other_cp']=t.apply_cp(cp)
    elif mode=='close-other':t.close_cp(fixture['other_cp'])
    else:raise ValueError('Unsupported exact mode')
t.refresh();(root/'fixture.json').write_bytes(encode(fixture));(root/(mode+'-raw.json')).write_bytes(encode(t.raw))
prepared=json.loads((t.fx.home/'.prepared'/(t.plan['root_revision_uuid']+'.json')).read_text())
result=dict(mode=mode,child=str(t.fx.home/next(x['body']['current_home'] for x in t.items if x['kind']=='ticket')/'ticket.html'),plan=str(t.fx.home/'plan.HTML'),generation=t.plan['root_revision_uuid'],plan_readback=t.plan,ticket_readback=t.ticket,prepared=prepared,plan_sha256=file_hash(t.folder/'plan.json'),ticket_sha256=file_hash(t.folder/'tickets'/(t.ticket['root_uuid']+'.json')),view_hashes={k:file_hash(t.folder/k) for k in prepared['view_hashes']})
(root/(mode+'-readback.json')).write_bytes(encode(result));print(json.dumps(result))
