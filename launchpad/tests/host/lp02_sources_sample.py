"""Public A05 host fixture with controlled Wiki bytes in assigned Git checkout."""
import json
import subprocess
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture,CHECKOUT,current,read_generation,uid,ref,file_hash,encode,now
from core.commands import INSTALLED,REGISTRY

# Derive the assigned/used source revision from the live checkout HEAD so the
# host fixture matches sources.py's runtime observation (HEAD-independent).
HEAD=subprocess.check_output(['git','rev-parse','HEAD'],cwd=CHECKOUT,text=True).strip()

root=Path(sys.argv[1]).resolve();mode=sys.argv[2];root.mkdir(parents=True,exist_ok=True)
if mode=='prepare':
    fx=Fixture(root);fx.sources=CHECKOUT/'launchpad/tests'/('.s2-host-'+uid());fx.sources.mkdir()
    fx.assignment['body'].update(source_checkout=str(CHECKOUT),source_branch='codex/build-workflow-and-tickets',source_head=HEAD);fx.save(fx.assignment)
    fx.actor['body']['assignment_refs']=[ref(fx.assignment)];fx.actor['body']['granted_operations']=sorted(INSTALLED);fx.save(fx.actor)
else:
    data=json.loads((root/'fixture.json').read_text());fx=Fixture.__new__(Fixture)
    for key,value in data['fixture'].items():setattr(fx,key,Path(value) if key in ('root','home','sources') else value)
raw=json.loads((root/'public.json').read_text()) if (root/'public.json').exists() else []
def run(req):
    code,response=fx.run(req);raw.append(dict(request=req,exit=code,response=response));(root/'public.json').write_bytes(encode(raw))
    if code:raise RuntimeError(response)
    return response
if mode=='prepare':run(fx.request('plan.create',dict(title='A05 actual source host',plan_folder=fx.plan_folder,tracks=fx.tracks,bootstrap_evidence_refs=[ref(fx.assignment),ref(fx.authority),ref(fx.binding)]),'plan'));run(fx.seed(scope=['A05 retained clause A','A05 retained clause B']))
def refresh():return read_generation(fx.home)
plan,tickets,folder=refresh();ticket=next(iter(tickets.values()));items=current(ticket);capture=next(x for x in items if x['kind']=='content' and x['body']['title']=='Initial Capture')
def request(op,args):
    req=fx.request('record.get',{});req.update(tool=REGISTRY[op]['tool'],operation=op,args=args,scope=dict(plan_uuid=fx.plan_id,ticket_uuid=ticket['root_uuid'],include_history=False))
    if req['tool'] in ('db.mutate','db.transaction'):
        req.update(idempotency_key=uid(),expected={x['uuid']:x['revision_uuid'] for x in current(plan)+items+[fx.authority]},expected_plan_revision_uuid=plan['root_revision_uuid'])
        if op=='transaction.apply':req['args']['expected']=req['expected']
    return req
path=fx.sources/'PAGE.md'
if mode=='prepare':
    path.write_text('---\nname: Rule\nmetadata:\n  last-modified: "2026-10-11T20:00:00Z"\n---\nOriginal controlled rule\n')
    for title in ('A05 Replacement A','A05 Replacement B'):
        run(request('record.create',dict(kind='content',body=dict(title=title,category_uuid=capture['body']['category_uuid'],format='plain',content='Pending item destination',authority='proposal',state='pending',item_uuids=[]),source_refs=[])));plan,tickets,folder=refresh();ticket=next(iter(tickets.values()));items=current(ticket)
    body=dict(target_kind='wiki_metadata',locator=str(path),source_checkout=str(CHECKOUT),source_ref=fx.assignment['body']['source_branch'],used_revision=fx.assignment['body']['source_head'],used_sha256=file_hash(path),used_stamp='2026-10-11T20:00:00Z',supported_scope=[capture['uuid']])
    run(request('record.create',dict(kind='reference',body=body,source_refs=[])));plan,tickets,folder=refresh();items=current(next(iter(tickets.values())))
    reference=next(x for x in items if x['kind']=='reference');data=dict(fixture={k:str(v) if isinstance(v,Path) else v for k,v in fx.__dict__.items()},capture_original=capture,reference_uuid=reference['uuid'],replacement_a=next(x['uuid'] for x in items if x['body'].get('title')=='A05 Replacement A'),replacement_b=next(x['uuid'] for x in items if x['body'].get('title')=='A05 Replacement B'))
    (root/'fixture.json').write_bytes(encode(data))
elif mode=='change':
    path.write_text('---\nname: Rule\nmetadata:\n  last-modified: "2026-10-11T21:00:00Z"\n---\nDeliberate changed controlled rule\n')
    run(request('record.move_category',dict(uuid=capture['uuid'],category_uuid=capture['body']['category_uuid'],reason='Publish read-only source observation with unchanged business envelope',source_refs=capture['source_refs'])))
elif mode=='reconcile':
    reference=next(x for x in items if x['uuid']==data['reference_uuid']);pin=dict(kind='source_of_truth_contract',locator=str(path),revision=fx.assignment['body']['source_head'],sha256=file_hash(path),recorded_at=now(),native_ref=None)
    ops=[dict(operation='record.update',args=dict(uuid=capture['uuid'],body={**capture['body'],'content':'Main disposition: adapted to exact current controlled rule, no approval'},source_refs=capture['source_refs']+[pin])),dict(operation='record.update',args=dict(uuid=reference['uuid'],body={**reference['body'],'used_sha256':file_hash(path),'used_stamp':'2026-10-11T21:00:00Z'},source_refs=[]))]
    run(request('transaction.apply',dict(operations=ops)))
elif mode in ('partial','full'):
    scope=capture['body']['item_uuids'][:1] if mode=='partial' else capture['body']['item_uuids'][1:]
    run(request('record.supersede',dict(old_uuid=capture['uuid'],new_uuid=data['replacement_a'] if mode=='partial' else data['replacement_b'],scope_item_uuids=scope,authority_ref=ref(fx.authority),reverse_input=mode=='full')))
elif mode!='inspect':raise ValueError(mode)
plan,tickets,folder=refresh();ticket=next(iter(tickets.values()));items=current(ticket)
proof={}
for key in ('reference_uuid','replacement_a','replacement_b'):
    proof[key]=run(request('record.get',dict(uuid=data[key],fields=['body','lifecycle'])))
proof['capture']=run(request('record.get',dict(uuid=data['capture_original']['uuid'],fields=['body','lifecycle'])))
proof['inverse']=run(request('record.related',dict(uuid=data['replacement_a'],direction='inverse',edge_kinds=['supersedes'])))
proof['query']=run(request('query.filter',dict(collection='content')))
result=dict(mode=mode,generation=plan['root_revision_uuid'],plan_sha256=file_hash(folder/'plan.json'),prepared=json.loads((fx.home/'.prepared'/(plan['root_revision_uuid']+'.json')).read_text()),capture=next(x for x in items if x['uuid']==capture['uuid']),proof=proof,child=str(fx.home/next(x for x in items if x['kind']=='ticket')['body']['current_home']/'ticket.html'))
(root/('readback-'+mode+'.json')).write_bytes(encode(result));(root/('wiki-'+mode+'.md')).write_bytes(path.read_bytes());print(json.dumps(result))
