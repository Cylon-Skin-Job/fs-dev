"""A10 exact public job/claim/start lifecycle on real disposable POSIX stores."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from support import Fixture, CHECKOUT, CLI, current, read_generation, uid, ref, envelope, file_hash, encode
from core.commands import INSTALLED, REGISTRY
from core.schema import named
from core.store import digest
from core.runtime_binding import ATTEMPT_GRANTS


class ClaimsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.fx=Fixture(self.tmp.name);self.raw=[]
        self.fx.actor['body']['granted_operations']=sorted(INSTALLED);self.fx.save(self.fx.actor)
        self.fx.run=self.call;self.ok(self.fx.create('A10 disposable saved-local fixture'))
        self.ok(self.call(self.fx.seed()));self.refresh()

    def tearDown(self):
        path=os.environ.get('LP_A10_REPORT')
        if path:
            self.refresh();p=Path(path);rows=json.loads(p.read_text()) if p.exists() else []
            prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text())
            rows.append(dict(test=self.id(),raw=self.raw,readback=dict(plan=self.plan,tickets=self.ts,prepared=prepared,plan_sha256=file_hash(self.folder/'plan.json'),view_hashes={k:file_hash(self.folder/k) for k in prepared['view_hashes']}),limits='Disposable saved-local fixture IDs and proof envelopes are not real native identities/starts. Every call is actual subprocess/public CLI/local POSIX publication.'))
            p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(encode(rows))
        self.tmp.cleanup()

    def call(self,request,extra=None,cwd=CHECKOUT):
        path=self.fx.root/('request-'+uid()+'.json');path.write_bytes(encode(request))
        argv=[sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)]
        proc=subprocess.run(argv,cwd=cwd,env={**os.environ,**(extra or {})},capture_output=True,text=True)
        self.raw.append(dict(argv=argv,cwd=str(cwd),env_overrides=extra or {},request=request,request_sha256=file_hash(path),stdout=proc.stdout,stderr=proc.stderr,exit=proc.returncode))
        if not proc.stdout:raise AssertionError(proc.stderr)
        value=json.loads(proc.stdout);named(value,'response.schema.json');return proc.returncode,value

    def ok(self,result):
        code,value=result;self.assertEqual(code,0,value);return value

    def refresh(self):
        self.plan,self.ts,self.folder=read_generation(self.fx.home);self.ticket=next(iter(self.ts.values()));self.items=current(self.ticket)
        self.nodes=[x for x in self.items if x['kind']=='workflow_node' and x['body']['node_kind']=='autonomous']

    def request(self,op,args,actor=None,key=None,ticket=True):
        self.refresh();scope=dict(plan_uuid=self.plan['root_uuid'],include_history=False)
        if ticket:scope['ticket_uuid']=self.ticket['root_uuid']
        r=dict(interface_version=1,tool=REGISTRY[op]['tool'],operation=op,args=args,scope=scope,actor_binding_ref=ref(actor or self.fx.actor))
        if r['tool'] in ('db.mutate','db.transaction'):
            expected={x['uuid']:x['revision_uuid'] for x in current(self.plan)+(self.items if ticket else [])}
            for p in (self.fx.root/'.evidence').glob('*.json'):
                e=json.loads(p.read_text());expected.setdefault(e['uuid'],e['revision_uuid'])
            r.update(expected=expected,expected_plan_revision_uuid=self.plan['root_revision_uuid'],idempotency_key=key or uid())
            if op=='transaction.apply':args['expected']=expected
        return r

    def saved(self,content,title='Saved fixture proof'):
        return self.fx.save(envelope('content',dict(title=title,category_uuid=uid(),format='json',content=content,authority='active_code_constraint',state='active',item_uuids=[]),self.fx.writer))

    def publish(self,node=0,work='slice',**overrides):
        b={**self.fx.assignment['body'],'ticket_uuid':self.ticket['root_uuid'],'node_uuid':self.nodes[node]['uuid'],'role':'mc-spec-slice-builder' if work=='slice' else 'clean-room-reviewer',
           'eligible_actor_uuid':None,'manager_uuid':self.fx.actor['uuid'],'work_kind':work,'report_path':str(self.fx.home/'reports'/uid()),'return_criteria':['A10 exact assigned work'],'source_refs':[ref(self.nodes[node]),self.nodes[node]['body']['definition_ref']]}
        b.update(overrides);req=self.request('assignment.publish',dict(body=b,authority_ref=ref(self.fx.authority)))
        receipt=self.ok(self.call(req));self.refresh();job=next(x for x in self.items if x['kind']=='assignment' and ref(x) in receipt['changed_refs']);return job,req

    def bind(self,job,**overrides):
        identity=uid();proof=dict(actual_cwd=str(CHECKOUT),permissions='danger-full-access',runtime_kind='child',runtime_id='fixture:'+identity,parent_actor_uuid=self.fx.actor['uuid'],
            source_checkout=job['body']['source_checkout'],source_branch=job['body']['source_branch'],source_head=job['body']['source_head'],provenance='trusted-local-fixture')
        binding=self.saved(proof);b=dict(role=job['body']['role'],runtime_kind='child',runtime_id=proof['runtime_id'],host_id=None,parent_actor_uuid=self.fx.actor['uuid'],actual_cwd=str(CHECKOUT),
            binding_evidence_ref=ref(binding),assignment_refs=[ref(job)],granted_operations=sorted(ATTEMPT_GRANTS),state='active');b.update(overrides)
        self.ok(self.call(self.request('actor.bind',dict(body=b,binding_evidence_ref=ref(binding),authority_ref=ref(self.fx.authority)))))
        self.refresh();actor=next(x for x in current(self.plan) if x['kind']=='actor' and x['body']['binding_evidence_ref']==ref(binding));return actor,binding

    def runtime(self,kind,job,actor,attempt=None,**fields):
        data=dict(proof_kind=kind,assignment_ref=ref(job),actor_uuid=actor['uuid'],runtime_kind=actor['body']['runtime_kind'],runtime_id=actor['body']['runtime_id'],provenance='trusted-local-fixture')
        if attempt:data['attempt_ref']=ref(attempt)
        data.update(fields);return self.saved(data)

    def dispatch(self,job,actor,result='dispatched'):
        proof=self.runtime('dispatch',job,actor,result=result,supplied_assignment_sha256=digest(job))
        req=self.request('run.dispatch_record',dict(assignment_uuid=job['uuid'],evidence_refs=[ref(proof)],summary='Fixture dispatch '+result))
        return self.ok(self.call(req)),req

    def claim_request(self,job,actor,binding,**kwargs):
        return self.request('assignment.claim',dict(assignment_ref=ref(job),actor_uuid=actor['uuid'],binding_evidence_ref=ref(binding),prerequisite_refs=job['body']['prerequisite_refs'],**kwargs),actor)

    def claim(self,job,actor,binding):
        req=self.claim_request(job,actor,binding);receipt=self.ok(self.call(req));self.refresh();attempt=next(x for x in self.items if x['kind']=='attempt' and ref(x) in receipt['changed_refs'])
        context=json.loads(receipt['continuation']);self.assertEqual(context['stored_briefing'],job['body']);self.assertEqual(context['attempt_ref'],ref(attempt));return attempt,receipt,req

    def start_request(self,job,actor,attempt,**fields):
        proof=self.runtime('start_ack',job,actor,attempt,acknowledged=True,loaded_assignment_sha256=digest(job),loaded_procedure_sha256=job['body']['procedure_sha256'],source_pins=job['body']['source_refs'])
        proof['body']['content'].update(fields);self.fx.save(proof)
        return self.request('run.start_record',dict(assignment_uuid=job['uuid'],attempt_uuid=attempt['uuid'],evidence_refs=[ref(proof)],summary='Fixture loaded exact stored briefing'),actor)

    def attempt(self,identity):
        self.refresh();return next(x for x in self.items if x['uuid']==identity)

    def refuse(self,req,code):
        self.refresh();before=(self.plan['root_revision_uuid'],file_hash(self.folder/'plan.json'),file_hash(self.folder/'plan.HTML'))
        exit,value=self.call(req);self.assertEqual(exit,2,value);self.assertEqual(value['code'],code,value);self.assertEqual(value['commit_state'],'nonmutation')
        self.refresh();self.assertEqual(before,(self.plan['root_revision_uuid'],file_hash(self.folder/'plan.json'),file_hash(self.folder/'plan.HTML')))
        return value

    def ready(self,node=0,work='slice'):
        job,_=self.publish(node,work);actor,binding=self.bind(job);self.dispatch(job,actor);attempt,receipt,req=self.claim(job,actor,binding);return job,actor,binding,attempt

    def test_publish_dispatch_claim_stored_prompt_start_checkpoint_and_replay(self):
        job,actor,binding,attempt=self.ready();read=self.ok(self.call(self.request('assignment.prompt_get',dict(uuid=job['uuid']),actor)))
        self.assertEqual(read['details']['stored_briefing'],job['body']);self.assertIsNone(attempt['body']['start_ref']);self.assertEqual(attempt['body']['state'],'claimed')
        req=self.start_request(job,actor,attempt);receipt=self.ok(self.call(req));running=self.attempt(attempt['uuid']);self.assertEqual(running['body']['state'],'running');self.assertIsNotNone(running['body']['start_ref'])
        self.assertEqual(self.ok(self.call(req)),receipt)
        proof=self.saved({'checkpoint':'end turn','next_action':'resume current attempt'})
        r=self.request('run.checkpoint',dict(assignment_uuid=job['uuid'],attempt_uuid=attempt['uuid'],evidence_refs=[ref(proof)],summary='End turn is resumable'),actor)
        self.ok(self.call(r));latest=self.attempt(attempt['uuid']);self.assertEqual(latest['body']['state'],'running');self.assertEqual(latest['body']['return_refs'],[]);self.assertIsNotNone(latest['body']['last_checkpoint_at'])
        self.assertEqual(latest['body']['last_progress_at'],running['body']['last_progress_at'])
        self.assertEqual(self.ok(self.call(req)),receipt)

    def test_exact_role_root_job_revision_prerequisite_and_binding_refusals(self):
        job,_=self.publish();actor,binding=self.bind(job);self.dispatch(job,actor)
        wrong=self.claim_request(job,actor,binding);wrong['args']['actor_uuid']=self.fx.actor['uuid'];self.refuse(wrong,'FORBIDDEN')
        wrong=self.claim_request(job,actor,binding);wrong['args']['assignment_ref']['revision_uuid']=uid();self.refuse(wrong,'SOURCE_UNVERIFIED')
        wrong=self.claim_request(job,actor,binding);wrong['args']['prerequisite_refs']=[ref(self.fx.authority)];self.refuse(wrong,'DEPENDENCY_NOT_RELEASED')
        wrong=self.claim_request(job,actor,binding);wrong['args']['assignment_ref']=ref(self.ticket['revisions'][0]);self.refuse(wrong,'FORBIDDEN')
        proof=copy.deepcopy(binding);proof['body']['content']['source_head']='wrong-head';self.fx.save(proof)
        wrong=self.claim_request(job,actor,binding);self.refuse(wrong,'SOURCE_UNVERIFIED');self.fx.save(binding)
        bad={**job['body'],'role':'wrong-role','eligible_actor_uuid':None};external=self.fx.save(envelope('assignment',bad,self.fx.writer))
        wrong=self.claim_request(job,actor,binding);wrong['args']['assignment_ref']=ref(external);self.refuse(wrong,'FORBIDDEN')
        wrong=self.claim_request(job,actor,binding);wrong['args']['binding_evidence_ref']=ref(self.fx.authority);self.refuse(wrong,'FORBIDDEN')
        wrong=self.request('assignment.publish',dict(body={**job['body'],'node_uuid':self.ticket['root_uuid']},authority_ref=ref(self.fx.authority)));self.refuse(wrong,'INVALID_TRANSITION')
        wrong=self.request('assignment.publish',dict(body={**job['body'],'write_paths':['/tmp/unassigned']},authority_ref=ref(self.fx.authority)));self.refuse(wrong,'FORBIDDEN')

    def test_wrong_role_cwd_prerequisite_and_ephemeral_claim_are_refused(self):
        job,_=self.publish();actor,binding=self.bind(job);self.dispatch(job,actor)
        malformed=self.request('actor.bind',dict(body={**actor['body'],'role':'wrong role'},binding_evidence_ref=ref(binding),authority_ref=ref(self.fx.authority)))
        self.refuse(malformed,'FORBIDDEN')
        req=self.claim_request(job,actor,binding);code,value=self.call(req,cwd=self.fx.root)
        self.assertEqual((code,value['code']),(2,'SOURCE_UNVERIFIED'))
        pending=self.fx.save(envelope('content',dict(title='Unreleased prerequisite',category_uuid=uid(),format='plain',content='pending',authority='proposal',state='pending',item_uuids=[]),self.fx.writer))
        body={**job['body'],'node_uuid':self.nodes[1]['uuid'],'source_refs':[ref(self.nodes[1]),self.nodes[1]['body']['definition_ref']],'prerequisite_refs':[ref(pending)]}
        self.refuse(self.request('assignment.publish',dict(body=body,authority_ref=ref(self.fx.authority))),'DEPENDENCY_NOT_RELEASED')
        another,_=self.publish(1);proof=self.saved(dict(actual_cwd=str(CHECKOUT),runtime_kind='ephemeral',permissions='danger-full-access'))
        ephemeral=dict(role=another['body']['role'],runtime_kind='ephemeral',runtime_id=None,host_id=None,parent_actor_uuid=None,actual_cwd=str(CHECKOUT),binding_evidence_ref=ref(proof),assignment_refs=[ref(another)],granted_operations=['assignment.claim'],state='active')
        self.ok(self.call(self.request('actor.bind',dict(body=ephemeral,binding_evidence_ref=ref(proof),authority_ref=ref(self.fx.authority)))))
        self.refresh();unknown=next(x for x in current(self.plan) if x['kind']=='actor' and x['body']['binding_evidence_ref']==ref(proof))
        self.refuse(self.claim_request(another,unknown,proof),'SOURCE_UNVERIFIED')

    def test_release_requires_manager_exact_inactive_proof_and_linked_claim(self):
        job,actor,binding,attempt=self.ready();new,new_binding=self.bind(job);self.dispatch(job,new)
        proof=self.runtime('interrupt_ack',job,actor,attempt,manager_uuid=self.fx.actor['uuid'],acknowledged=True)
        args=dict(assignment_ref=ref(job),actor_uuid=actor['uuid'],inactive_or_interrupt_ack_ref=ref(proof),predecessor_attempt_ref=ref(attempt))
        self.refuse(self.request('assignment.release',args,actor),'FORBIDDEN')
        self.ok(self.call(self.request('assignment.release',args)));old=self.attempt(attempt['uuid']);self.assertEqual(old['body']['state'],'abandoned')
        self.refuse(self.claim_request(job,new,new_binding),'CLAIM_CONFLICT')
        req=self.claim_request(job,new,new_binding,predecessor_attempt_ref=ref(old),inactive_or_interrupt_ack_ref=ref(proof))
        receipt=self.ok(self.call(req));context=json.loads(receipt['continuation']);replacement=self.attempt(context['attempt_ref']['entry_uuid'])
        self.assertEqual(replacement['body']['predecessor_attempt_uuid'],old['uuid']);self.assertEqual(self.ok(self.call(req)),receipt)

    def test_exclusive_slot_exact_retry_and_concurrent_claims(self):
        job,_=self.publish();a,b=self.bind(job);c,d=self.bind(job);self.dispatch(job,a);self.dispatch(job,c)
        ra=self.claim_request(job,a,b);rc=self.claim_request(job,c,d)
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(self.call,[ra,rc]))
        self.assertEqual(sorted(code for code,_ in results),[0,2]);failure=next(v for code,v in results if code);self.assertIn(failure['code'],('REVISION_CONFLICT','CLAIM_CONFLICT'))
        winner=ra if results[0][0]==0 else rc;loser=(c,d) if results[0][0]==0 else (a,b)
        receipt=next(v for code,v in results if not code);self.assertEqual(self.ok(self.call(winner)),receipt)
        self.refuse(self.claim_request(job,*loser),'CLAIM_CONFLICT');self.refresh();self.assertEqual(len([x for x in self.items if x['kind']=='attempt']),1)
        changed=copy.deepcopy(winner);changed['args']['prerequisite_refs']=[ref(self.fx.authority)];self.refuse(changed,'IDEMPOTENCY_MISMATCH')

    def test_failed_dispatch_and_unacknowledged_start_never_running(self):
        job,_=self.publish();actor,binding=self.bind(job);self.dispatch(job,actor,'failed');self.refuse(self.claim_request(job,actor,binding),'MISSING_EVIDENCE')
        self.dispatch(job,actor);attempt,receipt,claim=self.claim(job,actor,binding);self.refuse(self.start_request(job,actor,attempt,acknowledged=False),'MISSING_EVIDENCE')
        self.refuse(self.start_request(job,actor,attempt,loaded_assignment_sha256='0'*64),'MISSING_EVIDENCE')
        self.assertEqual(self.ok(self.call(claim)),receipt);self.assertEqual(self.attempt(attempt['uuid'])['body']['state'],'claimed')

    def test_evaluator_owns_evaluation_slot_and_manager_verified_replacement(self):
        job,actor,binding,attempt=self.ready(work='evaluation');replacement,new_binding=self.bind(job);self.dispatch(job,replacement)
        self.refuse(self.claim_request(job,replacement,new_binding),'CLAIM_CONFLICT')
        proof=self.runtime('inactive',job,actor,attempt,manager_uuid=self.fx.actor['uuid'],inactive=False)
        args=dict(assignment_ref=ref(job),actor_uuid=replacement['uuid'],inactive_or_interrupt_ack_ref=ref(proof),predecessor_attempt_ref=ref(attempt))
        self.refuse(self.request('assignment.handoff',args),'STOP_UNCONFIRMED')
        proof['body']['content']['inactive']=True;self.fx.save(proof);args['inactive_or_interrupt_ack_ref']=ref(proof)
        r=self.request('assignment.handoff',args);receipt=self.ok(self.call(r));self.assertEqual(self.ok(self.call(r)),receipt)
        old=self.attempt(attempt['uuid']);self.assertEqual(old['body']['state'],'abandoned')
        self.refresh();new=next(x for x in self.items if x['kind']=='attempt' and x['body']['predecessor_attempt_uuid']==old['uuid']);self.assertEqual(new['body']['actor_uuid'],replacement['uuid']);self.assertEqual(new['body']['state'],'claimed');self.assertIsNone(new['body']['start_ref'])
        retained=[x for x in self.ticket['revisions'] if x['revision_uuid']==attempt['revision_uuid']];self.assertEqual(retained,[attempt]);self.assertEqual(old['body']['claim_ref'],attempt['body']['claim_ref'])
        self.ok(self.call(self.start_request(job,replacement,new)))

    def test_return_requires_frozen_report_recipient_checks_and_is_not_checkpoint(self):
        job,actor,binding,attempt=self.ready();self.ok(self.call(self.start_request(job,actor,attempt)));attempt=self.attempt(attempt['uuid'])
        report=self.saved({'report':'frozen A10 deliverable','digest':'fixture'},'Frozen report')
        checks=dict(commands=['public checks'],results=['pass'],warnings=[],skips=[],deviations=[])
        path=Path(job['body']['report_path']);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(encode(report))
        proof=self.runtime('return',job,actor,attempt,report_file_sha256=file_hash(path),recipient_actor_uuid=self.fx.actor['uuid'],deliverable_refs=[ref(report)],return_checks=checks,report_path=job['body']['report_path'])
        r=self.request('run.return_record',dict(assignment_uuid=job['uuid'],attempt_uuid=attempt['uuid'],evidence_refs=[ref(proof)],summary='Frozen return',deliverable_refs=[ref(report)],return_checks=checks),actor)
        wrong=copy.deepcopy(r);wrong['args']['return_checks']['results']=['different'];self.refuse(wrong,'MISSING_EVIDENCE')
        receipt=self.ok(self.call(r));self.assertEqual(self.ok(self.call(r)),receipt);done=self.attempt(attempt['uuid']);self.assertEqual(done['body']['state'],'returned');self.assertEqual(done['body']['return_refs'],[ref(report)])
        self.assertFalse(any(x['kind']=='acceptance' for x in self.items))

    def test_nested_claim_cannot_borrow_manager_or_bypass_exact_job(self):
        job,_=self.publish();actor,binding=self.bind(job);self.dispatch(job,actor)
        args=self.claim_request(job,actor,binding)['args'];r=self.request('transaction.apply',dict(operations=[dict(operation='assignment.claim',args=args)],expected={}),actor)
        receipt=self.ok(self.call(r));self.assertEqual(json.loads(receipt['continuation'])['contexts'][0]['stored_briefing'],job['body']);self.refresh();self.assertEqual(len([x for x in self.items if x['kind']=='attempt']),1)
        self.assertEqual(self.ok(self.call(r)),receipt)
        other=copy.deepcopy(r);other['idempotency_key']=uid();other['expected_plan_revision_uuid']=self.plan['root_revision_uuid'];other['expected']={x['uuid']:x['revision_uuid'] for x in current(self.plan)+self.items}
        for p in (self.fx.root/'.evidence').glob('*.json'):
            x=json.loads(p.read_text());other['expected'].setdefault(x['uuid'],x['revision_uuid'])
        other['args']['expected']=other['expected'];self.refuse(other,'CLAIM_CONFLICT')


if __name__=='__main__':unittest.main()
