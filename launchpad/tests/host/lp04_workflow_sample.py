"""Retained A12 public fixture generator for the documented Chrome file host."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import test_lp04_workflow as workflow_tests
from support import Fixture, current, ref, encode, file_hash
from core.commands import INSTALLED
from core.store import digest

root=Path(sys.argv[1]).resolve();t=workflow_tests.WorkflowTests();t.tmp=None;t.fx=Fixture(root);t.raw=[]
t.fx.actor['body']['granted_operations']=sorted(INSTALLED);t.fx.save(t.fx.actor);t.fx.run=t.call
t.ok(t.fx.create('A12 saved-local workflow/prompt fixture'));t.ok(t.call(t.fx.seed()));t.refresh()

# A real bounded workflow edit so the view carries retained history and card state.
node=t.node('Shape');op=t.move_op(node,description='Captured A12 edit')
preview=t.ok(t.call(t.preview([op])));t.ok(t.call(t.apply(preview['preview_digest'],[op])))
# A prompt flow so supplied and acknowledged evidence are both present and distinct.
job,actor,binding,attempt=t.ready();t.ok(t.call(t.start_request(job,actor,attempt)))
t.refresh()
spec=t.approve_spec()
checklist_cat=next(c['uuid'] for c in t.items if c['kind']=='category' and c['body']['category_key']=='checklist')
content=next(x for x in t.items if x['kind']=='content' and x['body']['category_uuid']==checklist_cat)
reference=dict(target_kind='plan_entry',locator=spec['uuid'],source_checkout=None,source_ref=None,
               used_revision=spec['revision_uuid'],used_sha256=digest(spec),used_stamp=spec['last_updated'],supported_scope=[content['uuid']])
roc=dict(operation='record.create',args=dict(kind='reference',body=reference,source_refs=[]))
pin=dict(kind='owner_decision',locator=spec['uuid'],revision=spec['revision_uuid'],sha256=digest(spec),recorded_at=spec['last_updated'],native_ref=None)
cp=t.ok(t.call(t.checklist_preview([roc],[pin])))
t.ok(t.call(t.request('checklist.reconcile_apply',dict(preview_digest=cp['preview_digest'],operations=[roc],coverage_rows=[],authority_refs=[ref(t.fx.authority)]))))
t.refresh()

projection=workflow_tests.workflow.projection(t.items)
child=t.folder/'tickets'/(t.ticket['root_uuid']+'.html')
gates=[x for x in t.items if x['kind']=='workflow_node' and x['body']['node_kind']=='owner_gate']
manifest=dict(plan_path=str(t.folder/'plan.HTML'),ticket_path=str(child),generation=t.plan['root_revision_uuid'],
    plan_uuid=t.plan['root_uuid'],ticket_uuid=t.ticket['root_uuid'],ticket_page_sha256=file_hash(child),
    card_symbol=projection['card']['icon'],card_node_uuid=projection['card']['node_uuid'],card_node_kind=projection['card']['node_kind'],
    stage_count=len(projection['top_level']),top_titles=[x['body']['title'] for x in t.items if x['kind']=='workflow_node' and x['body']['parent_uuid'] is None],
    job_uuid=job['uuid'],node_uuid=job['body']['node_uuid'],nested_gate_uuid=gates[0]['uuid'],
    checklist_item_count=t.ok(t.call(t.request('checklist.current',{'uuid':t.ticket['root_uuid']})))['details']['item_count'],
    limits='All identities/dispatch/start envelopes here are explicitly saved-local fixtures, not actual native lifecycle evidence.')
(root/'a12-host-manifest.json').write_bytes(encode(manifest))
(root/'a12-host-public-raw.json').write_bytes(encode(t.raw))
print(json.dumps(dict(result='PASS',root=str(root),card_symbol=manifest['card_symbol'],stage_count=manifest['stage_count'])))
