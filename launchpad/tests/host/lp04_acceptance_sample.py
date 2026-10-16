"""A11 retained canonical public fixture; all runtime/owner proofs are fixtures."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_lp04_acceptance import AcceptanceTests
from support import encode,ref,file_hash
from core import acceptance

root=Path(sys.argv[1]).resolve();root.mkdir(parents=True,exist_ok=True);stages=[]

def setup(folder):
 t=AcceptanceTests();t.initialize(root/folder);return t

def capture(t,label,job,attempt,icon,owner=None,owner_icon=None):
 t.refresh();page=t.folder/'tickets'/(t.ticket['root_uuid']+'.html')
 stages.append(dict(label=label,path=str(page),generation=t.plan['root_revision_uuid'],page_sha256=file_hash(page),job_uuid=job['uuid'],attempt_uuid=attempt['uuid'],icon=icon,owner_uuid=owner['uuid'] if owner else None,owner_icon=owner_icon))

t=setup('continuing');job,actor,attempt,outputs=t.returned();pins=t.scope(attempt);capture(t,'returned',job,attempt,'output_circle')
gates=t.two_gates(pins,2);capture(t,'passed-unaccepted',job,attempt,'output_circle')
receipt=t.ok(t.call(t.accept_request(pins,gates)));t.refresh();accepted=next(x for x in t.items if x['kind']=='acceptance' and ref(x) in receipt['changed_refs']);capture(t,'accepted-without-next',job,attempt,'output_circle')
following,_=t.publish(1,prerequisite_refs=[ref(accepted)]);next_actor,binding=t.bind(following);t.dispatch(following,next_actor,'failed');capture(t,'failed-next',job,attempt,'output_circle')
t.dispatch(following,next_actor);claimed,_,_=t.claim(following,next_actor,binding);capture(t,'claimed-next',job,attempt,'output_circle')
t.ok(t.call(t.start_request(following,next_actor,claimed)));capture(t,'acknowledged-next',job,attempt,'check_circle')
(root/'continuing-public-raw.json').write_bytes(encode(t.retain(None)))
u=setup('terminal');final,actor,attempt,outputs=u.returned(-1);pins=u.scope(attempt);capture(u,'terminal-returned',final,attempt,'output_circle')
gates=u.two_gates(pins,0);u.ok(u.call(u.accept_request(pins,gates)));u.refresh();owner=next(x for x in u.items if x['kind']=='workflow_node' and x['body']['title']=='Merge Review');capture(u,'terminal-accepted-owner-pending',final,attempt,'check_circle',owner,'back_hand')
gates=u.two_gates([ref(owner)],2);u.ok(u.call(u.accept_request([ref(owner)],gates,owner=True)));capture(u,'separate-owner-accepted',final,attempt,'check_circle',owner,'check_circle')
(root/'terminal-public-raw.json').write_bytes(encode(u.retain(None)))
(root/'a11-host-manifest.json').write_bytes(encode(dict(stages=stages,limits='All actors/dispatch/start/acceptance instructions are explicit trusted-local fixtures. These real public CLI and installed browser checks do not claim actual native or human owner acceptance. Terminal fixture uses last existing autonomous sibling; A12 owns new nested workflow structure.')))
print(json.dumps(dict(result='PASS',root=str(root),stages=stages)))
