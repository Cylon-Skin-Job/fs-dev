"""A11 public frozen returns, independent gates, acceptance and causal rework."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
import test_lp04_claims as claims
from support import Fixture, CHECKOUT, CLI, ref, uid, encode, file_hash, current, envelope
from core.commands import INSTALLED
from core.schema import named
from core.store import digest
from core import seed
from core.runtime_binding import EVALUATION_GRANTS
from core import runtime_binding as binding
from core import acceptance, attempts


class AcceptanceTests(unittest.TestCase):
    for _name in ('ok','refresh','request','saved','publish','runtime','dispatch','claim_request','claim','start_request','attempt','refuse','ready'):
        locals()[_name]=getattr(claims.ClaimsTests,_name)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.initialize(Path(self.tmp.name))

    def initialize(self,root):
        self.fx=Fixture(root);self.raw=[];self.fx.actor['body']['granted_operations']=sorted(INSTALLED);self.fx.save(self.fx.actor)
        self.fx.run=self.call;self.ok(self.fx.create('A11 disposable trusted-local gates'));self.ok(self.call(self.fx.seed()));self.refresh()

    def initialize_child_manager(self,root):
        """Fixture whose responsible plan owner has a real child runtime.

        The production contract permits a parent manager with an actual runtime.
        The default suite owner is ephemeral-unknown, which cannot match a
        claimable child evaluator, so this bounded fixture exists only to
        exercise manager-runtime contamination through the public route.
        """
        self.fx=Fixture(root);self.raw=[]
        self.fx.binding['body']['content']={**self.fx.binding['body']['content'],'runtime_kind':'child','runtime_id':'fixture:child-manager','parent_actor_uuid':uid()}
        self.fx.save(self.fx.binding)
        self.fx.actor['body'].update(runtime_kind='child',runtime_id='fixture:child-manager',
            parent_actor_uuid=self.fx.binding['body']['content']['parent_actor_uuid'],
            binding_evidence_ref=ref(self.fx.binding),granted_operations=sorted(INSTALLED))
        self.fx.save(self.fx.actor)
        self.fx.run=self.call;self.ok(self.fx.create('A11 child-manager runtime freshness fixture'));self.ok(self.call(self.fx.seed()));self.refresh()

    def bind_runtime(self,job,runtime_id):
        """Bind an evaluation actor to an exact underlying runtime identity.

        Contamination classes are distinct actor UUIDs that share one real
        runtime_kind/host_id/runtime_id; this constructs them truthfully.
        """
        identity=uid();proof=dict(actual_cwd=str(CHECKOUT),permissions='danger-full-access',runtime_kind='child',runtime_id=runtime_id,
            parent_actor_uuid=self.fx.actor['uuid'],source_checkout=job['body']['source_checkout'],source_branch=job['body']['source_branch'],
            source_head=job['body']['source_head'],provenance='trusted-local-fixture')
        binding=self.saved(proof)
        body=dict(role=job['body']['role'],runtime_kind='child',runtime_id=runtime_id,host_id=None,parent_actor_uuid=self.fx.actor['uuid'],
            actual_cwd=str(CHECKOUT),binding_evidence_ref=ref(binding),assignment_refs=[ref(job)],granted_operations=sorted(EVALUATION_GRANTS),state='active')
        self.ok(self.call(self.request('actor.bind',dict(body=body,binding_evidence_ref=ref(binding),authority_ref=ref(self.fx.authority)))))
        self.refresh();actor=next(x for x in current(self.plan) if x['kind']=='actor' and x['body']['binding_evidence_ref']==ref(binding));return actor,binding

    def evaluation_ready(self,job,runtime_id):
        reviewer,binding=self.bind_runtime(job,runtime_id);self.dispatch(job,reviewer)
        attempt,_,_=self.claim(job,reviewer,binding);self.ok(self.call(self.start_request(job,reviewer,attempt)))
        return reviewer,self.attempt(attempt['uuid'])

    def evaluation_job(self,node,pins,gate):
        return self.publish(node,'evaluation',source_refs=[ref(self.nodes[node]),self.nodes[node]['body']['definition_ref']]+pins,return_criteria=['gate:'+gate])

    def call(self,request,extra=None,cwd=CHECKOUT):
        request=copy.deepcopy(request);data=encode(request);path=self.fx.root/('request-'+uid()+'.json');path.write_bytes(data)
        argv=[sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)]
        proc=subprocess.run(argv,cwd=cwd,env={**os.environ,**(extra or {})},capture_output=True,text=True)
        self.raw.append(dict(argv=argv,cwd=str(cwd),env_overrides=copy.deepcopy(extra or {}),request=request,request_bytes_utf8=data.decode(),request_sha256=file_hash(path),stdout=proc.stdout,stderr=proc.stderr,exit=proc.returncode))
        if not proc.stdout:raise AssertionError(proc.stderr)
        value=json.loads(proc.stdout);named(value,'response.schema.json');return proc.returncode,value

    def bind(self,job,**kwargs):
        if job['body']['work_kind']=='evaluation':kwargs['granted_operations']=sorted(EVALUATION_GRANTS)
        return claims.ClaimsTests.bind(self,job,**kwargs)

    def retain(self,path):
        self.refresh();prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text())
        evidence=[json.loads(p.read_text()) for p in (self.fx.root/'.evidence').glob('*.json')]
        paths=list(self.fx.sources.rglob('*'))+[Path(x['body']['report_path']) for x in self.items if x['kind']=='assignment']
        source_files=[dict(path=str(p),sha256=file_hash(p),bytes_hex=p.read_bytes().hex(),bytes=p.stat().st_size) for p in paths if p.is_file() and not p.is_symlink()]
        return dict(test=self.id(),raw=self.raw,evidence=evidence,source_files=source_files,readback=dict(plan=self.plan,tickets=self.ts,prepared=prepared,plan_sha256=file_hash(self.folder/'plan.json'),view_hashes={k:file_hash(self.folder/k) for k in prepared['view_hashes']}),limits='All fixture identities, dispatch/start/acceptance instructions are saved trusted-local test data, never actual native starts or human acceptance. Public subprocesses and physical canonical files are real.')

    def tearDown(self):
        path=os.environ.get('LP_A11_REPORT')
        if path:
            p=Path(path);rows=json.loads(p.read_text()) if p.exists() else [];rows.append(self.retain(p));p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(encode(rows))
        self.tmp.cleanup()

    def return_run(self,job,actor,attempt,deliverables=None):
        attempt=self.attempt(attempt['uuid'])
        if attempt['body']['state']=='claimed':self.ok(self.call(self.start_request(job,actor,attempt)));attempt=self.attempt(attempt['uuid'])
        if deliverables is None:
            cat=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='handoff')
            value=dict(title='Frozen returned deliverable',category_uuid=cat['uuid'],format='json',content={'result':'A11 output'},authority='implementation_choice',state='active',item_uuids=[])
            response=self.ok(self.call(self.request('record.create',dict(kind='content',body=value,source_refs=[]))))
            self.refresh();deliverables=[next(x for x in self.items if x['kind']=='content' and ref(x) in response['changed_refs'])]
        path=Path(job['body']['report_path']);path.parent.mkdir(parents=True,exist_ok=True)
        if not path.exists():path.write_text('Exact frozen A11 report\n')
        checks=dict(commands=['public A11'],results=['pass'],warnings=[],skips=[],deviations=[])
        proof=self.runtime('return',job,actor,attempt,report_path=str(path),report_file_sha256=file_hash(path),recipient_actor_uuid=self.fx.actor['uuid'],deliverable_refs=[ref(x) for x in deliverables],return_checks=checks)
        request=self.request('run.return_record',dict(assignment_uuid=job['uuid'],attempt_uuid=attempt['uuid'],evidence_refs=[ref(proof)],summary='Frozen own return, not acceptance',deliverable_refs=[ref(x) for x in deliverables],return_checks=checks),actor)
        self.ok(self.call(request));return self.attempt(attempt['uuid']),deliverables,request

    def returned(self,node=0):
        job,actor,binding,attempt=self.ready(node);attempt,outputs,request=self.return_run(job,actor,attempt);return job,actor,attempt,outputs

    def scope(self,attempt):return acceptance.full_scope(self.items,attempt)

    def prepare_evaluation(self,pins,mode,node,verdict='pass',findings=None,recheck=False):
        job,_=self.publish(node,'evaluation',source_refs=[ref(self.nodes[node]),self.nodes[node]['body']['definition_ref']]+[{**p,'scope_item_uuids':[]} for p in pins],return_criteria=['gate:'+mode,'A11 exact current scope'])
        actor,binding=self.bind(job);self.dispatch(job,actor);attempt,_,_=self.claim(job,actor,binding);self.ok(self.call(self.start_request(job,actor,attempt)));attempt=self.attempt(attempt['uuid'])
        args=dict(evaluation_assignment_uuid=job['uuid'],subject_refs=pins,subject_digest=digest(pins),reviewer_actor_uuid=actor['uuid'])
        self.ok(self.call(self.request('review.attempt_add',args,actor)))
        path=Path(job['body']['report_path']);path.parent.mkdir(parents=True,exist_ok=True);path.write_text('Independent '+mode+' raw report\n')
        evidence=self.saved({'raw':'exact source inspection','scope':pins});findings=findings or []
        report=self.saved(dict(evaluation_assignment_ref=ref(job),evaluation_attempt_ref=ref(attempt),reviewer_actor_uuid=actor['uuid'],subject_refs=pins,subject_digest=digest(pins),independent=True,mode=mode,evidence_refs=[ref(evidence)],verdict=verdict,finding_refs=findings,report_path=str(path),report_file_sha256=file_hash(path)))
        report['writer']=seed.writer(actor);self.fx.save(report)
        args.update(verdict=verdict,finding_refs=findings,report_ref=ref(report));request=self.request('review.recheck_record' if recheck else 'review.result_record',args,actor)
        return request,job,actor,attempt,report

    def evaluate(self,pins,mode,node,verdict='pass',findings=None,return_it=True,recheck=False):
        request,job,actor,attempt,report=self.prepare_evaluation(pins,mode,node,verdict,findings,recheck)
        response=self.ok(self.call(request));self.refresh();gate=next(x for x in self.items if x['kind']=='review' and ref(x) in response['changed_refs'])
        self.assertEqual(self.ok(self.call(request)),response)
        if return_it:self.return_run(job,actor,attempt,[report])
        return gate,job,actor,attempt,report,request

    def accept_request(self,pins,gates,owner=False):
        args=dict(subject_refs=pins,subject_digest=digest(pins),gate_refs=[ref(x) for x in gates],authority_ref=ref(self.fx.authority))
        data=dict(kind='owner_acceptance' if owner else 'parent_acceptance',subject_refs=pins,subject_digest=digest(pins),gate_refs=args['gate_refs'],accepting_actor_uuid=self.fx.actor['uuid'])
        instruction=self.saved(data)
        if owner:instruction['body']['authority']='owner_decision';self.fx.save(instruction)
        args['original_instruction_ref']=ref(instruction);return self.request('acceptance.record',args)

    def two_gates(self,pins,start=1,recheck=False):
        return [self.evaluate(pins,'builder',start,recheck=recheck)[0],self.evaluate(pins,'orchestrator',start+1,recheck=recheck)[0]]

    def project(self):
        self.refresh();return attempts.projection(self.fx.root,self.plan,self.ts,self.items)

    def test_producer_and_prior_reviewer_runtime_contamination_refused(self):
        job,producer,attempt,outputs=self.returned();pins=self.scope(attempt)
        # Producer-contaminated evaluator: same underlying runtime as a subject writer.
        producer_eval,_=self.evaluation_job(1,pins,'builder')
        reviewer,run=self.evaluation_ready(producer_eval,producer['body']['runtime_id'])
        args=dict(evaluation_assignment_uuid=producer_eval['uuid'],subject_refs=pins,subject_digest=digest(pins),reviewer_actor_uuid=reviewer['uuid'])
        self.refuse(self.request('review.attempt_add',args,reviewer),'FORBIDDEN')
        # Prior-reviewer-contaminated evaluator: the exact manager reproduction class.
        first=self.evaluate(pins,'builder',2)
        prior_eval,_=self.evaluation_job(3,pins,'orchestrator')
        reviewer2,run2=self.evaluation_ready(prior_eval,first[2]['body']['runtime_id'])
        args2=dict(evaluation_assignment_uuid=prior_eval['uuid'],subject_refs=pins,subject_digest=digest(pins),reviewer_actor_uuid=reviewer2['uuid'])
        self.refuse(self.request('review.attempt_add',args2,reviewer2),'FORBIDDEN')

    def test_same_display_label_distinct_runtimes_still_release(self):
        job,actor,attempt,outputs=self.returned();pins=self.scope(attempt);gates=self.two_gates(pins)
        jobs=[next(x for x in self.items if x['kind']=='assignment' and x['uuid']==g['body']['assignment_uuid']) for g in gates]
        reviewers=[next(x for x in current(self.plan) if x['kind']=='actor' and x['uuid']==g['body']['reviewer_actor_uuid']) for g in gates]
        self.assertEqual({j['body']['role'] for j in jobs},{'clean-room-reviewer'})
        self.assertEqual({g['body']['mode'] for g in gates},{'builder','orchestrator'})
        self.assertEqual(len({binding.runtime_identity(x) for x in reviewers}),len(reviewers))
        self.ok(self.call(self.accept_request(pins,gates)));self.refresh();self.assertTrue(acceptance.released(self.items,attempt))

    def test_return_review_pass_accept_next_failed_dispatch_then_acknowledged_start(self):
        job,actor,attempt,outputs=self.returned();pins=self.scope(attempt)
        self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'output_circle')
        gates=self.two_gates(pins);self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'output_circle')
        req=self.accept_request(pins,gates);receipt=self.ok(self.call(req));self.assertEqual(self.ok(self.call(req)),receipt)
        self.refresh();accepted=next(x for x in self.items if x['kind']=='acceptance' and ref(x) in receipt['changed_refs'])
        self.assertTrue(acceptance.released(self.items,attempt));self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'output_circle')
        # Evaluation nodes occupy other slots. The exact first following node is
        # deliberately used for next work; gates are on later autonomous slots.
        self.assertEqual(self.project()[job['uuid']]['attempts'][0]['release']['next_node_uuid'],self.nodes[1]['uuid'])
        following,_=self.publish(1,prerequisite_refs=[ref(accepted)]);next_actor,next_binding=self.bind(following);self.dispatch(following,next_actor,'failed')
        self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'output_circle')
        self.dispatch(following,next_actor);next_attempt,_,_=self.claim(following,next_actor,next_binding)
        self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'output_circle')
        self.ok(self.call(self.start_request(following,next_actor,next_attempt)))
        self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'check_circle')

    def test_partial_scope_and_wrong_digest_never_release_full_return(self):
        job,actor,attempt,outputs=self.returned();pins=[ref(outputs[0])];gates=self.two_gates(pins)
        bad=self.accept_request(pins,gates);bad['args']['subject_digest']='0'*64;self.refuse(bad,'SOURCE_UNVERIFIED')
        req=self.accept_request(pins,gates);self.ok(self.call(req));self.refresh();self.assertIsNone(acceptance.released(self.items,attempt));self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'output_circle')

    def test_child_self_accept_missing_gate_incomplete_and_unreturned_evaluator_hold(self):
        job,actor,attempt,outputs=self.returned();pins=self.scope(attempt)
        builder=self.evaluate(pins,'builder',1,return_it=False);manager=self.evaluate(pins,'orchestrator',2)
        self.refuse(self.accept_request(pins,[builder[0],manager[0]]),'MISSING_EVIDENCE')
        self.return_run(builder[1],builder[2],builder[3],[builder[4]])
        self.refuse(self.accept_request(pins,[builder[0]]),'MISSING_EVIDENCE')
        child=self.accept_request(pins,[builder[0],manager[0]]);child['actor_binding_ref']=ref(actor);self.refuse(child,'FORBIDDEN')
        bad=copy.deepcopy(manager[5]);bad['idempotency_key']=uid();bad['args']['subject_refs'][0]['sha256']='0'*64
        self.refuse(bad,'REVISION_CONFLICT')

    def test_changed_subject_invalidates_only_affected_active_gates_acceptance_preserves_history(self):
        job,actor,attempt,outputs=self.returned();pins=self.scope(attempt);gates=self.two_gates(pins);receipt=self.ok(self.call(self.accept_request(pins,gates)))
        self.refresh();accepted=next(x for x in self.items if x['kind']=='acceptance' and ref(x) in receipt['changed_refs']);old=copy.deepcopy(accepted)
        output=outputs[0];body={**output['body'],'content':{'changed':'normative output'}}
        req=self.request('record.update',dict(uuid=output['uuid'],body=body,source_refs=output['source_refs']))
        missing=copy.deepcopy(req);missing['expected'].pop(gates[0]['uuid']);self.refuse(missing,'REVISION_CONFLICT')
        self.ok(self.call(req));self.refresh();changed=next(x for x in self.items if x['uuid']==accepted['uuid']);self.assertEqual(changed['body']['state'],'invalidated');self.assertIn(old,self.ticket['revisions'])
        self.assertTrue(all(next(x for x in self.items if x['uuid']==g['uuid'])['body']['verdict']=='incomplete' for g in gates))
        self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'output_circle');self.assertIn(attempt,self.ticket['revisions'])
        self.assertEqual(next(x for x in self.items if x['uuid']==job['uuid']),job)

    def test_contaminated_runtime_and_unfrozen_scope_result_refused(self):
        job,producer,attempt,outputs=self.returned();pins=self.scope(attempt)
        evaluation,_=self.publish(1,'evaluation',source_refs=[ref(self.nodes[1]),self.nodes[1]['body']['definition_ref']]+pins,return_criteria=['gate:builder'])
        reviewer,binding=self.bind(evaluation);self.dispatch(evaluation,reviewer);owned,_,_=self.claim(evaluation,reviewer,binding);self.ok(self.call(self.start_request(evaluation,reviewer,owned)))
        args=dict(evaluation_assignment_uuid=evaluation['uuid'],subject_refs=pins,subject_digest=digest(pins),reviewer_actor_uuid=reviewer['uuid'])
        proof=copy.deepcopy(binding);proof['body']['content']['runtime_id']=producer['body']['runtime_id'];self.fx.save(proof)
        self.refuse(self.request('review.attempt_add',args,reviewer),'SOURCE_UNVERIFIED');self.fx.save(binding)
        self.refuse(self.request('review.result_record',{**args,'verdict':'pass','finding_refs':[],'report_ref':ref(self.fx.authority)},reviewer),'MISSING_EVIDENCE')
        wrong=copy.deepcopy(args);wrong['subject_digest']='0'*64;self.refuse(self.request('review.attempt_add',wrong,reviewer),'SOURCE_UNVERIFIED')
        bad=copy.deepcopy(args);bad['reviewer_actor_uuid']=producer['uuid'];self.refuse(self.request('review.attempt_add',bad,reviewer),'FORBIDDEN')

    def test_terminal_parent_acceptance_checks_without_successor_and_owner_gate_separate(self):
        job,actor,attempt,outputs=self.returned(-1);pins=self.scope(attempt);gates=self.two_gates(pins,0);self.ok(self.call(self.accept_request(pins,gates)))
        row=self.project()[job['uuid']]['attempts'][0];self.assertEqual(row['icon'],'check_circle');self.assertTrue(row['release']['terminal']);self.assertIsNone(row['release']['next_node_uuid'])
        self.refresh();self.assertFalse(any(x['kind']=='acceptance' and any(p['entry_uuid'] in {n['uuid'] for n in self.items if n['kind']=='workflow_node' and n['body']['node_kind']=='owner_gate'} for p in x['body']['subject_refs']) for x in self.items))

    def test_owner_gate_needs_own_prerequisites_exact_instruction_and_separate_gates(self):
        job,actor,attempt,outputs=self.returned(-1);pins=self.scope(attempt);gates=self.two_gates(pins,0);self.ok(self.call(self.accept_request(pins,gates)))
        self.refresh();owner=next(x for x in self.items if x['kind']=='workflow_node' and x['body']['title']=='Merge Review')
        self.assertEqual(acceptance.gates_projection(self.items)[owner['uuid']]['icon'],'back_hand')
        own=[ref(owner)];own_gates=self.two_gates(own,2)
        self.refuse(self.accept_request(own,own_gates),'MISSING_EVIDENCE')
        self.ok(self.call(self.accept_request(own,own_gates,owner=True)));self.refresh()
        self.assertEqual(acceptance.gates_projection(self.items)[owner['uuid']]['icon'],'check_circle')
        self.assertEqual(self.project()[job['uuid']]['attempts'][0]['icon'],'check_circle')

    def test_same_transaction_subject_change_rejects_earlier_new_acceptance_atomically(self):
        job,actor,attempt,outputs=self.returned();pins=self.scope(attempt);gates=self.two_gates(pins)
        accept=self.accept_request(pins,gates)['args'];output=outputs[0];update=dict(uuid=output['uuid'],body={**output['body'],'content':{'new':'subject'}},source_refs=output['source_refs'])
        operations=[dict(operation='acceptance.record',args=accept),dict(operation='record.update',args=update)]
        self.refuse(self.request('transaction.apply',dict(operations=operations,expected={})),'REVISION_CONFLICT')
        self.refuse(self.request('transaction.apply',dict(operations=list(reversed(operations)),expected={})),'REVISION_CONFLICT')

    def test_incomplete_and_changed_report_file_hold_acceptance_without_mutation(self):
        job,actor,attempt,outputs=self.returned();pins=self.scope(attempt)
        gates=[self.evaluate(pins,'builder',1)[0],self.evaluate(pins,'orchestrator',2,verdict='incomplete')[0]]
        self.refuse(self.accept_request(pins,gates),'MISSING_EVIDENCE')
        path=next(x for x in self.items if x['kind']=='assignment' and x['uuid']==gates[0]['body']['assignment_uuid'])['body']['report_path']
        Path(path).write_text('Changed frozen report')
        self.refuse(self.accept_request(pins,gates),'MISSING_EVIDENCE')

    def test_causal_rework_preserves_original_scope_and_repair_recheck_needs_both_gates(self):
        job,producer,attempt,outputs=self.returned();pins=self.scope(attempt)
        evaluation,_=self.publish(1,'evaluation',source_refs=[ref(self.nodes[1]),self.nodes[1]['body']['definition_ref']]+pins,return_criteria=['gate:builder'])
        reviewer,binding=self.bind(evaluation);self.dispatch(evaluation,reviewer);run,_,_=self.claim(evaluation,reviewer,binding);self.ok(self.call(self.start_request(evaluation,reviewer,run)));run=self.attempt(run['uuid'])
        args=dict(evaluation_assignment_uuid=evaluation['uuid'],subject_refs=pins,subject_digest=digest(pins),reviewer_actor_uuid=reviewer['uuid'])
        self.ok(self.call(self.request('review.attempt_add',args,reviewer)))
        evidence=self.saved({'observed':'A11 causal repair fixture'});path=Path(evaluation['body']['report_path']);path.parent.mkdir(parents=True,exist_ok=True);path.write_text('Exact raw causal finding')
        report=self.saved(dict(evaluation_assignment_ref=ref(evaluation),evaluation_attempt_ref=ref(run),reviewer_actor_uuid=reviewer['uuid'],subject_refs=pins,subject_digest=digest(pins),independent=True,mode='builder',evidence_refs=[ref(evidence)],report_path=str(path),report_file_sha256=file_hash(path)))
        report['writer']=seed.writer(reviewer);self.fx.save(report)
        body=dict(subject_refs=pins,rule_source_ref=ref(self.fx.authority),evidence_refs=[ref(evidence)],impact='material',confidence='high',state='open',description='Exact fixture obligation',repair_ref=None,disposition='pending')
        response=self.ok(self.call(self.request('review.finding_add',{**args,'body':body,'report_ref':ref(report)},reviewer)));self.refresh();finding=next(x for x in self.items if x['kind']=='finding' and ref(x) in response['changed_refs'])
        data={**report['body']['content'],'verdict':'findings','finding_refs':[ref(finding)]}
        result_report=self.saved(data);result_report['writer']=seed.writer(reviewer);self.fx.save(result_report)
        response=self.ok(self.call(self.request('review.result_record',{**args,'verdict':'findings','finding_refs':[ref(finding)],'report_ref':ref(result_report)},reviewer)))
        self.refresh();causal_gate=next(x for x in self.items if x['kind']=='review' and ref(x) in response['changed_refs'])
        self.return_run(evaluation,reviewer,run,[result_report])
        held=self.refuse(self.accept_request(pins,[causal_gate]),'MISSING_EVIDENCE');self.assertIn('Material finding',held['message'])
        directive=self.saved(dict(kind='repair_obligation',subject_refs=pins,causal_finding_ref=ref(finding),repair_scope='Bounded replacement output'))
        repair_args=dict(subject_refs=pins,subject_digest=digest(pins),gate_refs=[ref(causal_gate)],authority_ref=ref(self.fx.authority),original_instruction_ref=ref(directive),repair_scope='Bounded replacement output',causal_finding_ref=ref(finding))
        receipt=self.ok(self.call(self.request('workflow.rework_add',repair_args)));self.refresh();obligation=next(x for x in self.items if x['kind']=='content' and ref(x) in receipt['changed_refs'])
        edges=[x for x in self.items if x['kind']=='edge' and x['body']['edge_kind']=='repair_of'];self.assertEqual(len(edges),len(pins))
        repair_job,_=self.publish(3,source_refs=[ref(self.nodes[3]),self.nodes[3]['body']['definition_ref'],ref(obligation)])
        builder,bind=self.bind(repair_job);self.dispatch(repair_job,builder);repair_run,_,_=self.claim(repair_job,builder,bind);repair_run,repaired,_=self.return_run(repair_job,builder,repair_run);repair_pins=self.scope(repair_run)
        fresh,_=self.publish(2,'evaluation',source_refs=[ref(self.nodes[2]),self.nodes[2]['body']['definition_ref']]+repair_pins,return_criteria=['gate:builder'])
        validator,bind=self.bind(fresh);self.dispatch(fresh,validator);v,_,_=self.claim(fresh,validator,bind);self.ok(self.call(self.start_request(fresh,validator,v)));v=self.attempt(v['uuid'])
        check=dict(evaluation_assignment_uuid=fresh['uuid'],subject_refs=repair_pins,subject_digest=digest(repair_pins),reviewer_actor_uuid=validator['uuid']);self.ok(self.call(self.request('review.attempt_add',check,validator)))
        path=Path(fresh['body']['report_path']);path.parent.mkdir(parents=True,exist_ok=True);path.write_text('Exact independent repair validation')
        proof=self.saved(dict(evaluation_assignment_ref=ref(fresh),evaluation_attempt_ref=ref(v),reviewer_actor_uuid=validator['uuid'],subject_refs=repair_pins,subject_digest=digest(repair_pins),independent=True,mode='builder',evidence_refs=[ref(evidence)],report_path=str(path),report_file_sha256=file_hash(path)))
        proof['writer']=seed.writer(validator);self.fx.save(proof)
        disposition={**body,'state':'validated','repair_ref':ref(repaired[0]),'disposition':'Both repaired gates current'}
        request=self.request('review.finding_disposition',{**check,'body':disposition,'finding_refs':[ref(finding)],'report_ref':ref(proof)},validator)
        self.refuse(request,'MISSING_EVIDENCE')
        gates=self.two_gates(repair_pins,3,recheck=True);self.ok(self.call(self.accept_request(repair_pins,gates)))
        receipt=self.ok(self.call(self.request('review.finding_disposition',{**check,'body':disposition,'finding_refs':[ref(finding)],'report_ref':ref(proof)},validator)));self.refresh()
        final=next(x for x in self.items if x['uuid']==finding['uuid']);self.assertEqual(final['body']['state'],'validated');self.assertIn(finding,self.ticket['revisions']);self.assertEqual(final['body']['subject_refs'],pins)
        self.assertEqual(self.ok(self.call(self.request('record.get',dict(uuid=obligation['uuid'],fields=['body']))))['rows'][0]['fields']['body']['content']['causal_finding_ref'],ref(finding))

    def test_early_published_next_slice_cannot_start_before_exact_parent_acceptance(self):
        original,_=self.publish();producer,binding=self.bind(original);self.dispatch(original,producer);run,_,_=self.claim(original,producer,binding)
        following,_=self.publish(1);worker,bind=self.bind(following);self.dispatch(following,worker);next_run,_,_=self.claim(following,worker,bind)
        self.refuse(self.start_request(following,worker,next_run),'DEPENDENCY_NOT_RELEASED')
        run,outputs,_=self.return_run(original,producer,run);pins=self.scope(run);gates=self.two_gates(pins,2);self.ok(self.call(self.accept_request(pins,gates)))
        # Definitions are immutable. An early job that omitted the receipt cannot
        # silently gain it merely because an acceptance later became available.
        self.refuse(self.start_request(following,worker,next_run),'DEPENDENCY_NOT_RELEASED')

    def test_raw_requests_remain_immutable_when_caller_mutates_args(self):
        req=self.request('assignment.entries',dict(uuid=self.fx.assignment['uuid']));self.call(req);recorded=copy.deepcopy(self.raw[-1]);req['args']['uuid']=uid()
        self.assertEqual(recorded,self.raw[-1]);self.assertEqual(digest(json.loads(recorded['request_bytes_utf8'])),recorded['request_sha256'])


class ChildManagerAcceptanceTests(unittest.TestCase):
    """A11 freshness when the responsible plan owner has an actual runtime.

    A focused standalone case (not an AcceptanceTests subclass) so the inherited
    suite is not rerun against the alternate fixture.
    """
    for _name in ('ok','refresh','request','saved','publish','runtime','dispatch','claim_request','claim','start_request','attempt','refuse','ready'):
        locals()[_name]=getattr(claims.ClaimsTests,_name)
    for _name in ('call','bind','retain','tearDown','return_run','returned','scope','prepare_evaluation','evaluate','accept_request','two_gates','project','bind_runtime','evaluation_ready','evaluation_job','initialize_child_manager'):
        locals()[_name]=getattr(AcceptanceTests,_name)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.initialize_child_manager(Path(self.tmp.name))

    def test_manager_runtime_contamination_refused(self):
        job,producer,attempt,outputs=self.returned();pins=self.scope(attempt)
        evaluation,_=self.evaluation_job(1,pins,'builder')
        reviewer,run=self.evaluation_ready(evaluation,self.fx.actor['body']['runtime_id'])
        args=dict(evaluation_assignment_uuid=evaluation['uuid'],subject_refs=pins,subject_digest=digest(pins),reviewer_actor_uuid=reviewer['uuid'])
        self.refuse(self.request('review.attempt_add',args,reviewer),'FORBIDDEN')
        # A genuinely distinct runtime still provides a fresh evaluator.
        distinct,_=self.evaluation_job(2,pins,'orchestrator')
        reviewer2,run2=self.evaluation_ready(distinct,'fixture:distinct-evaluator')
        args2=dict(evaluation_assignment_uuid=distinct['uuid'],subject_refs=pins,subject_digest=digest(pins),reviewer_actor_uuid=reviewer2['uuid'])
        self.ok(self.call(self.request('review.attempt_add',args2,reviewer2)))
        self.assertNotEqual(binding.runtime_identity(reviewer),binding.runtime_identity(reviewer2))


if __name__=='__main__':unittest.main()
