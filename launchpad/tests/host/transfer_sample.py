"""Publicly move one existing sample alias from Scope to ToDo and read both pins."""
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture,load,read_generation,current,uid

root=Path(sys.argv[1]).resolve();manifest=load(root/'sample-manifest.json')
fx=object.__new__(Fixture);fx.root=root;fx.home=root/'work-tickets/sample';fx.plan_id=manifest['plan_uuid']
fx.actor=load(root/'.evidence'/(manifest['actor_binding_ref']['revision_uuid']+'.json'))
plan,tickets,_=read_generation(fx.home);ticket=tickets[manifest['ticket_uuids'][0]]
ticket_root=next(x for x in current(ticket) if x['kind']=='ticket')
old=next(x for x in current(ticket) if x['kind']=='content' and x['body']['title']=='Scope')
args={'seed_ref':ticket_root['body']['seed_ref'],'scope_items':[],'checklist_items':[]}
for item in (x for x in current(ticket) if x['kind']=='source_item'):
    content=next(x for x in current(ticket) if x['kind']=='content' and x['body']['title'] in ('Scope','ToDo') and item['uuid'] in x['body']['item_uuids'])
    key='scope_items' if content['body']['title']=='Scope' and content['uuid']!=old['uuid'] else 'checklist_items'
    args[key].append(copy.deepcopy(item['body']))
request=fx.request('ticket.seed_apply',args,uid());request['scope']['ticket_uuid']=ticket['root_uuid']
request['expected'].update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
preview=fx.request('seed.edit_preview',dict(source_refs=[],proposed_operations=[{'operation':'ticket.seed_apply','args':args}],target_expected=request['expected'],coverage_rows=[]));preview['scope']['ticket_uuid']=ticket['root_uuid']
evidence=[]
for command in (preview,request):
    code,result=fx.run(command);evidence.append(dict(request=command,exit=code,response=result))
    if code:raise SystemExit(str(result))
mutation=result
reads=[]
for revision in (None,old['revision_uuid']):
    command=fx.request('record.get',dict(uuid=old['uuid'],fields=list(old)));command['scope']['ticket_uuid']=ticket['root_uuid']
    if revision:command['args']['revision_uuid']=revision
    code,result=fx.run(command);reads.append(dict(request=command,exit=code,response=result))
    if code:raise SystemExit(str(result))
moved=reads[0]['response']['rows'][0]['fields'];pinned=reads[1]['response']['rows'][0]['fields']
assert moved['uuid']==old['uuid'] and moved['created_at']==old['created_at'] and moved['body']['title']=='ToDo' and pinned==old
assert moved['revision_uuid']!=old['revision_uuid']
_,updated,_=read_generation(fx.home);new_root=next(x for x in current(updated[ticket['root_uuid']]) if x['kind']=='ticket')
assert any(x['entry_uuid']==moved['uuid'] and x['revision_uuid']==moved['revision_uuid'] for x in new_root['body']['record_refs'])
(root/'seed-transfer-public-evidence.json').write_text(json.dumps(dict(original=old,moved=moved,root=new_root,operations=evidence,reads=reads),indent=2)+'\n')
print(json.dumps(dict(content_uuid=old['uuid'],ticket_home=ticket_root['body']['current_home'],before_generation=plan['root_revision_uuid'],generation=mutation['captured_plan_revision_uuid'])))
