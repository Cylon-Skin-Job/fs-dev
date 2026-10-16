"""Public literal-placeholder fixture and malformed-header publication refusal."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from support import Fixture,load,read_generation,current,uid,file_hash

fx=Fixture(sys.argv[1],'hostile');operations=[]
code,result=fx.create('Plan {{TITLE}} {{MODEL}} {{SCRIPTS}}');operations.append(dict(operation='plan.create',exit=code,response=result))
if code:raise SystemExit(str(result))
tokens='{{TITLE}} {{MODEL}} {{SCRIPTS}}'
payload='Literal '+tokens+' </script><script>globalThis.pwned=1</script> <a href="javascript:alert(1)">payload</a>'
for title,text in [('Ordinary ticket','Ordinary content'),('Ticket '+tokens,payload)]:
    request=fx.seed(title=title,content=text,scope=[text],todo=[text]);code,result=fx.run(request)
    operations.append(dict(request=request,exit=code,response=result))
    if code:raise SystemExit(str(result))
plan,tickets,_=read_generation(fx.home);rows=load(fx.root/'plans.json');chooser_hash=file_hash(fx.root/'plans.HTML')
(fx.root/'plans.json').write_text(json.dumps(rows+[dict(uuid=uid(),title='Unsafe header',current_home='javascript:alert(1)//')]))
second=Fixture(fx.root,'second');code,result=second.create('Second');assert code!=0 and not second.home.exists()
assert file_hash(fx.root/'plans.HTML')==chooser_hash and read_generation(fx.home)[0]['root_revision_uuid']==plan['root_revision_uuid']
operations.append(dict(operation='malformed-registry plan.create',exit=code,response=result))
(fx.root/'plans.json').write_text(json.dumps(rows))
children=[dict(uuid=t['root_uuid'],home=next(x for x in current(t) if x['kind']=='ticket')['body']['current_home']) for t in tickets.values()]
manifest=dict(root=str(fx.root),plan_home=str(fx.home),generation=plan['root_revision_uuid'],payload=payload,tokens=tokens,children=children,public_evidence=operations)
(fx.root/'inert-sample-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({k:v for k,v in manifest.items() if k!='public_evidence'}))
