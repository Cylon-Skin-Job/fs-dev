"""Mint a labeled 32-record source sample through the public subprocess only."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture, ref, load, file_hash, read_generation, current

parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);parser.add_argument('--source',required=True)
args=parser.parse_args();source=Path(args.source).resolve();board=load(source)
if len(board['projects'])!=32:raise SystemExit('Source population changed; never invent coverage')
fx=Fixture(args.root);code,result=fx.create();evidence=[dict(request='plan.create',exit=code,response=result)]
if code:raise SystemExit(str(result))
orders=board['catalog']['order']
for ordinal,source_id in enumerate(orders):
    item=board['projects'][source_id]
    track=ordinal%4;position='track';slot=None
    if source_id in board['layout']['opening']:position='opening';slot=board['layout']['opening'].index(source_id)
    elif source_id in board['layout']['closing']:position='convergence';slot=board['layout']['closing'].index(source_id)
    request=fx.seed(title=item['title'],content=item.get('body',''),scope=[item.get('body','') or item['title']],todo=item.get('checklist') or ['Discuss initial source'],track=track)
    seed=load(fx.root/'.evidence'/(request['args']['seed_ref']['revision_uuid']+'.json'))
    seed['extensions']={'source.preserved':{'source_board_locator':str(source),'source_board_sha256':file_hash(source),'source_record_id':source_id,
                       'presentation':{'position':position,**({'slot':slot} if slot is not None else {})}}}
    fx.save(seed);request['args']['seed_ref']=ref(seed)
    for key in ['scope_items','checklist_items']:
        for scope in request['args'][key]:scope['source']=ref(seed)
    code,result=fx.run(request);evidence.append(dict(request=request,exit=code,response=result))
    if code:raise SystemExit(str(result))
plan,tickets,folder=read_generation(fx.home)
manifest=dict(source=str(source),source_sha256=file_hash(source),source_population=32,label='32-record source/sample; provisional track assignment; no38 claim',
              root=str(fx.root),plan_uuid=fx.plan_id,generation=plan['root_revision_uuid'],plan_file_sha256=file_hash(folder/'plan.json'),
              plan_view_sha256=file_hash(folder/'plan.HTML'),actor_binding_ref=ref(fx.actor),ticket_uuids=list(tickets),public_evidence=evidence)
(fx.root/'sample-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:v for k,v in manifest.items() if k!='public_evidence'}))
