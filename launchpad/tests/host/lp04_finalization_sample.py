"""Retained A13 public fixture generator for the documented Chrome file host."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import test_lp04_finalization as final_tests
from support import file_hash, encode

root=Path(sys.argv[1]).resolve();root.mkdir(parents=True,exist_ok=True)
t=final_tests.FinalizationTests();t.initialize(root/'finalized')
candidate,_=t.accepted_candidate();discussion=t.open_discussion()
record,_=t.run_integration(candidate)
final_receipt=t.ok(t.call(t.finalize_request(record,candidate)))
t.refresh()
plan_page=t.folder/'plan.HTML';ticket_page=t.folder/'tickets'/(t.ticket['root_uuid']+'.html')
from core import integration as integration_module
projected=integration_module.finalization_projection(t.fx.root,t.plan,t.ts)[t.ticket['root_uuid']]
from core import workflow
card=workflow.projection(t.items)['card']
manifest=dict(plan_path=str(plan_page),ticket_path=str(ticket_page),generation=t.plan['root_revision_uuid'],
    plan_uuid=t.plan['root_uuid'],ticket_uuid=t.ticket['root_uuid'],plan_page_sha256=file_hash(plan_page),
    ticket_page_sha256=file_hash(ticket_page),finalization_state=projected['state'],finalization_completed=projected['completed'],
    next_mode=projected['next_mode'],card_symbol=card['icon'],card_node_uuid=card['node_uuid'],commit_sha=record['body']['commit_sha'],
    consumer_ref=record['body']['consumer_ref'],discussion_uuid=discussion['uuid'],finalization_ref=projected['finalization_ref'],
    limits='All actors/dispatch/start/acceptance/authorization/ancestry/pull facts here are explicit saved-local fixtures; no real remote Git operation ran. Real public CLI and installed-browser checks are real.')
(root/'a13-host-manifest.json').write_bytes(encode(manifest))
(root/'a13-host-public-raw.json').write_bytes(encode(t.raw))
print(json.dumps(dict(result='PASS',root=str(root),state=manifest['finalization_state'],card_symbol=manifest['card_symbol'])))
