"""Controlled A04 host fixture; every product mutation goes through public CLI."""
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture,current,read_generation,uid,ref,file_hash,encode
from core.commands import INSTALLED,REGISTRY

root=Path(sys.argv[1]).resolve();mode=sys.argv[2]
if mode=='prepare':
    fx=Fixture(root);fx.actor['body']['granted_operations']+=list(INSTALLED-set(fx.actor['body']['granted_operations']));fx.save(fx.actor)
else:
    data=json.loads((root/'host-fixture.json').read_text());fx=Fixture.__new__(Fixture)
    for key,value in data['fixture'].items():setattr(fx,key,Path(value) if key in ('root','home','sources') else value)
raw=json.loads((root/'public-evidence.json').read_text()) if (root/'public-evidence.json').exists() else []
def run(request):
    code,response=fx.run(request);raw.append(dict(request=request,exit=code,response=response));(root/'public-evidence.json').write_bytes(encode(raw))
    if code:raise RuntimeError(response)
    return response
if mode=='prepare':run(fx.request('plan.create',dict(title='A04 controlled host',plan_folder=fx.plan_folder,tracks=fx.tracks,bootstrap_evidence_refs=[ref(fx.assignment),ref(fx.authority),ref(fx.binding)]),'host-plan'));run(fx.seed(content='Retained source item and source pins'))
plan,tickets,folder=read_generation(fx.home);ticket=next(iter(tickets.values()));items=current(ticket);capture=next(x for x in items if x['kind']=='content' and x['body']['title']=='Initial Capture')
def request(op,args):
    req=fx.request('record.get',{});req.update(tool=REGISTRY[op]['tool'],operation=op,args=args,scope=dict(plan_uuid=fx.plan_id,ticket_uuid=ticket['root_uuid'],include_history=False))
    if req['tool'] in ('db.mutate','db.transaction'):req.update(idempotency_key=uid(),expected={x['uuid']:x['revision_uuid'] for x in current(plan)+items+[fx.authority]},expected_plan_revision_uuid=plan['root_revision_uuid'])
    return req
if mode=='prepare':
    original=dict(kind='content',body=dict(title='A04 disposable draft',category_uuid=capture['body']['category_uuid'],format='json',content={'nested':{'retain':['bytes',True]},'unsafe':'<script>globalThis.LP_A04_UNSAFE=true</script>','supporting_path':'javascript:alert(1)'},authority='proposal',state='pending',item_uuids=[]),source_refs=[],extensions={'source.preserved':{'routing_extra':{'retained':['nested',42]}}})
    run(request('record.create',original));plan,tickets,folder=read_generation(fx.home);ticket=next(iter(tickets.values()));items=current(ticket)
    draft=next(x for x in items if x['body'].get('title')=='A04 disposable draft');fixture={k:str(v) if isinstance(v,Path) else v for k,v in fx.__dict__.items()}
    data=dict(fixture=fixture,draft_uuid=draft['uuid'],draft_original=draft,category_uuid=draft['body']['category_uuid'],ticket_uuid=ticket['root_uuid'],capture_original=capture)
    (root/'host-fixture.json').write_bytes(encode(data))
else:
    draft=next(x for x in items if x['uuid']==data['draft_uuid'])
    if mode in ('delete','restore','archive'):
        run(request('record.'+mode,dict(uuid=draft['uuid'],reason='Actual controlled Chrome lifecycle proof',source_refs=draft['source_refs'],authority_ref=ref(fx.authority))))
    elif mode=='route':
        category=next(x for x in items if x['kind']=='category' and x['body']['category_key']=='issues')
        args=dict(uuid=capture['uuid'],category_uuid=category['uuid'],reason='Source-backed metadata route in Chrome fixture',source_refs=capture['source_refs'])
        req=request('record.move_category',args);preview=request('intake.route_preview',dict(source_refs=capture['source_refs'],proposed_operations=[dict(operation='record.move_category',args=args)],target_expected=req['expected'],coverage_rows=[]));p=run(preview)
        run(request('intake.route',dict(preview_digest=p['preview_digest'],operations=preview['args']['proposed_operations'],coverage_rows=[],authority_refs=[ref(fx.authority)])))
    elif mode=='inspect':
        for original in (data['draft_original'],data['capture_original']):
            run(request('record.get',dict(uuid=original['uuid'],fields=list(original))));run(request('record.get',dict(uuid=original['uuid'],revision_uuid=original['revision_uuid'],fields=list(original))))
        run(request('query.filter',dict(collection='content')));run(request('record.exists',dict(uuid=data['draft_uuid'])))
    else:raise ValueError(mode)
plan,tickets,folder=read_generation(fx.home);ticket=tickets[data['ticket_uuid']];prepared=json.loads((fx.home/'.prepared'/(plan['root_revision_uuid']+'.json')).read_text())
result=dict(mode=mode,generation=plan['root_revision_uuid'],plan_sha256=file_hash(folder/'plan.json'),ticket_sha256=file_hash(folder/'tickets'/(ticket['root_uuid']+'.json')),prepared=prepared,draft=next(x for x in current(ticket) if x['uuid']==data['draft_uuid']),capture=next(x for x in current(ticket) if x['uuid']==capture['uuid']),child=str(fx.home/next(x for x in current(ticket) if x['kind']=='ticket')['body']['current_home']/'ticket.html'))
(root/('readback-'+mode+'.json')).write_bytes(encode(result));print(json.dumps(result))
