"""Public seed update for explicitly synthetic restore stress content; no deletion."""
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture, read_generation, current, load, ref, uid, now, file_hash
root=Path(sys.argv[1]).resolve();mode=sys.argv[2];manifest=load(root/'sample-manifest.json')
fx=object.__new__(Fixture);fx.root=root;fx.home=root/'work-tickets/sample';fx.plan_id=manifest['plan_uuid']
fx.actor=load(root/'.evidence'/(manifest['actor_binding_ref']['revision_uuid']+'.json'))
plan,tickets,_=read_generation(fx.home);ticket=tickets[manifest['ticket_uuids'][0]]
record=next(x for x in current(ticket) if x['kind']=='ticket')
source=copy.deepcopy(load(root/'.evidence'/(record['body']['seed_ref']['revision_uuid']+'.json')))
source['revision_uuid']=uid();source['last_updated']=now()
source['body']['content']='Restore stress fixture '+mode+'\n'+('\n'.join('Synthetic scroll line '+str(i) for i in range(100)))+'\n<script>globalThis.LP_UNSAFE=true</script>\nSupporting path: javascript:alert(1) /tmp/<unsafe>.json'
path=root/'sources'/(uid()+'.txt');path.write_text(source['body']['content']);source['source_refs'][0].update(locator=str(path),sha256=file_hash(path));fx.save(source)
items=[copy.deepcopy(x['body']) for x in current(ticket) if x['kind']=='source_item']
for item in items:item['source']=ref(source)
args=dict(seed_ref=ref(source),scope_items=[x for x in items if x['source_alias'].startswith('scope-')],checklist_items=[x for x in items if x['source_alias'].startswith('todo-')])
if mode=='advance' and not any(x['source_alias']=='todo-restore-new' for x in args['checklist_items']):args['checklist_items'].append(dict(source=ref(source),text='New restore-default fixture node',source_alias='todo-restore-new'))
request=fx.request('ticket.seed_apply',args,uid());request['scope']['ticket_uuid']=ticket['root_uuid'];request['expected'].update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
code,response=fx.run(request)
if code:raise SystemExit(str(response))
plan,tickets,_=read_generation(fx.home)
(root/('restore-'+mode+'-public-evidence.json')).write_text(json.dumps(dict(request=request,exit=code,response=response),indent=2)+'\n')
print(json.dumps(dict(generation=plan['root_revision_uuid'],response=response)))
