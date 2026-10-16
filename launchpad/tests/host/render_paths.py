"""Read immutable plan and child view paths through the public interface."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture,load,read_generation

root=Path(sys.argv[1]).resolve();manifest=load(root/'sample-manifest.json')
fx=object.__new__(Fixture);fx.root=root;fx.home=root/'work-tickets/sample';fx.plan_id=manifest['plan_uuid']
fx.actor=load(root/'.evidence'/(manifest['actor_binding_ref']['revision_uuid']+'.json'))
plan,_,_=read_generation(fx.home);results=[]
for ticket_id in (None,manifest['ticket_uuids'][0]):
    args={'plan_revision_uuid':plan['root_revision_uuid']}
    if ticket_id:args['ticket_uuid']=ticket_id
    request=fx.request('view.render',args);code,result=fx.run(request)
    if code:raise SystemExit(str(result))
    results.append({'request':request,'exit':code,'response':result})
(root/'view-render-public-evidence.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps([item['response']['details']['path'] for item in results]))
