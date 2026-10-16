"""Public identical-seed receipt commit with exact filesystem/business readback."""
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture,load,read_generation,current,uid,file_hash,ref

root=Path(sys.argv[1]).resolve();manifest=load(root/'sample-manifest.json')
fx=object.__new__(Fixture);fx.root=root;fx.home=root/'work-tickets/sample';fx.plan_id=manifest['plan_uuid']
fx.actor=load(root/'.evidence'/(manifest['actor_binding_ref']['revision_uuid']+'.json'))
plan,tickets,_=read_generation(fx.home);ticket=tickets[manifest['ticket_uuids'][0]]
record=next(x for x in current(ticket) if x['kind']=='ticket')
business=next(x for x in current(plan) if x['kind']=='plan')
binding=next(x for x in business['body']['ticket_bindings'] if x['ticket_uuid']==record['uuid'])
payload=fx.home/binding['relative_path'];original_bytes=payload.read_bytes();original_hash=file_hash(payload)
physical_before=sorted(str(x.relative_to(fx.home)) for x in payload.parent.parent.rglob('ticket.json'))
args={'seed_ref':record['body']['seed_ref'],'scope_items':[],'checklist_items':[]}
for item in (x for x in current(ticket) if x['kind']=='source_item'):
    content=next(x for x in current(ticket) if x['kind']=='content' and x['body']['title'] in ('Scope','ToDo') and item['uuid'] in x['body']['item_uuids'])
    args['scope_items' if content['body']['title']=='Scope' else 'checklist_items'].append(copy.deepcopy(item['body']))
request=fx.request('ticket.seed_apply',args,uid());request['scope']['ticket_uuid']=record['uuid']
request['expected'].update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
code,result=fx.run(request);assert code==0,result
new_plan,new_tickets,_=read_generation(fx.home)
assert new_tickets[record['uuid']]==ticket
assert next(x for x in current(new_plan) if x['kind']=='plan')==business
assert [x for x in current(new_plan) if x['kind']!='receipt']==[x for x in current(plan) if x['kind']!='receipt']
assert payload.read_bytes()==original_bytes and file_hash(payload)==original_hash
assert (fx.home/binding['current_home']/'ticket.json').resolve()==payload
assert sorted(str(x.relative_to(fx.home)) for x in payload.parent.parent.rglob('ticket.json'))==physical_before
assert result['changed_refs']==[] and result['changed_fields']==[] and result['commit_state']=='committed'
assert new_plan['root_revision_uuid']!=plan['root_revision_uuid'] and new_plan['commit_seq']==plan['commit_seq']+1
receipt=next(x for x in current(new_plan) if ref(x)==result['receipt_ref'])
assert receipt['body']['old_generation']==plan['root_revision_uuid'] and receipt['body']['new_generation']==new_plan['root_revision_uuid']
assert result['receipt_ref'] in new_plan['idempotency_receipt_refs']
replay_code,replayed=fx.run(request);assert replay_code==0 and replayed==result
assert read_generation(fx.home)[0]==new_plan
reads=[]
for revision in (None,record['revision_uuid']):
    command=fx.request('record.get',{'uuid':record['uuid'],'fields':list(record)});command['scope']['ticket_uuid']=record['uuid']
    if revision:command['args']['revision_uuid']=revision
    read_code,response=fx.run(command);assert read_code==0 and response['rows'][0]['fields']==record
    reads.append(dict(request=command,exit=read_code,response=response))
evidence=dict(request=request,exit=code,response=result,replay_exit=replay_code,replay_response=replayed,
    original_plan_business=business,current_plan_business=next(x for x in current(new_plan) if x['kind']=='plan'),
    original_binding=binding,original_ticket_snapshot=ticket,current_ticket_snapshot=new_tickets[record['uuid']],
    payload_path=str(payload),payload_sha256=original_hash,physical_payload_paths=physical_before,receipt=receipt,reads=reads)
(root/'noop-public-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(dict(ticket_home=binding['current_home'],before_generation=plan['root_revision_uuid'],generation=new_plan['root_revision_uuid'],receipt_ref=result['receipt_ref'],payload_sha256=original_hash)))
