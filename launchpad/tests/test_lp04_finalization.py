"""A13 public integration/finalization and full dependency release on real stores."""
import json
import tempfile
import unittest
from pathlib import Path
import test_lp04_acceptance as acceptance_tests
from support import CHECKOUT, current, read_generation, ref, uid, envelope
from core.commands import INSTALLED, REGISTRY
from core import dependencies, integration

BRANCH='codex/build-workflow-and-tickets'
SHA='a'*40
CONSUMER=str(CHECKOUT)


class FinalizationTests(unittest.TestCase):
    for _name in ('ok','refresh','request','saved','publish','runtime','dispatch','claim_request','claim',
                  'start_request','attempt','refuse','ready'):
        locals()[_name]=getattr(acceptance_tests.claims.ClaimsTests,_name)
    for _name in ('call','bind','retain','return_run','returned','scope','prepare_evaluation','evaluate',
                  'accept_request','two_gates','project','bind_runtime','evaluation_ready','evaluation_job'):
        locals()[_name]=getattr(acceptance_tests.AcceptanceTests,_name)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.initialize(Path(self.tmp.name))

    def initialize(self,root):
        self.fx=acceptance_tests.claims.Fixture(root);self.raw=[]
        self.fx.actor['body']['granted_operations']=sorted(INSTALLED);self.fx.save(self.fx.actor)
        self.fx.run=self.call;self.ok(self.fx.create('A13 disposable integration/finalization fixture'))
        self.ok(self.call(self.fx.seed()));self.refresh();self.main_ticket=self.ticket['root_uuid']

    # ---- fixtures --------------------------------------------------------------
    def saved_owner(self,content,title='A13 owner git authorization'):
        return self.fx.save(envelope('content',dict(title=title,category_uuid=uid(),format='json',content=content,
                    authority='owner_decision',state='active',item_uuids=[]),self.fx.writer))

    def authorization(self):
        return self.saved_owner({'record_kind':'OWNER_AUTHORIZATION_RECEIPT','decision':'AUTHORIZE_A13_GIT_OPERATIONS',
            'authorized_scope':{'checkout':CONSUMER,'branch':BRANCH,'operations':['commit','push','integrate','pull']}})

    def git_evidence(self,**overrides):
        parts={'main':dict(git_ref='refs/remotes/origin/main',head_sha=SHA),
               'consumer':{'git_ref':'refs/heads/'+BRANCH},
               'proof':dict(commit_sha=SHA,main_ref='refs/remotes/origin/main',ancestor=True),
               'pull':dict(verified=True,pull_source_ref='refs/remotes/origin/main',head_sha=SHA)}
        for key,value in overrides.items():parts[key].update(value)
        return {key:self.saved(value) for key,value in parts.items()}

    def integration_args(self,candidate,evidence=None,overrides=None):
        ev=evidence or self.git_evidence();args=dict(authority_refs=[ref(self.fx.authority),ref(self.authorization())],
            candidate_digest=candidate,checkout=CONSUMER,branch=BRANCH,commit_sha=SHA,main_ref=ref(ev['main']),
            main_integration_sha=SHA,main_verification_ref=ref(ev['proof']),consumer_checkout=CONSUMER,
            consumer_ref=ref(ev['consumer']),pull_head_sha=SHA,pull_verification_ref=ref(ev['pull']))
        args.update(overrides or {});return args

    def accepted_candidate(self):
        job,actor,attempt,outputs=self.returned();pins=self.scope(attempt);gates=self.two_gates(pins)
        receipt=self.ok(self.call(self.accept_request(pins,gates)));self.refresh()
        accepted=next(x for x in self.items if x['kind']=='acceptance' and ref(x) in receipt['changed_refs'])
        return accepted['body']['subject_digest'],accepted

    def run_integration(self,candidate,evidence=None,overrides=None):
        request=self.request('integration.record',self.integration_args(candidate,evidence,overrides),key=uid())
        receipt=self.ok(self.call(request));self.refresh()
        record=next(x for x in self.items if x['kind']=='integration' and ref(x) in receipt['changed_refs'])
        return record,request

    def finalize_request(self,record,candidate,authority_refs=None,key=None):
        refs=authority_refs or list(record['body']['authority_refs'][:2])
        return self.request('ticket.finalize',dict(integration_ref=ref(record),candidate_digest=candidate,authority_refs=refs),key=key or uid())

    def open_discussion(self):
        phase=next(x for x in self.items if x['kind']=='workflow_node' and x['body']['node_kind']=='conversation')
        self.ok(self.call(self.request('discussion.register',dict(phase_node_uuid=phase['uuid'],actor_uuid=self.fx.actor['uuid']))))
        self.refresh();return next(x for x in self.items if x['kind']=='discussion' and x['body']['actor_uuid']==self.fx.actor['uuid'] and x['body']['phase_node_uuid']==phase['uuid'])

    # ---- success path ----------------------------------------------------------
    def test_exact_chain_finalizes_once_preserves_discussion_terminal_no_next_mode(self):
        candidate,_=self.accepted_candidate();discussion=self.open_discussion()
        record,integration_request=self.run_integration(candidate)
        self.assertEqual(record['body']['main_ref'],'refs/remotes/origin/main')
        self.assertEqual(record['body']['pull_source_ref'],'refs/remotes/origin/main')
        self.assertEqual(record['body']['subject_digest'],candidate)
        finalize=self.finalize_request(record,candidate);receipt=self.ok(self.call(finalize))
        self.refresh();target=next(x for x in self.items if x['kind']=='ticket')
        self.assertEqual(target['body']['state'],'finalized');self.assertEqual(target['body']['finalization_ref'],ref(record))
        retained=next(x for x in self.items if x['uuid']==discussion['uuid']);self.assertEqual(retained['body']['state'],'open')
        self.refuse(self.finalize_request(record,candidate),'INVALID_TRANSITION')
        projected=integration.finalization_projection(self.fx.root,self.plan,self.ts)[self.main_ticket]
        self.assertTrue(projected['completed']);self.assertIsNone(projected['next_mode'])
        self.assertEqual(projected['finalization_ref'],ref(record))

    def test_release_check_reevaluates_all_tickets_and_unlock_is_not_dispatch(self):
        candidate,_=self.accepted_candidate();record,_=self.run_integration(candidate)
        self.ok(self.call(self.finalize_request(record,candidate)));self.refresh()
        before=(len([x for t in self.ts.values() for x in current(t) if x['kind']=='assignment']),
                len([x for t in self.ts.values() for x in current(t) if x['kind']=='attempt']))
        request=self.request('track.release_check',dict(integration_ref=ref(record)),key=uid())
        result=self.ok(self.call(request));evaluation=json.loads(result['continuation'])
        self.assertIn(self.main_ticket,evaluation['completed'])
        self.assertEqual(evaluation['tickets'][self.main_ticket]['state'],'completed')
        self.refresh()
        after=(len([x for t in self.ts.values() for x in current(t) if x['kind']=='assignment']),
               len([x for t in self.ts.values() for x in current(t) if x['kind']=='attempt']))
        self.assertEqual(before,after)
        self.assertEqual(self.ok(self.call(request)),result)

    # ---- refusals --------------------------------------------------------------
    def test_commit_only_push_only_and_without_verified_pull_refused_no_mutation(self):
        candidate,_=self.accepted_candidate()
        self.refuse(self.request('integration.record',self.integration_args(candidate,self.git_evidence(proof={'ancestor':False})),key=uid()),'MISSING_EVIDENCE')
        self.refuse(self.request('integration.record',self.integration_args(candidate,self.git_evidence(pull={'verified':False})),key=uid()),'MISSING_EVIDENCE')
        ev=self.git_evidence();ev['pull']['body']['content']['head_sha']='b'*40;self.fx.save(ev['pull'])
        self.refuse(self.request('integration.record',self.integration_args(candidate,ev),key=uid()),'MISSING_EVIDENCE')
        self.refresh();self.assertFalse([x for x in self.items if x['kind']=='integration'])

    def test_wrong_checkout_branch_ref_and_missing_authorization_refused(self):
        candidate,_=self.accepted_candidate()
        self.refuse(self.request('integration.record',self.integration_args(candidate,overrides={'checkout':'/tmp/other'}),key=uid()),'FORBIDDEN')
        self.refuse(self.request('integration.record',self.integration_args(candidate,overrides={'branch':'other'}),key=uid()),'FORBIDDEN')
        bad=self.git_evidence();bad['proof']['body']['content']['main_ref']='refs/heads/other';self.fx.save(bad['proof'])
        self.refuse(self.request('integration.record',self.integration_args(candidate,bad),key=uid()),'MISSING_EVIDENCE')
        args=self.integration_args(candidate);args['authority_refs']=[ref(self.fx.authority)]
        self.refuse(self.request('integration.record',args,key=uid()),'MISSING_EVIDENCE')
        self.refresh();self.assertFalse([x for x in self.items if x['kind']=='integration'])

    def test_finalize_requires_exact_accepted_candidate_and_authorization(self):
        candidate,_=self.accepted_candidate();record,_=self.run_integration(candidate)
        wrong=dict(integration_ref=ref(record),candidate_digest='0'*64,authority_refs=list(record['body']['authority_refs'][:2]))
        self.refuse(self.request('ticket.finalize',wrong,key=uid()),'REVISION_CONFLICT')
        noauth=dict(integration_ref=ref(record),candidate_digest=candidate,authority_refs=[ref(self.fx.authority)])
        self.refuse(self.request('ticket.finalize',noauth,key=uid()),'MISSING_EVIDENCE')

    # ---- dependency release ----------------------------------------------------
    def second_ticket(self):
        self.ok(self.call(self.fx.seed('Successor',track=1)));self.refresh()
        return [key for key in self.ts if key!=self.main_ticket][-1]

    def expected_for(self,ticket_uuid):
        expected={x['uuid']:x['revision_uuid'] for x in current(self.plan)+current(self.ts[ticket_uuid])}
        for p in (self.fx.root/'.evidence').glob('*.json'):
            e=json.loads(p.read_text());expected.setdefault(e['uuid'],e['revision_uuid'])
        return expected

    def mutate_for(self,ticket_uuid,op,args,key=None):
        scope=dict(plan_uuid=self.plan['root_uuid'],ticket_uuid=ticket_uuid,include_history=False)
        tool=REGISTRY[op]['tool']
        request=dict(interface_version=1,tool=tool,operation=op,args=args,scope=scope,actor_binding_ref=ref(self.fx.actor))
        if tool in ('db.mutate','db.transaction'):
            request.update(expected=self.expected_for(ticket_uuid),expected_plan_revision_uuid=self.plan['root_revision_uuid'],idempotency_key=key or uid())
        return request

    def add_prerequisite(self,ticket_uuid,condition_ref):
        self.refresh()
        node=next(x for x in current(self.ts[ticket_uuid]) if x['kind']=='workflow_node' and x['body']['node_kind']=='autonomous')
        body={**node['body'],'prerequisite_refs':[condition_ref]}
        op=dict(operation='record.update',args=dict(uuid=node['uuid'],body=body,source_refs=list(node['source_refs'])))
        preview_args=dict(source_refs=[],proposed_operations=[op],target_expected=self.expected_for(ticket_uuid),coverage_rows=[])
        preview=self.ok(self.call(self.mutate_for(ticket_uuid,'workflow.edit_preview',preview_args)))
        apply_args=dict(preview_digest=preview['preview_digest'],operations=[op],coverage_rows=[],authority_refs=[ref(self.fx.authority)])
        self.ok(self.call(self.mutate_for(ticket_uuid,'workflow.edit_apply',apply_args)))

    def test_another_prerequisite_keeps_successor_locked_then_unlocks_without_dispatch(self):
        candidate,_=self.accepted_candidate();record,_=self.run_integration(candidate)
        self.ok(self.call(self.finalize_request(record,candidate)))
        successor=self.second_ticket()
        pending=self.fx.save(envelope('content',dict(title='Unreleased successor hold',category_uuid=uid(),format='plain',
                 content='pending',authority='proposal',state='pending',item_uuids=[]),self.fx.writer))
        self.add_prerequisite(successor,ref(pending))
        plan,ts,_=read_generation(self.fx.home)
        evaluated=dependencies.release(self.fx.root,plan,ts)
        self.assertEqual(evaluated['tickets'][successor]['state'],'locked')
        self.assertIn(self.main_ticket,evaluated['completed'])
        active=self.fx.save(envelope('content',dict(title='Released successor hold',category_uuid=uid(),format='plain',
                 content='active',authority='proposal',state='active',item_uuids=[]),self.fx.writer))
        self.add_prerequisite(successor,ref(active))
        plan,ts,_=read_generation(self.fx.home)
        evaluated=dependencies.release(self.fx.root,plan,ts)
        self.assertEqual(evaluated['tickets'][successor]['state'],'unlocked')
        successor_items=current(ts[successor])
        self.assertFalse([x for x in successor_items if x['kind'] in ('assignment','attempt')])

    # ---- clause 6: seed-only Plan Manager -------------------------------------
    def test_seed_guard_refuses_midbuild_and_blocked_spec_and_layout_recomputes_four_tracks(self):
        candidate,_=self.accepted_candidate();record,_=self.run_integration(candidate)
        self.ok(self.call(self.finalize_request(record,candidate)));self.refresh()
        plan,ts,_=read_generation(self.fx.home)
        layout=dependencies.layout(plan,ts)
        self.assertEqual(layout['track_count'],4)
        self.assertEqual(len({t['uuid'] for t in layout['tracks']}),4)
        self.assertTrue(all({'opening','track','convergence'}<=set(t) for t in layout['tracks']))
        # A mid-build/terminal (non-seed) Plan Manager edit is refused through the public entry.
        seed_request=self.request('ticket.seed_apply',dict(seed_ref=ref(self.fx.authority),scope_items=[],checklist_items=[]),key=uid())
        self.refuse(seed_request,'INVALID_TRANSITION')
        # Authored blocked SPEC content is refused by the seed guard.
        with self.assertRaises(Exception):
            dependencies.seed_guard([ts[self.main_ticket]],[dict(args=dict(kind='content',body=dict(authority='spec_contract',title='Authored blocked SPEC',state='blocked')))])

    # ---- helper performs no Git ------------------------------------------------
    def test_helper_executes_no_git_operation(self):
        source=Path(integration.__file__).read_text()+'\n'+Path(dependencies.__file__).read_text()
        for token in ('subprocess','os.system','Popen','git clone','git push','git commit','git pull'):
            self.assertNotIn(token,source)

    def test_catalog_reports_finalization_operations_installed(self):
        catalog=self.ok(self.call(self.request('catalog.list',{})))['details']
        available={x['operation'] for x in catalog if x['availability']=='installed'}
        for op in ('integration.record','ticket.finalize','track.release_check'):
            self.assertIn(op,available)
            described=self.ok(self.call(self.request('operation.describe',{'name':op})))['details']
            self.assertEqual(described['availability'],'installed')
            self.assertEqual(described['grant'],'authorized operation recorder')
            self.assertEqual(described['tool'],'db.mutate')


if __name__=='__main__':unittest.main()
