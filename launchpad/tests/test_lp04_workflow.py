"""A12 public workflow/checklist/prompt reconciliation without losing history."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
import test_lp04_acceptance as acceptance_tests
from support import current, ref, uid, file_hash
from core.store import digest
from core.commands import INSTALLED
from core import workflow

TITLES=['Ticket Created','Intake Capture','Shape','Readiness Check','Build Research Supervisor','Issues',
        'Approvals','First Draft Supervisor','Draft Review','Draft Approval','Roadmap Creator','Pre-Flight Check',
        'Roadmap Supervisor','Roadmap Acceptance','Merge Supervisor','Merge Review','Commit']


class WorkflowTests(unittest.TestCase):
    for _name in ('ok','refresh','request','saved','publish','runtime','dispatch','claim_request','claim',
                  'start_request','attempt','refuse','ready'):
        locals()[_name]=getattr(acceptance_tests.claims.ClaimsTests,_name)
    for _name in ('call','bind','retain','return_run','returned','scope','prepare_evaluation','evaluate',
                  'accept_request','two_gates','project','bind_runtime','evaluation_ready','evaluation_job'):
        locals()[_name]=getattr(acceptance_tests.AcceptanceTests,_name)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.fx=acceptance_tests.claims.Fixture(self.tmp.name);self.raw=[]
        self.fx.actor['body']['granted_operations']=sorted(INSTALLED);self.fx.save(self.fx.actor)
        self.fx.run=self.call;self.ok(self.fx.create('A12 disposable trusted-local source/structure fixture'))
        self.ok(self.call(self.fx.seed()));self.refresh()

    def expected_map(self):
        expected={x['uuid']:x['revision_uuid'] for x in current(self.plan)+self.items}
        for p in (self.fx.root/'.evidence').glob('*.json'):
            e=json.loads(p.read_text());expected.setdefault(e['uuid'],e['revision_uuid'])
        return expected

    def op_pins(self,ops):
        pins=[]
        for sub in ops:
            for pin in sub['args'].get('source_refs',[]):
                if pin not in pins:pins.append(pin)
        return pins

    def preview(self,ops,source_refs=None,coverage_rows=None):
        pins=self.op_pins(ops) if source_refs is None else source_refs
        args=dict(source_refs=pins,proposed_operations=ops,target_expected=self.expected_map(),coverage_rows=coverage_rows or [])
        return self.request('workflow.edit_preview',args)

    def checklist_preview(self,ops,source_refs,coverage_rows=None):
        args=dict(source_refs=source_refs,proposed_operations=ops,target_expected=self.expected_map(),coverage_rows=coverage_rows or [])
        return self.request('checklist.reconcile_preview',args)

    def apply(self,digest_value,ops,coverage_rows=None,authority_refs=None,key=None):
        args=dict(preview_digest=digest_value,operations=ops,coverage_rows=coverage_rows or [],
                  authority_refs=authority_refs or [ref(self.fx.authority)])
        return self.request('workflow.edit_apply',args,key=key or uid())

    def node(self,title):
        self.refresh();return next(x for x in self.items if x['kind']=='workflow_node' and x['body']['title']==title)

    def move_op(self,node,parent_uuid=None,order=None,description=None,title=None):
        body={**node['body'],'parent_uuid':parent_uuid if parent_uuid is not None else node['body']['parent_uuid'],
              'order':order if order is not None else node['body']['order']}
        if description is not None:body['description']=description
        if title is not None:body['title']=title
        return dict(operation='record.update',args=dict(uuid=node['uuid'],body=body,source_refs=list(node['source_refs'])))

    # ---- definition read model -------------------------------------------------
    def test_outline_honors_exact_seventeen_stage_sequence_and_kinds(self):
        details=self.ok(self.call(self.request('workflow.outline',{})))['details']
        self.assertEqual([x['title'] for x in details['outline']],TITLES);self.assertEqual(details['stage_count'],17)
        kinds={x['title']:x['node_kind'] for x in details['outline']}
        self.assertEqual(kinds['Approvals'],'owner_gate');self.assertEqual(kinds['Commit'],'owner_gate')
        self.assertEqual(kinds['Build Research Supervisor'],'autonomous');self.assertEqual(kinds['Shape'],'conversation')
        self.assertEqual({x['title'] for x in details['outline'] if x['gate_kind']=='owner'},
                         {'Approvals','Draft Approval','Roadmap Acceptance','Merge Review','Commit'})

    def test_reads_children_ancestors_dependencies_gates_and_node_get(self):
        readiness=self.node('Readiness Check')
        child=self.ok(self.call(self.request('workflow.children',{'uuid':readiness['uuid']})))['details']['children']
        self.assertIn('Report Review',[x['title'] for x in child])
        self.refresh();review=next(x for x in self.items if x['kind']=='workflow_node' and x['body']['title']=='Report Review' and x['body']['parent_uuid']==readiness['uuid'])
        anc=self.ok(self.call(self.request('workflow.ancestors',{'uuid':review['uuid']})))['details']['ancestors']
        self.assertEqual([x['title'] for x in anc],['Readiness Check'])
        single=self.ok(self.call(self.request('workflow.node_get',{'uuid':review['uuid']})))['details']
        self.assertEqual(single['ancestors'],[readiness['uuid']]);self.assertEqual(single['selector'],'current')
        gates=self.ok(self.call(self.request('workflow.gates',{'uuid':self.node('Approvals')['uuid']})))['details']['gates']
        self.assertIn(self.node('Approvals')['uuid'],gates)

    # ---- acyclic, stable edits -------------------------------------------------
    def test_move_keeps_stable_id_history_and_order(self):
        intake=self.node('Intake Capture');shape=self.node('Shape');original=copy.deepcopy(intake)
        op=self.move_op(intake,parent_uuid=shape['uuid'],order=0)
        preview=self.ok(self.call(self.preview([op])));self.ok(self.call(self.apply(preview['preview_digest'],[op])))
        self.refresh();moved=next(x for x in self.items if x['uuid']==intake['uuid'])
        self.assertEqual(moved['uuid'],original['uuid']);self.assertEqual(moved['created_at'],original['created_at'])
        self.assertEqual(moved['body']['parent_uuid'],shape['uuid']);self.assertNotEqual(moved['revision_uuid'],original['revision_uuid'])
        retained=[x for x in self.ticket['revisions'] if x['uuid']==intake['uuid'] and x['revision_uuid']==original['revision_uuid']]
        self.assertEqual(retained,[original])

    def test_acyclic_hierarchy_and_dependency_cycle_refusals_no_mutation(self):
        a=self.node('Intake Capture');b=self.node('Shape')
        op=self.move_op(a,parent_uuid=b['uuid'],order=0)
        preview=self.ok(self.call(self.preview([op])));self.ok(self.call(self.apply(preview['preview_digest'],[op])))
        self.refresh();a2=next(x for x in self.items if x['uuid']==a['uuid']);b2=next(x for x in self.items if x['uuid']==b['uuid'])
        self.refuse(self.preview([self.move_op(b2,parent_uuid=a2['uuid'],order=0)]),'INVALID_SCHEMA')
        edge=dict(operation='record.create',args=dict(kind='edge',body=dict(edge_kind='dependency',from_uuid=a2['uuid'],to_uuid=b2['uuid'],
              from_revision_uuid=a2['revision_uuid'],to_revision_uuid=b2['revision_uuid'],scope_item_uuids=[],authority_ref=ref(self.fx.authority)),source_refs=[]))
        preview=self.ok(self.call(self.preview([edge])));self.ok(self.call(self.apply(preview['preview_digest'],[edge])))
        self.refresh();a3=next(x for x in self.items if x['uuid']==a['uuid']);b3=next(x for x in self.items if x['uuid']==b['uuid'])
        reverse=dict(operation='record.create',args=dict(kind='edge',body=dict(edge_kind='dependency',from_uuid=b3['uuid'],to_uuid=a3['uuid'],
              from_revision_uuid=b3['revision_uuid'],to_revision_uuid=a3['revision_uuid'],scope_item_uuids=[],authority_ref=ref(self.fx.authority)),source_refs=[]))
        self.refuse(self.preview([reverse]),'INVALID_SCHEMA')
        self.refresh();self.assertEqual(len([x for x in self.items if x['kind']=='edge' and x['body']['edge_kind']=='dependency']),1)

    def test_active_assignment_cannot_be_silently_repointed(self):
        job,actor,binding,attempt=self.ready();self.ok(self.call(self.start_request(job,actor,attempt)))
        self.refresh();node=next(x for x in self.items if x['uuid']==job['body']['node_uuid'])
        self.refuse(self.preview([self.move_op(node,order=node['body']['order']+1)]),'INVALID_TRANSITION')

    def test_published_job_cannot_silently_start_against_edited_definition(self):
        job,_=self.publish()
        self.refresh();node=next(x for x in self.items if x['uuid']==job['body']['node_uuid'])
        op=self.move_op(node,description='edited with no active attempt')
        preview=self.ok(self.call(self.preview([op])));self.ok(self.call(self.apply(preview['preview_digest'],[op])))
        self.refresh();self.assertEqual(next(x for x in self.items if x['uuid']==job['uuid']),job)
        # The immutable job still pins the retained old node revision; binding it
        # against the changed current definition is refused, never silently repointed.
        identity=uid();data=dict(actual_cwd=str(acceptance_tests.CHECKOUT),permissions='danger-full-access',runtime_kind='child',
            runtime_id='fixture:'+identity,parent_actor_uuid=self.fx.actor['uuid'],source_checkout=job['body']['source_checkout'],
            source_branch=job['body']['source_branch'],source_head=job['body']['source_head'],provenance='trusted-local-fixture')
        proof=self.saved(data)
        body=dict(role=job['body']['role'],runtime_kind='child',runtime_id=data['runtime_id'],host_id=None,parent_actor_uuid=self.fx.actor['uuid'],
                  actual_cwd=str(acceptance_tests.CHECKOUT),binding_evidence_ref=ref(proof),assignment_refs=[ref(job)],granted_operations=sorted(INSTALLED),state='active')
        self.refuse(self.request('actor.bind',dict(body=body,binding_evidence_ref=ref(proof),authority_ref=ref(self.fx.authority))),'REVISION_CONFLICT')

    def test_create_node_and_coverage_source_accounting_hold(self):
        definition=next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Seed workflow definition')
        create=dict(operation='record.create',args=dict(kind='workflow_node',body=dict(title='Custom Stage',description='Added by a bounded workflow edit',
               node_kind='conversation',parent_uuid=None,order=17,prerequisite_refs=[],definition_ref=ref(definition),gate_kind=None),source_refs=[]))
        preview=self.ok(self.call(self.preview([create])));self.ok(self.call(self.apply(preview['preview_digest'],[create])))
        self.refresh();added=next(x for x in self.items if x['kind']=='workflow_node' and x['body']['title']=='Custom Stage')
        self.assertIsNone(added['body']['parent_uuid'])
        checklist_cat=next(c['uuid'] for c in self.items if c['kind']=='category' and c['body']['category_key']=='checklist')
        todo=next(x for x in self.items if x['kind']=='content' and x['body']['category_uuid']==checklist_cat)
        op=dict(operation='record.update',args=dict(uuid=todo['uuid'],body={**todo['body'],'item_uuids':[]},source_refs=list(todo['source_refs'])))
        self.refuse(self.preview([op]),'MISSING_EVIDENCE')

    # ---- digest/idempotency/inertness -----------------------------------------
    def test_preview_digest_mismatch_refused_and_idempotent_apply(self):
        node=self.node('Shape');op=self.move_op(node,description='bounded change')
        preview=self.ok(self.call(self.preview([op])))
        tampered=preview['preview_digest'][:-1]+('0' if preview['preview_digest'][-1]!='0' else '1')
        self.refuse(self.apply(tampered,[op]),'REVISION_CONFLICT')
        request=self.apply(preview['preview_digest'],[op],key='a12-key')
        receipt=self.ok(self.call(request));self.assertEqual(self.ok(self.call(request)),receipt)
        self.refresh();again=next(x for x in self.items if x['uuid']==node['uuid'])
        self.assertEqual(again['body']['description'],'bounded change')

    def test_definition_import_inert_and_unknown_namespace_preserved(self):
        contracts=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='contracts')
        marker=Path(self.tmp.name)/'INERT-MARKER'
        text='__import__("os").system("touch '+str(marker)+'")'
        body=dict(title='Imported inert definition',category_uuid=contracts['uuid'],format='json',content={'note':text},
                  authority='implementation_choice',state='active',item_uuids=[])
        op=dict(operation='record.create',args=dict(kind='content',body=body,source_refs=[],extensions={}))
        preview=self.ok(self.call(self.preview([op])));self.ok(self.call(self.apply(preview['preview_digest'],[op])))
        self.refresh();stored=next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Imported inert definition')
        self.assertEqual(stored['body']['content'],{'note':text});self.assertFalse(marker.exists())
        op2=dict(operation='record.create',args=dict(kind='content',body={**body,'title':'Unknown namespace'},source_refs=[],extensions={'evil.namespace':{'x':1}}))
        self.refuse(self.preview([op2]),'INVALID_SCHEMA')
        reports=sorted((self.fx.home/'.migration-reports').glob('*.json'))
        self.assertTrue(reports,'rejected import input must be retained, never dropped')
        original=json.loads(reports[-1].read_text())['original_request']
        self.assertIn('evil.namespace',original['args']['proposed_operations'][0]['args']['extensions'])

    # ---- checklist -------------------------------------------------------------
    def test_checklist_provisional_approved_spec_digest_and_pending_obligations(self):
        spec=self.approve_spec()
        details=self.ok(self.call(self.request('checklist.current',{'uuid':self.ticket['root_uuid']})))['details']
        self.assertTrue(details['provisional']);self.assertEqual(len(details['unresolved_refs']),details['item_count'])
        checklist_cat=next(c['uuid'] for c in self.items if c['kind']=='category' and c['body']['category_key']=='checklist')
        contents=[x for x in self.items if x['kind']=='content' and x['body']['category_uuid']==checklist_cat]
        reference_body=dict(target_kind='plan_entry',locator=spec['uuid'],source_checkout=None,source_ref=None,
                            used_revision=spec['revision_uuid'],used_sha256=digest(spec),used_stamp=spec['last_updated'],supported_scope=[contents[0]['uuid']])
        op=dict(operation='record.create',args=dict(kind='reference',body=reference_body,source_refs=[]))
        pin=dict(kind='owner_decision',locator=spec['uuid'],revision=spec['revision_uuid'],sha256=digest(spec),recorded_at=spec['last_updated'],native_ref=None)
        preview=self.ok(self.call(self.checklist_preview([op],[pin])))
        request=self.request('checklist.reconcile_apply',dict(preview_digest=preview['preview_digest'],operations=[op],coverage_rows=[],authority_refs=[ref(self.fx.authority)]),key=uid())
        self.ok(self.call(request));self.refresh()
        after=self.ok(self.call(self.request('checklist.current',{'uuid':self.ticket['root_uuid']})))['details']
        self.assertEqual(after['approved_spec_digest'],digest(spec))
        self.assertTrue([x for x in after['items'] if x['state']=='reconciled'])
        obligations=self.ok(self.call(self.request('checklist.obligations',{'uuid':self.ticket['root_uuid']})))['details']
        self.assertEqual(obligations['mapping_is_approval'],False)
        # any unresolved carried obligations remain pending
        self.assertTrue(all(x['state']=='pending' for x in obligations['pending']))

    def approve_spec(self):
        instruction=self.fx.authority
        path=self.fx.root/'.evidence'/(instruction['revision_uuid']+'.json')
        pin=dict(kind='owner_decision',locator=str(path),revision=instruction['revision_uuid'],sha256=file_hash(path),
                 recorded_at=instruction['last_updated'],native_ref=None)
        decisions=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='decisions')
        body=dict(title='Approved SPEC alignment target',category_uuid=decisions['uuid'],format='plain',
                  content=instruction['body']['content'],authority='owner_decision',state='active',item_uuids=[])
        self.ok(self.call(self.request('decision.record',dict(body=body,item_uuids=[],source_refs=[pin]))))
        self.refresh()
        return next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Approved SPEC alignment target')

    # ---- prompts ---------------------------------------------------------------
    def test_prompt_distinct_evidence_unknown_provider_and_same_label_identities(self):
        job,actor,binding,attempt=self.ready();self.ok(self.call(self.start_request(job,actor,attempt)))
        prompt=self.ok(self.call(self.request('prompt.get',{'uuid':job['uuid']},actor)))['details']
        self.assertEqual(prompt['supplied']['evidence'],'stored_assignment_briefing')
        acknowledged=prompt['acknowledged'][0] if isinstance(prompt['acknowledged'],list) else prompt['acknowledged']
        self.assertEqual(acknowledged['evidence'],'child_loaded_ack');self.assertTrue(acknowledged['acknowledged'])
        self.assertEqual(prompt['provider_label']['unknown_provider'],True)
        template=self.ok(self.call(self.request('prompt.get',{'uuid':job['body']['node_uuid']},actor)))['details']
        self.assertEqual(template['template']['evidence'],'authored_definition');self.assertTrue(template['template']['inert'])
        self.assertTrue(all(x['provider']['provider']=='unknown' for x in template['supplied']))
        self.assertTrue(template['divergence'] or template['identities'])

    def test_same_display_label_preserves_distinct_identities(self):
        job,actor,binding,attempt=self.ready()
        second,_=self.publish(1)
        identity=uid();data=dict(actual_cwd=str(acceptance_tests.CHECKOUT),permissions='danger-full-access',runtime_kind='thread',
            runtime_id='fixture:thread:'+identity,host_id='fixture:host',parent_actor_uuid=None,source_checkout=second['body']['source_checkout'],
            source_branch=second['body']['source_branch'],source_head=second['body']['source_head'],provenance='trusted-local-fixture')
        proof=self.saved(data)
        body=dict(role=second['body']['role'],runtime_kind='thread',runtime_id=data['runtime_id'],host_id=data['host_id'],parent_actor_uuid=None,
                  actual_cwd=str(acceptance_tests.CHECKOUT),binding_evidence_ref=ref(proof),assignment_refs=[ref(second)],granted_operations=sorted(INSTALLED),state='active')
        self.ok(self.call(self.request('actor.bind',dict(body=body,binding_evidence_ref=ref(proof),authority_ref=ref(self.fx.authority)))))
        self.refresh();prompt=self.ok(self.call(self.request('prompt.get',{'uuid':second['uuid']})))['details']
        labels={x['display_label'] for x in prompt['identities']};uuids={x['actor_uuid'] for x in prompt['identities']}
        self.assertEqual(len(labels),1);self.assertGreaterEqual(len(uuids),1)

    # ---- gates + card ----------------------------------------------------------
    def test_owner_gate_eligible_only_after_own_prerequisites(self):
        gate=self.node('Merge Review')
        before=self.ok(self.call(self.request('workflow.gates',{'uuid':gate['uuid']})))['details']['owner_gate']
        self.assertFalse(before['eligible']);self.assertNotEqual(before['icon'],'back_hand')
        job,actor,attempt,outputs=self.returned(-1)
        pins=self.scope(attempt);gates=self.two_gates(pins,0);self.ok(self.call(self.accept_request(pins,gates)))
        self.refresh();after=self.ok(self.call(self.request('workflow.gates',{'uuid':gate['uuid']})))['details']['owner_gate']
        self.assertTrue(after['eligible']);self.assertEqual(after['icon'],'back_hand')

    def test_fresh_process_reopen_and_canonical_hash_readback(self):
        node=self.node('Shape');op=self.move_op(node,description='readback change')
        preview=self.ok(self.call(self.preview([op])));self.ok(self.call(self.apply(preview['preview_digest'],[op])))
        self.refresh()
        root=next(x for x in current(self.plan) if x['kind']=='plan')
        binding=next(b for b in root['body']['ticket_bindings'] if b['ticket_uuid']==self.ticket['root_uuid'])
        payload=self.fx.home/binding['relative_path']
        self.assertEqual(file_hash(payload),binding['sha256'])
        document=json.loads(payload.read_text());canonical={x['entry_uuid']:x['revision_uuid'] for x in document['current']}
        moved=next(x for x in self.items if x['uuid']==node['uuid'])
        self.assertEqual(canonical[node['uuid']],moved['revision_uuid'])
        fresh=self.ok(self.call(self.request('workflow.node_get',{'uuid':node['uuid']})))
        self.assertEqual(fresh['details']['node']['revision_uuid'],moved['revision_uuid'])
        self.assertEqual(fresh['captured_plan_revision_uuid'],self.plan['root_revision_uuid'])

    def test_card_projection_top_level_only_never_rolls_up_child_icons(self):
        projection=workflow.projection(self.items)
        self.assertIsNotNone(projection['card'])
        top=next(x for x in self.items if x['uuid']==projection['card']['node_uuid'])
        self.assertIsNone(top['body']['parent_uuid'],'card derives only from an explicit top-level node')
        self.assertEqual(projection['card']['source'],'explicit current top-level workflow node')
        self.assertIn(projection['card']['node_kind'],{'conversation','autonomous','owner_gate','checkpoint'})


if __name__=='__main__':unittest.main()
