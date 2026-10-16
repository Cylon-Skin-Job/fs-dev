"""Retained A10 public fixture generator for the documented Chrome file host."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import test_lp04_claims as claims
from support import Fixture, CHECKOUT, current, ref, uid, encode
from core.commands import INSTALLED

root=Path(sys.argv[1]).resolve();t=claims.ClaimsTests();t.fx=Fixture(root);t.raw=[]
t.fx.actor['body']['granted_operations']=sorted(INSTALLED);t.fx.save(t.fx.actor);t.fx.run=t.call
t.ok(t.fx.create('A10 saved-local claim/start fixture'));t.ok(t.call(t.fx.seed()));t.refresh();stages=[]

def capture(label,job,attempt=None):
 t.refresh();child=t.folder/'tickets'/(t.ticket['root_uuid']+'.html');stages.append(dict(label=label,path=str(child),generation=t.plan['root_revision_uuid'],job_uuid=job['uuid'],attempt_uuid=attempt['uuid'] if attempt else None))

job,actor,binding,attempt=t.ready();capture('claimed',job,attempt)
t.ok(t.call(t.start_request(job,actor,attempt)));attempt=t.attempt(attempt['uuid']);capture('running',job,attempt)
failed,_=t.publish(1);failed_actor,_=t.bind(failed);t.dispatch(failed,failed_actor,'failed');capture('failed-dispatch',failed)
new,new_binding=t.bind(job);t.dispatch(job,new);proof=t.runtime('inactive',job,actor,attempt,manager_uuid=t.fx.actor['uuid'],inactive=True)
t.ok(t.call(t.request('assignment.handoff',dict(assignment_ref=ref(job),actor_uuid=new['uuid'],inactive_or_interrupt_ack_ref=ref(proof),predecessor_attempt_ref=ref(attempt)))))
t.refresh();replacement=next(x for x in t.items if x['kind']=='attempt' and x['body']['predecessor_attempt_uuid']==attempt['uuid']);capture('replacement-claimed',job,replacement)
t.ok(t.call(t.start_request(job,new,replacement)));replacement=t.attempt(replacement['uuid']);capture('replacement-running',job,replacement)
(root/'a10-host-manifest.json').write_bytes(encode(dict(stages=stages,plan_uuid=t.plan['root_uuid'],ticket_uuid=t.ticket['root_uuid'],limits='All identities/start envelopes here are explicitly saved-local fixtures, not actual native lifecycle evidence.')))
(root/'a10-host-public-raw.json').write_bytes(encode(t.raw));print(json.dumps(dict(result='PASS',stages=stages,root=str(root))))
