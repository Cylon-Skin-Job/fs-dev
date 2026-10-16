"""Publish one same-ticket seed revision for the real file-host refresh check."""
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture, read_generation, current, load, ref, uid, now, file_hash

root=Path(sys.argv[1]).resolve();manifest=load(root/'sample-manifest.json')
fx=object.__new__(Fixture);fx.root=root;fx.home=root/'work-tickets/sample';fx.plan_id=manifest['plan_uuid']
fx.actor=load(root/'.evidence'/(manifest['actor_binding_ref']['revision_uuid']+'.json'))
plan,tickets,_=read_generation(fx.home);ticket=tickets[manifest['ticket_uuids'][0]]
record=next(x for x in current(ticket) if x['kind']=='ticket')
source=load(root/'.evidence'/(record['body']['seed_ref']['revision_uuid']+'.json'))
source=copy.deepcopy(source);source['revision_uuid']=uid();source['last_updated']=now();source['body']['content']+='\nManual refresh probe: updated seed.'
path=root/'sources'/(uid()+'.txt');path.write_text(source['body']['content']);source['source_refs'][0].update(locator=str(path),sha256=file_hash(path));fx.save(source)
items=[copy.deepcopy(x['body']) for x in current(ticket) if x['kind']=='source_item']
for item in items:item['source']=ref(source)
args=dict(seed_ref=ref(source),scope_items=[x for x in items if x['source_alias'].startswith('scope-')],checklist_items=[x for x in items if x['source_alias'].startswith('todo-')])
request=fx.request('ticket.seed_apply',args,uid());request['scope']['ticket_uuid']=ticket['root_uuid'];request['expected'].update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
code,result=fx.run(request)
if code:raise SystemExit(str(result))
old_pin=fx.request('record.get',{'uuid':record['uuid'],'revision_uuid':record['revision_uuid'],'fields':list(record)});old_pin['scope']['ticket_uuid']=record['uuid']
pin_code,pin_result=fx.run(old_pin)
if pin_code or pin_result['rows'][0]['fields']!=record:raise SystemExit('Original root pin not retained exactly')
_,latest_tickets,_=read_generation(fx.home);new_record=next(x for x in current(latest_tickets[record['uuid']]) if x['kind']=='ticket')
if new_record['revision_uuid']==record['revision_uuid']:raise SystemExit('Changed root reused revision UUID')
(root/'refresh-public-evidence.json').write_text(json.dumps(dict(request=request,exit=code,response=result,
   original_root=record,new_root=new_record,pinned_read_request=old_pin,pinned_read_exit=pin_code,pinned_read_response=pin_result),indent=2)+'\n')
print(json.dumps(result))
