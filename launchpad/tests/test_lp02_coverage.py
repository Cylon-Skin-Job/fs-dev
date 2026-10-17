"""A06 public subprocess coverage, explicit merge and reviewed approvals."""
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from support import Fixture,CHECKOUT,CLI,current,read_generation,uid,ref,envelope,file_hash,encode
from core.store import digest
from core.commands import INSTALLED,REGISTRY
import test_lp02_records as records_tests


# Live checkout HEAD, so the source oracle matches sources.py's runtime observation
# rather than a frozen revision literal (HEAD-independent).
HEAD=subprocess.check_output(['git','rev-parse','HEAD'],cwd=CHECKOUT,text=True).strip()


class CoverageTests(unittest.TestCase):
    ok=records_tests.RecordsTests.ok;refresh=records_tests.RecordsTests.refresh;request=records_tests.RecordsTests.request
    create=records_tests.RecordsTests.create;reject=records_tests.RecordsTests.reject;inspect=records_tests.RecordsTests.inspect

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.fx=Fixture(self.tmp.name)
        self.fx.actor['body']['granted_operations']=sorted(INSTALLED);self.fx.save(self.fx.actor)
        self.raw=[]
        def audited(request):
            from core.schema import named
            path=self.fx.root/('request-'+uid()+'.json');path.write_bytes(encode(request))
            proc=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)],cwd=CHECKOUT,capture_output=True,text=True)
            self.assertTrue(proc.stdout,proc.stderr);value=json.loads(proc.stdout);named(value,'response.schema.json')
            self.raw.append(dict(request=copy.deepcopy(request),exit=proc.returncode,response=copy.deepcopy(value),stdout=proc.stdout,stderr=proc.stderr,wire_bytes=len(proc.stdout.encode('utf-8'))));return proc.returncode,value
        self.fx.run=audited
        self.ok(self.fx.create('A06 disposable item accounting'));self.ok(self.fx.run(self.fx.seed(scope=['Scope A','Scope B','Scope C'],todo=['Check D','Check E'])));self.refresh()
        self.extra=[]

    def tearDown(self):
        report=os.environ.get('LP_A06_REPORT')
        if report:
            path=Path(report);cases=json.loads(path.read_text()) if path.exists() else [];self.refresh()
            cases.append(dict(test=self.id(),requests=self.raw,external_evidence=[json.loads(p.read_text()) for p in (self.fx.root/'.evidence').glob('*.json')],final_readback=dict(plan=self.plan,tickets=self.ts,plan_sha256=file_hash(self.folder/'plan.json'),prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text()))));path.write_bytes(encode(cases))
        self.tmp.cleanup()

    def evidence(self,title,content,authority='active_code_constraint',items=None,writer=None):
        item=self.fx.save(envelope('content',dict(title=title,category_uuid=uid(),format='json' if isinstance(content,dict) else 'plain',content=content,authority=authority,state='active',item_uuids=items or []),writer or self.fx.writer));self.extra.append(item);return item

    def req(self,op,args,key=None):
        request=self.request(op,args,key)
        if request['tool'] in ('db.mutate','db.transaction'):
            for item in self.extra:request['expected'][item['uuid']]=item['revision_uuid']
            if op=='transaction.apply':request['args']['expected']=copy.deepcopy(request['expected'])
        return request

    def rows(self,target,dispositions=None):
        result=[]
        for index,source in enumerate(x for x in self.items if x['kind']=='source_item'):
            kind=(dispositions or ['carried']*5)[index]
            decision=None;dest=[]
            if kind in ('dropped','deferred'):
                saved=self.evidence('Owner '+kind,'Explicit disposable owner disposition: '+kind,'owner_decision',[source['uuid']]);decision={**ref(saved),'scope_item_uuids':[source['uuid']]}
            else:dest=[{**ref(target),'scope_item_uuids':[source['uuid']]}]
            result.append(dict(source_item_uuid=source['uuid'],source_revision_uuid=source['body']['source']['revision_uuid'],disposition=kind,note='Actual '+kind+' item disposition',destination_refs=dest,disposition_decision=decision))
        return result

    def route(self,ops,rows,apply=True):
        expected=self.req('transaction.apply',dict(operations=ops))['expected'];pins=[]
        for sub in ops:
            for pin in sub['args'].get('source_refs',[]):
                if pin not in pins:pins.append(pin)
        args=dict(source_refs=pins,proposed_operations=ops,target_expected=expected,coverage_rows=rows)
        preview=self.ok(self.fx.run(self.req('intake.route_preview',args)))
        req=self.req('intake.route',dict(preview_digest=preview['preview_digest'],operations=ops,coverage_rows=rows,authority_refs=[ref(self.fx.authority)]));req['expected']=expected
        if not apply:return preview,req
        result=self.ok(self.fx.run(req));self.refresh();return result,req

    def ledger(self):
        result=self.ok(self.fx.run(self.req('record.get',dict(uuid=self.ticket['root_uuid'],fields=['body']))))
        return result['details']['source_ledger']

    def validation(self):
        return self.ok(self.fx.run(self.req('validation.record',dict(record_refs=[ref(self.capture)],checks=['item coverage'],scope=dict(plan_uuid=self.fx.plan_id,ticket_uuid=self.ticket['root_uuid'],include_history=False),require_adoption=False))))

    def decision(self,title='Wiki-backed pending interpretation',item_ids=None):
        cat=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='decisions')
        body=dict(title=title,category_uuid=cat['uuid'],format='plain',content='An interpretation supported by source evidence',authority='proposal',state='pending',item_uuids=item_ids or [])
        self.ok(self.fx.run(self.req('decision.record',dict(body=body,source_refs=self.capture['source_refs'],item_uuids=body['item_uuids']))));self.refresh();return next(x for x in self.items if x['body'].get('title')==title)

    def present(self,entries):
        pins=[ref(x) for x in entries];proof=self.evidence('Actual displayed batch',dict(entry_refs=pins,batch_digest=digest(pins)))
        body=dict(entry_refs=pins,batch_digest=digest(pins),presentation_evidence_ref=ref(proof),state='pending',acceptance_ref=None)
        self.ok(self.fx.run(self.req('decision.present_batch',dict(body=body,authority_ref=ref(self.fx.authority)))));self.refresh()
        return next(x for x in self.items if x['kind']=='presented_batch' and x['body']==body)

    def approval(self,batch,scope=None,gate_mutate=None,instruction_kind='owner_decision'):
        scope=scope or [x['entry_uuid'] for x in batch['body']['entry_refs']];pins=[x for x in batch['body']['entry_refs'] if x['entry_uuid'] in scope]
        writer={**self.fx.writer,'actor_uuid':uid()};report=self.evidence('Actual independent exact-byte review','Explicit inspected disposable subject bytes',writer=writer)
        body=dict(assignment_uuid=uid(),attempt_uuid=uid(),subject_refs=pins,subject_digest=digest(pins),mode='A06 exact presented entries',reviewer_actor_uuid=writer['actor_uuid'],evidence_refs=[ref(report)],verdict='pass',finding_refs=[],report_ref=ref(report))
        if gate_mutate:gate_mutate(body,writer)
        gate=self.fx.save(envelope('review',body,writer));self.extra.append(gate)
        original=self.evidence('Original owner Approve all instruction',dict(kind='approve_presented_batch',presented_batch_ref=ref(batch),accepted_scope=scope,gate_refs=[ref(gate)]),instruction_kind)
        return self.req('decision.approve_batch',dict(presented_batch_ref=ref(batch),original_instruction_ref=ref(original),accepted_scope=scope))

    def test_all_five_dispositions_exact_actual_destination_decision_and_current_ticket(self):
        before=copy.deepcopy(self.capture);oldticket=copy.deepcopy(self.ticket);ids=self.capture['body']['item_uuids'];rows=self.rows(self.capture,['carried','adapted','changed','dropped','deferred'])
        body={**self.capture['body'],'content':'Explicit revised live scope with retained old source','item_uuids':ids[:3]}
        result,request=self.route([dict(operation='record.update',args=dict(uuid=self.capture['uuid'],body=body,source_refs=self.capture['source_refs']))],rows)
        ledger=self.ledger();self.assertTrue(ledger['complete']);self.assertFalse(ledger['mapping_is_delivery']);self.assertFalse(ledger['mapping_is_approval']);self.assertEqual(ledger['item_count'],5)
        self.assertEqual({x['fields']['body']['disposition'] for x in self.ok(self.fx.run(self.req('query.filter',dict(collection='coverage',fields=['body']))))['rows']},{'carried','adapted','changed','dropped','deferred'})
        for row in [x for x in self.items if x['kind']=='coverage']:
            for pin in row['body']['destination_refs']:self.assertEqual(pin['revision_uuid'],self.capture['revision_uuid']);self.assertEqual(pin['sha256'],digest(self.capture))
        self.assertEqual(self.inspect(before,True),before);self.assertEqual(self.ticket['root_uuid'],oldticket['root_uuid']);self.assertEqual(next(x for x in self.items if x['kind']=='ticket')['body']['seed_ref'],next(x for x in current(oldticket) if x['kind']=='ticket')['body']['seed_ref']);self.assertNotEqual(self.capture['revision_uuid'],before['revision_uuid'])
        self.assertEqual(self.ok(self.fx.run(request)),result);self.assertEqual(self.validation()['verdict'],'pass')

    def test_non_noop_merge_exact_prospective_coverage_identity_metadata_history_and_later_hold(self):
        source=copy.deepcopy(self.capture);target=self.create('Explicit merge destination');oldtarget=copy.deepcopy(target);rows=self.rows(target)
        body={**target['body'],'format':'plain','content':'Owner-selected rewritten combined scope, not concatenation','item_uuids':source['body']['item_uuids']}
        args=dict(uuid=source['uuid'],target_uuid=target['uuid'],reason='Explicit full item merge',source_refs=source['source_refs'],body=body)
        result,_=self.route([dict(operation='record.merge',args=args)],rows)
        target=next(x for x in self.items if x['uuid']==target['uuid']);self.assertNotEqual(target['body']['content'],oldtarget['body']['content']);self.assertEqual(target['uuid'],oldtarget['uuid']);self.assertEqual(target['created_at'],oldtarget['created_at']);self.assertEqual(target['extensions'],oldtarget['extensions']);self.assertEqual(self.capture,source)
        self.assertEqual(self.inspect(oldtarget,True),oldtarget);self.assertEqual(self.inspect(source,True),source);self.assertTrue(self.ledger()['complete']);self.assertEqual(len([x for x in self.items if x['kind']=='edge' and x['body']['edge_kind']=='supersedes']),1)
        self.assertTrue(self.ok(self.fx.run(self.req('record.get',dict(uuid=source['uuid']))))['details']['lineage']['fully_superseded'])
        prior_ticket=copy.deepcopy(next(x for x in self.items if x['kind']=='ticket'))
        self.ok(self.fx.run(self.req('record.update',dict(uuid=target['uuid'],body={**target['body'],'content':'Later material amendment'},source_refs=target['source_refs']))));self.refresh()
        self.assertFalse(self.ledger()['complete']);self.assertEqual(self.validation()['verdict'],'incomplete')
        old_read=self.ok(self.fx.run(self.req('record.get',dict(uuid=prior_ticket['uuid'],revision_uuid=prior_ticket['revision_uuid'],fields=['body','revision_uuid']))));self.assertEqual(old_read['rows'][0]['revision_uuid'],prior_ticket['revision_uuid']);self.assertFalse(old_read['details']['source_ledger']['complete']);self.assertNotEqual(old_read['details']['ledger_ticket_revision_uuid'],prior_ticket['revision_uuid'])

    def test_split_and_route_preserve_source_ids_exact_destination_scope(self):
        a=self.create('Split A');b=self.create('Split B');ids=self.capture['body']['item_uuids'];rows=self.rows(a)
        for index,row in enumerate(rows):row['destination_refs']=[{**ref(a if index<2 else b),'scope_item_uuids':[row['source_item_uuid']]}]
        cat=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='intent')
        ops=[dict(operation='record.update',args=dict(uuid=self.capture['uuid'],body={**self.capture['body'],'content':'Explicit split scope moved to two successors','item_uuids':[]},source_refs=self.capture['source_refs'])),dict(operation='record.update',args=dict(uuid=a['uuid'],body={**a['body'],'content':'Explicit part A','item_uuids':ids[:2]},source_refs=[])),dict(operation='record.update',args=dict(uuid=b['uuid'],body={**b['body'],'content':'Explicit part B','item_uuids':ids[2:]},source_refs=[]))]
        self.route(ops,rows);a=next(x for x in self.items if x['uuid']==a['uuid']);self.assertTrue(self.ledger()['complete'])
        old=copy.deepcopy(a);self.ok(self.fx.run(self.req('record.move_category',dict(uuid=a['uuid'],category_uuid=cat['uuid'],reason='Same logical route',source_refs=[]))));self.refresh();a=next(x for x in self.items if x['uuid']==old['uuid']);self.assertEqual(a['created_at'],old['created_at']);self.assertEqual(a['body']['item_uuids'],old['body']['item_uuids']);self.assertFalse(self.ledger()['complete'])

    def test_unmatched_partial_wrong_source_stale_destination_and_authority_refuse_no_mutation(self):
        target=self.create('Refused merge destination');rows=self.rows(target);body={**target['body'],'item_uuids':self.capture['body']['item_uuids'],'content':'Actual merge'}
        ops=[dict(operation='record.merge',args=dict(uuid=self.capture['uuid'],target_uuid=target['uuid'],reason='Account every item',source_refs=self.capture['source_refs'],body=body))]
        expected=self.req('transaction.apply',dict(operations=ops))['expected']
        variants=[]
        bad=copy.deepcopy(rows);bad[0]['source_revision_uuid']=uid();variants.append(bad)
        bad=copy.deepcopy(rows);bad[0]['destination_refs'][0]['sha256']='0'*64;variants.append(bad)
        bad=copy.deepcopy(rows);bad[0]['destination_refs'][0]['scope_item_uuids']=[];variants.append(bad)
        bad=copy.deepcopy(rows);bad[0]['note']=' ';variants.append(bad)
        variants += [rows[:-1],rows+[rows[0]]]
        for rowsbad in variants:self.reject(self.req('intake.route_preview',dict(source_refs=self.capture['source_refs'],proposed_operations=ops,target_expected=expected,coverage_rows=rowsbad)))
        self.assertFalse(self.ledger()['complete']);self.reject(self.req('record.merge',ops[0]['args']),'MISSING_EVIDENCE')
        self.reject(self.req('transaction.apply',dict(operations=ops)),'MISSING_EVIDENCE')
        _,apply=self.route(ops,rows,False);apply['args']['authority_refs']=[];self.reject(apply,'MISSING_EVIDENCE')
        _,stale=self.route(ops,rows,False);self.ok(self.fx.run(self.req('record.update',dict(uuid=target['uuid'],body={**target['body'],'content':'Intervening edit'},source_refs=[]))));self.refresh();self.reject(stale,'REVISION_CONFLICT')

    def test_removal_requires_actual_item_disposition_owner_decision_and_no_generic_bypass(self):
        ids=self.capture['body']['item_uuids'];body={**self.capture['body'],'item_uuids':ids[1:]};op=dict(operation='record.update',args=dict(uuid=self.capture['uuid'],body=body,source_refs=self.capture['source_refs']))
        self.reject(self.req('record.update',op['args']),'MISSING_EVIDENCE');self.reject(self.req('transaction.apply',dict(operations=[op])),'MISSING_EVIDENCE')
        rows=self.rows(self.capture,['dropped','carried','carried','carried','carried']);bad=copy.deepcopy(rows);bad[0]['disposition_decision']={**ref(self.fx.authority),'scope_item_uuids':[ids[0]]}
        expected=self.req('transaction.apply',dict(operations=[op]))['expected'];self.reject(self.req('intake.route_preview',dict(source_refs=self.capture['source_refs'],proposed_operations=[op],target_expected=expected,coverage_rows=bad)),'MISSING_EVIDENCE')
        self.route([op],rows);self.assertTrue(self.ledger()['complete'])
        for kind,body in [('coverage',rows[0]),('source_item',next(x for x in self.items if x['kind']=='source_item')['body']),('presented_batch',dict(entry_refs=[],batch_digest='0'*64,presentation_evidence_ref=ref(self.fx.authority),state='accepted',acceptance_ref=None))]:self.reject(self.req('record.create',dict(kind=kind,body=body,source_refs=[])),'FORBIDDEN')

    def test_wiki_inference_pending_reviewed_frozen_batch_late_items_and_material_edit(self):
        a=self.decision('Inference A');b=self.decision('Inference B');batch=self.present([a,b]);c=self.decision('Late inference C');approval=self.approval(batch)
        result=self.ok(self.fx.run(approval));self.refresh();accepted=next(x for x in self.items if x['kind']=='acceptance');self.assertEqual(accepted['body']['subject_refs'],[ref(a),ref(b)]);self.assertNotIn(c['uuid'],[x['entry_uuid'] for x in accepted['body']['subject_refs']]);self.assertEqual(self.ok(self.fx.run(approval)),result)
        current_a=next(x for x in self.items if x['uuid']==a['uuid']);self.assertEqual(current_a,a);self.assertEqual(a['body']['state'],'pending')
        self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=c['uuid']))))['details']['current_approval']['state'],'pending')
        self.ok(self.fx.run(self.req('record.update',dict(uuid=a['uuid'],body={**a['body'],'content':'Materially changed interpretation'},source_refs=a['source_refs']))));self.refresh();self.assertEqual(next(x for x in self.items if x['uuid']==accepted['uuid'])['body']['state'],'invalidated');self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=a['uuid']))))['details']['current_approval']['state'],'pending')
        self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=b['uuid']))))['details']['current_approval']['state'],'accepted')
        self.reject(self.req('record.update',dict(uuid=c['uuid'],body={**c['body'],'state':'active'},source_refs=c['source_refs'])),'FORBIDDEN')

    def test_changed_batch_subset_and_required_exact_original_review_guards_direct_nested(self):
        a=self.decision('Unchanged A');b=self.decision('Changed B');batch=self.present([a,b]);self.ok(self.fx.run(self.req('record.update',dict(uuid=b['uuid'],body={**b['body'],'content':'Changed after actual presentation'},source_refs=b['source_refs']))));self.refresh()
        self.reject(self.approval(batch),'REVISION_CONFLICT')
        cases=[dict(instruction_kind='active_code_constraint'),dict(gate_mutate=lambda body,writer:body.update(verdict='findings')),dict(gate_mutate=lambda body,writer:body.update(subject_digest='0'*64)),dict(gate_mutate=lambda body,writer:body.update(evidence_refs=[])),dict(gate_mutate=lambda body,writer:(writer.update(actor_uuid=self.fx.actor_id),body.update(reviewer_actor_uuid=self.fx.actor_id)))]
        for config in cases:
            req=self.approval(batch,[a['uuid']],**config);self.reject(req);self.reject(self.req('transaction.apply',dict(operations=[dict(operation='decision.approve_batch',args=req['args'])])))
        self.ok(self.fx.run(self.approval(batch,[a['uuid']])));self.refresh();accepted=next(x for x in self.items if x['kind']=='acceptance');self.assertEqual([x['entry_uuid'] for x in accepted['body']['subject_refs']],[a['uuid']])

    def test_approval_issue_resolution_supersession_same_atomic_commit_public_readback(self):
        decision=self.decision('Reviewed replacement decision');cat=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
        body=dict(title='Actual pending issue',category_uuid=cat['uuid'],format='plain',content='Need reviewed exact decision',authority='proposal',state='pending',item_uuids=[])
        self.ok(self.fx.run(self.req('issue.create',dict(body=body,source_refs=[],item_uuids=[]))));self.refresh();issue=next(x for x in self.items if x['body'].get('title')==body['title']);batch=self.present([decision]);approval=self.approval(batch)
        supersede=dict(operation='decision.supersede',args=dict(old_uuid=issue['uuid'],new_uuid=decision['uuid'],scope_item_uuids=[],authority_ref=ref(self.fx.authority),reverse_input=False))
        req=self.req('transaction.apply',dict(operations=[dict(operation='decision.approve_batch',args=approval['args']),supersede]));seq=self.plan['commit_seq'];result=self.ok(self.fx.run(req));self.refresh();self.assertEqual(self.plan['commit_seq'],seq+1);self.assertEqual(self.ok(self.fx.run(req)),result)
        details=self.ok(self.fx.run(self.req('record.get',dict(uuid=issue['uuid'],fields=['body']))))['details'];self.assertEqual(details['current_approval']['issue_state'],'resolved');self.assertTrue(details['lineage']['fully_superseded']);self.assertEqual(self.inspect(issue),issue)
        target=next(x for x in self.items if x['kind']=='ticket');self.assertTrue(all(ref(x) in target['body']['record_refs'] for x in self.items if x['kind'] in ('acceptance','presented_batch','edge')))

    def test_typed_presented_evidence_and_pending_shape_cannot_be_forged(self):
        a=self.decision();batch=self.present([a]);body=copy.deepcopy(batch['body'])
        for field,value in [('state','accepted'),('batch_digest','0'*64),('presentation_evidence_ref',ref(self.fx.authority)),('acceptance_ref',ref(self.fx.authority))]:
            bad={**body,field:value};self.reject(self.req('decision.present_batch',dict(body=bad,authority_ref=ref(self.fx.authority))))
        self.reject(self.req('record.update',dict(uuid=batch['uuid'],body=body,source_refs=[])),'FORBIDDEN')

    def test_seed_source_removal_requires_accounted_preview_and_preserves_old_item_definitions(self):
        original=copy.deepcopy(self.capture);source=next(x for x in self.items if x['kind']=='source_item' and x['body']['source_alias']=='todo-1')
        seedrequest=self.fx.seed(content='Revised source capture',scope=['New Scope A','New Scope B','New Scope C'],todo=['New Check D'])
        args={k:seedrequest['args'][k] for k in ('seed_ref','scope_items','checklist_items')};rows=self.rows(self.capture)
        for row in rows:
            item=next(x for x in self.items if x['uuid']==row['source_item_uuid'])
            if item['uuid']==source['uuid']:
                d=self.evidence('Explicit owner source removal','Drop exact old Check E','owner_decision',[item['uuid']]);row.update(disposition='dropped',destination_refs=[],disposition_decision={**ref(d),'scope_item_uuids':[item['uuid']]})
            else:row['source_revision_uuid']=args['seed_ref']['revision_uuid']
        self.reject(self.req('ticket.seed_apply',args),'MISSING_EVIDENCE')
        self.route([dict(operation='ticket.seed_apply',args=args)],rows)
        self.assertTrue(self.ledger()['complete']);self.assertEqual(next(x for x in self.items if x['uuid']==source['uuid']),source);self.assertNotIn(source['uuid'],self.capture['body']['item_uuids']);self.assertEqual(self.inspect(original,True),original)

    def test_direct_owner_disposition_records_exact_original_content_items_without_inference_authority(self):
        item=next(x for x in self.items if x['kind']=='source_item');original=self.evidence('Original owner drop direction','Drop this exact source scope point','owner_decision',[item['uuid']])
        category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='decisions')
        pin=dict(kind='owner_decision',locator=str(self.fx.root/'.evidence'/(original['revision_uuid']+'.json')),revision=original['revision_uuid'],sha256=digest(original),recorded_at=original['last_updated'],native_ref=None)
        body={**original['body'],'title':'Recorded owner disposition','category_uuid':category['uuid']};args=dict(body=body,source_refs=[pin],item_uuids=body['item_uuids'])
        bad=copy.deepcopy(args);bad['body']['content']='Inferred broader owner direction';self.reject(self.req('decision.record',bad),'FORBIDDEN')
        self.ok(self.fx.run(self.req('decision.record',args)));self.refresh();recorded=next(x for x in self.items if x['body'].get('title')=='Recorded owner disposition');self.assertEqual(recorded['body']['content'],original['body']['content']);self.assertEqual(recorded['body']['item_uuids'],original['body']['item_uuids']);self.assertEqual(recorded['source_refs'],[pin]);self.assertNotEqual(recorded['uuid'],original['uuid'])

    def test_new_merge_and_approval_atomic_physical_fail_kill_replay_readback(self):
        cases=[]
        for mode in ('merge','approval_issue_supersession'):
            if mode=='merge':
                target=self.create('Fault actual merge destination');rows=self.rows(target);body={**target['body'],'content':'Real body-changing merged payload','item_uuids':self.capture['body']['item_uuids']}
                op=dict(operation='record.merge',args=dict(uuid=self.capture['uuid'],target_uuid=target['uuid'],body=body,reason='Fault proven merge',source_refs=self.capture['source_refs']))
                _,request=self.route([op],rows,False);source_id=self.capture['uuid']
            else:
                decision=self.decision('Atomic fault approval destination');issue=self.create('Atomic fault issue');cat=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
                self.ok(self.fx.run(self.req('record.move_category',dict(uuid=issue['uuid'],category_uuid=cat['uuid'],reason='Actual issue routing',source_refs=[]))));self.refresh();issue=next(x for x in self.items if x['uuid']==issue['uuid'])
                batch=self.present([decision]);approval=self.approval(batch);op=dict(operation='decision.supersede',args=dict(old_uuid=issue['uuid'],new_uuid=decision['uuid'],scope_item_uuids=[],authority_ref=ref(self.fx.authority),reverse_input=False));request=self.req('transaction.apply',dict(operations=[dict(operation='decision.approve_batch',args=approval['args']),op]));source_id=issue['uuid']
            old=self.plan['root_revision_uuid'];backup=Path(self.tmp.name+'-backup');shutil.copytree(self.fx.root,backup,symlinks=True)
            def execute(env):
                path=self.fx.root/'fault.json';path.write_bytes(encode(request));proc=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)],cwd=CHECKOUT,env={**os.environ,**env},capture_output=True,text=True);return proc,json.loads(proc.stdout) if proc.stdout else None
            try:
                trace=self.fx.root/'trace.jsonl';proc,response=execute({'LP_TX_TRACE':str(trace)});self.assertEqual(proc.returncode,0,response);stages=[json.loads(x) for x in trace.read_text().splitlines()]
                for name in ('write_bytes','flush','fsync_file','selector','readback','reply'):
                    stage=next(x for x in stages if x['stage']==name)
                    for fault in ('LP_TX_FAIL','LP_TX_STOP'):
                        shutil.rmtree(self.fx.root);shutil.copytree(backup,self.fx.root,symlinks=True);proc,error=execute({fault:str(stage['index'])});self.assertIn(proc.returncode,(3,-9));fault_exit=proc.returncode
                        plan,tickets,folder=read_generation(self.fx.home);self.assertEqual(plan['root_revision_uuid']!=old,name in ('readback','reply'))
                        first_readback=dict(current_selector=str((self.fx.home/'CURRENT').readlink()),plan=plan,tickets=tickets,plan_sha256=file_hash(folder/'plan.json'),prepared=json.loads((self.fx.home/'.prepared'/(plan['root_revision_uuid']+'.json')).read_text()))
                        fault_stdout=proc.stdout;fault_stderr=proc.stderr
                        proc,receipt=execute({});self.assertEqual(proc.returncode,0,receipt);replay_exit=proc.returncode;proc,replay=execute({});self.assertEqual(proc.returncode,0,replay);self.assertEqual(receipt,replay)
                        plan,tickets,folder=read_generation(self.fx.home);items=current(tickets[self.ticket['root_uuid']]);edges=[x for x in items if x['kind']=='edge' and x['body']['edge_kind']=='supersedes' and x['body']['from_uuid']==source_id];self.assertEqual(len(edges),1)
                        if mode=='merge':self.assertEqual(len([x for x in items if x['kind']=='coverage']),5);self.assertEqual(next(x for x in items if x['uuid']==target['uuid'])['body'],body)
                        else:self.assertEqual(len([x for x in items if x['kind']=='acceptance' and x['body']['subject_refs']==[ref(decision)]]),1)
                        cases.append(dict(mode=mode,fault=fault,boundary=stage,fault_exit=fault_exit,fault_stdout=fault_stdout,fault_stderr=fault_stderr,expected_first_selection='new' if name in ('readback','reply') else 'old',first_readback=first_readback,replay_exit=replay_exit,error=error,request=request,receipt=receipt,replay=replay,old_generation=old,final_readback=dict(plan=plan,tickets=tickets,plan_sha256=file_hash(folder/'plan.json'),prepared=json.loads((self.fx.home/'.prepared'/(plan['root_revision_uuid']+'.json')).read_text()))))
            finally:shutil.rmtree(backup)
            self.refresh()
        if os.environ.get('LP_A06_BOUNDARIES'):Path(os.environ['LP_A06_BOUNDARIES']).write_bytes(encode(dict(result='PASS',cases=cases)))
        self.assertEqual(len(cases),24)

    def test_generic_acceptance_cannot_bypass_presented_decision_boundary_direct_or_nested(self):
        decision=self.decision('Decision needing presentation');batch=self.present([decision]);proposal=self.approval(batch);instruction=next(x for x in self.extra if x['uuid']==proposal['args']['original_instruction_ref']['entry_uuid']);gate=next(x for x in self.extra if x['kind']=='review')
        args=dict(subject_refs=[ref(decision)],subject_digest=digest([ref(decision)]),gate_refs=[ref(gate)],authority_ref=ref(self.fx.authority),original_instruction_ref=ref(self.fx.authority))
        self.reject(self.req('acceptance.record',args),'FORBIDDEN');self.reject(self.req('transaction.apply',dict(operations=[dict(operation='acceptance.record',args=args)])),'FORBIDDEN')
        self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=decision['uuid']))))['details']['current_approval']['state'],'pending')

    def test_partial_presented_item_scope_uncovered_pending_and_issue_not_falsely_resolved(self):
        ids=self.capture['body']['item_uuids'];decision=self.decision('Partially approved scoped decision',ids);pins=[{**ref(decision),'scope_item_uuids':ids[:2]}];proof=self.evidence('Displayed partial item scope',dict(entry_refs=pins,batch_digest=digest(pins)))
        body=dict(entry_refs=pins,batch_digest=digest(pins),presentation_evidence_ref=ref(proof),state='pending',acceptance_ref=None)
        self.ok(self.fx.run(self.req('decision.present_batch',dict(body=body,authority_ref=ref(self.fx.authority)))));self.refresh();batch=next(x for x in self.items if x['kind']=='presented_batch');self.ok(self.fx.run(self.approval(batch)));self.refresh()
        detail=self.ok(self.fx.run(self.req('record.get',dict(uuid=decision['uuid']))))['details']['current_approval'];self.assertEqual(detail['state'],'partially_accepted');self.assertEqual(set(detail['applicable_item_uuids']),set(ids[:2]));self.assertEqual(detail['uncovered_item_uuids'],ids[2:])
        category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues');body=dict(title='Issue requiring all source points',category_uuid=category['uuid'],format='plain',content='All five source items need approval',authority='proposal',state='pending',item_uuids=ids)
        self.ok(self.fx.run(self.req('issue.create',dict(body=body,source_refs=[],item_uuids=ids))));self.refresh();issue=next(x for x in self.items if x['body'].get('title')==body['title']);self.ok(self.fx.run(self.req('record.supersede',dict(old_uuid=issue['uuid'],new_uuid=decision['uuid'],scope_item_uuids=ids,authority_ref=ref(self.fx.authority),reverse_input=False))));self.refresh()
        self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=issue['uuid']))))['details']['current_approval']['issue_state'],'pending')

    def test_actual_wiki_supported_interpretation_stays_pending_without_original_owner_instruction(self):
        from core.store import now
        with tempfile.TemporaryDirectory(prefix='.s3-wiki-',dir=CHECKOUT/'launchpad/tests') as name:
            path=Path(name)/'PAGE.md';path.write_text('---\nname: Controlled Wiki\nmetadata:\n  last-modified: "2026-10-11T20:00:00Z"\n---\nA current explicit test rule\n')
            # Establish a real assigned checkout/ref before plan creation, then use
            # a fresh controlled binding rather than forge the current actor.
            other=CoverageTests();other.fx=Fixture(Path(name)/'store');other.extra=[];other.fx.assignment['body'].update(source_checkout=str(CHECKOUT),source_branch='codex/build-workflow-and-tickets',source_head=HEAD);other.fx.save(other.fx.assignment);other.fx.actor['body']['assignment_refs']=[ref(other.fx.assignment)];other.fx.actor['body']['granted_operations']=sorted(INSTALLED);other.fx.save(other.fx.actor)
            savedrun=other.fx.run
            def audited(req):
                result=savedrun(req);self.raw.append(dict(request=copy.deepcopy(req),exit=result[0],response=copy.deepcopy(result[1]),fixture='actual Wiki Git checkout'));return result
            other.fx.run=audited;other.ok(other.fx.create('Actual current Wiki inference'));other.ok(other.fx.run(other.fx.seed()));other.refresh()
            category=next(x for x in other.items if x['kind']=='category' and x['body']['category_key']=='decisions');pin=dict(kind='source_of_truth_contract',locator=str(path),revision=other.fx.assignment['body']['source_head'],sha256=file_hash(path),recorded_at=now(),native_ref=None)
            body=dict(title='Actual Wiki-supported inference',category_uuid=category['uuid'],format='plain',content='Interpret this actual current Wiki rule for the ticket',authority='proposal',state='pending',item_uuids=[])
            other.ok(other.fx.run(other.req('decision.record',dict(body=body,source_refs=[pin],item_uuids=[]))));other.refresh();decision=next(x for x in other.items if x['body'].get('title')==body['title'])
            rb=dict(target_kind='wiki_metadata',locator=str(path),source_checkout=str(CHECKOUT),source_ref='codex/build-workflow-and-tickets',used_revision=pin['revision'],used_sha256=pin['sha256'],used_stamp='2026-10-11T20:00:00Z',supported_scope=[decision['uuid']])
            other.ok(other.fx.run(other.req('record.create',dict(kind='reference',body=rb,source_refs=[]))));other.refresh();reference=next(x for x in other.items if x['kind']=='reference');result=other.ok(other.fx.run(other.req('record.get',dict(uuid=reference['uuid']))));self.assertEqual(result['details']['source']['freshness'],'current');self.assertEqual(result['details']['reconciliation']['unreconciled_count'],0)
            detail=other.ok(other.fx.run(other.req('record.get',dict(uuid=decision['uuid'],fields=['body']))));self.assertEqual(detail['rows'][0]['fields']['body']['state'],'pending');self.assertEqual(detail['details']['current_approval']['state'],'pending');self.assertFalse(any(x['kind']=='acceptance' for x in other.items))

    def test_accounting_only_handoff_and_fresh_complete_noop_keep_business_envelopes(self):
        capture=copy.deepcopy(self.capture);rows=self.rows(self.capture);operation=dict(operation='record.move_category',args=dict(uuid=self.capture['uuid'],category_uuid=self.capture['body']['category_uuid'],reason='Explicit accounting-only handoff',source_refs=self.capture['source_refs']))
        self.route([operation],rows);self.assertEqual(self.capture,capture);self.assertTrue(self.ledger()['complete']);ticket=copy.deepcopy(self.ticket)
        self.route([operation],rows);self.assertEqual(self.ticket,ticket);self.assertEqual(self.capture,capture)

    def test_disjoint_exact_scoped_approvals_union_only_the_presented_item_subset(self):
        ids=self.capture['body']['item_uuids'];decision=self.decision('Union exact scoped approval',ids)
        for scope in (ids[:2],ids[2:4]):
            pins=[{**ref(decision),'scope_item_uuids':scope}];proof=self.evidence('Exact displayed subset',dict(entry_refs=pins,batch_digest=digest(pins)));body=dict(entry_refs=pins,batch_digest=digest(pins),presentation_evidence_ref=ref(proof),state='pending',acceptance_ref=None)
            self.ok(self.fx.run(self.req('decision.present_batch',dict(body=body,authority_ref=ref(self.fx.authority)))));self.refresh();batch=next(x for x in self.items if x['kind']=='presented_batch' and x['body']==body);self.ok(self.fx.run(self.approval(batch)));self.refresh()
        result=self.ok(self.fx.run(self.req('record.get',dict(uuid=decision['uuid']))))['details']['current_approval'];self.assertEqual(result['state'],'partially_accepted');self.assertEqual(set(result['applicable_item_uuids']),set(ids[:4]));self.assertEqual(result['uncovered_item_uuids'],ids[4:]);self.assertEqual(len(result['acceptance_refs']),2)

    def test_pending_implementation_choice_interpretation_uses_same_presented_approval(self):
        original=self.decision('Proposal to compare');body={**original['body'],'title':'Pending engineering interpretation','authority':'implementation_choice'}
        self.ok(self.fx.run(self.req('decision.record',dict(body=body,source_refs=original['source_refs'],item_uuids=[]))));self.refresh();choice=next(x for x in self.items if x['body'].get('title')==body['title']);self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=choice['uuid']))))['details']['current_approval']['state'],'pending')
        batch=self.present([choice]);self.ok(self.fx.run(self.approval(batch)));self.refresh();self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=choice['uuid']))))['details']['current_approval']['state'],'accepted')

    def test_enduring_approval_obligation_survives_category_relabel_route_and_clone_direct_nested(self):
        for mode in ('category-key','route','clone'):
            for nested in (False,True):
                decision=self.decision('Protected '+mode+str(nested));category=next(x for x in self.items if x['uuid']==decision['body']['category_uuid']);proposals=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='proposals')
                if mode=='category-key':self.ok(self.fx.run(self.req('record.update',dict(uuid=category['uuid'],body={**category['body'],'category_key':'proposals'},source_refs=[]))))
                elif mode=='route':self.ok(self.fx.run(self.req('record.move_category',dict(uuid=decision['uuid'],category_uuid=proposals['uuid'],reason='Real routing preserves obligation',source_refs=decision['source_refs']))))
                else:
                    self.ok(self.fx.run(self.req('record.clone',dict(uuid=decision['uuid'],kind='content',body={**decision['body'],'title':'Protected cloned inference '+str(nested),'category_uuid':proposals['uuid']},source_refs=decision['source_refs']))));self.refresh();decision=next(x for x in self.items if x['body'].get('title')=='Protected cloned inference '+str(nested))
                self.refresh();decision=next(x for x in self.items if x['uuid']==decision['uuid']);batch=self.present([decision]);fake=self.approval(batch);gate=next(x for x in self.extra if x['kind']=='review' and x['body']['subject_refs']==[ref(decision)])
                generic=dict(subject_refs=[ref(decision)],subject_digest=digest([ref(decision)]),gate_refs=[ref(gate)],authority_ref=ref(self.fx.authority),original_instruction_ref=ref(self.fx.authority))
                request=self.req('transaction.apply',dict(operations=[dict(operation='acceptance.record',args=generic)])) if nested else self.req('acceptance.record',generic);self.reject(request,'FORBIDDEN')
                self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=decision['uuid']))))['details']['current_approval']['state'],'pending')
                self.ok(self.fx.run(fake));self.refresh();self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=decision['uuid']))))['details']['current_approval']['state'],'accepted')
                if mode=='category-key':self.ok(self.fx.run(self.req('record.update',dict(uuid=category['uuid'],body=category['body'],source_refs=[]))));self.refresh()

    def test_superseded_destination_scopes_hold_only_affected_items_and_explicit_successor_reconciles(self):
        target=self.create('Initially mapped target');rows=self.rows(target);ids=self.capture['body']['item_uuids'];body={**target['body'],'content':'Explicit mapped complete body','item_uuids':ids};self.route([dict(operation='record.merge',args=dict(uuid=self.capture['uuid'],target_uuid=target['uuid'],reason='Complete mapping',source_refs=self.capture['source_refs'],body=body))],rows);target=next(x for x in self.items if x['uuid']==target['uuid']);oldrows=copy.deepcopy([x for x in self.items if x['kind']=='coverage'])
        successor=self.create('Current exact successor');self.ok(self.fx.run(self.req('record.update',dict(uuid=successor['uuid'],body={**successor['body'],'item_uuids':ids[:2]},source_refs=[]))));self.refresh();successor=next(x for x in self.items if x['uuid']==successor['uuid']);edge=dict(operation='record.supersede',args=dict(old_uuid=target['uuid'],new_uuid=successor['uuid'],scope_item_uuids=ids[:2],authority_ref=ref(self.fx.authority),reverse_input=False));self.ok(self.fx.run(self.req('transaction.apply',dict(operations=[edge]))));self.refresh();ledger=self.ledger();self.assertFalse(ledger['complete']);self.assertEqual({x['source_item_uuid'] for x in ledger['holds']},set(ids[:2]));self.assertEqual(self.validation()['verdict'],'incomplete')
        reconciled=[{**x['body'],'destination_refs':[{**ref(successor),'scope_item_uuids':[x['body']['source_item_uuid']]}]} for x in oldrows if x['body']['source_item_uuid'] in ids[:2]]
        self.route([dict(operation='record.move_category',args=dict(uuid=successor['uuid'],category_uuid=successor['body']['category_uuid'],reason='Explicit actual successor mapping',source_refs=[]))],reconciled);self.assertTrue(self.ledger()['complete'])
        for old in oldrows:self.assertEqual(self.inspect(old,True),old)
        empty=self.create('Missing all remaining source scope');self.ok(self.fx.run(self.req('record.supersede',dict(old_uuid=target['uuid'],new_uuid=empty['uuid'],scope_item_uuids=ids[2:],authority_ref=ref(self.fx.authority),reverse_input=False))));self.refresh();ledger=self.ledger();self.assertFalse(ledger['complete']);self.assertEqual({x['source_item_uuid'] for x in ledger['holds']},set(ids[2:]));self.assertEqual(self.validation()['verdict'],'incomplete')

    def generic_approval(self,targets,scopes=None):
        pins=[{**ref(x),'scope_item_uuids':(scopes or {}).get(x['uuid'],[])} for x in targets];writer={**self.fx.writer,'actor_uuid':uid()};report=self.evidence('Independent generic review','Exact actual successor bytes',writer=writer)
        gate=self.fx.save(envelope('review',dict(assignment_uuid=uid(),attempt_uuid=uid(),subject_refs=pins,subject_digest=digest(pins),mode='Exact generic provider review',reviewer_actor_uuid=writer['actor_uuid'],evidence_refs=[ref(report)],verdict='pass',finding_refs=[],report_ref=ref(report)),writer));self.extra.append(gate)
        return dict(subject_refs=pins,subject_digest=digest(pins),gate_refs=[ref(gate)],authority_ref=ref(self.fx.authority),original_instruction_ref=ref(self.fx.authority))

    def test_interpretation_successor_merge_split_supersede_requires_exact_presented_approval(self):
        for mode in ('merge','split','supersede'):
            ids=self.capture['body']['item_uuids'];source=self.decision('Protected source '+mode,ids);a=self.create('Successor '+mode+' A');b=self.create('Successor '+mode+' B') if mode=='split' else None;rows=self.rows(a)
            if mode=='merge':
                ops=[dict(operation='record.merge',args=dict(uuid=source['uuid'],target_uuid=a['uuid'],reason='Explicit successor body',source_refs=source['source_refs'],body={**a['body'],'content':'Actual merged interpretation','item_uuids':ids}))]
            else:
                ops=[dict(operation='record.update',args=dict(uuid=a['uuid'],body={**a['body'],'content':'Actual interpreted successor','item_uuids':ids[:2] if b else ids},source_refs=source['source_refs']))]
                if b:
                    for i,row in enumerate(rows):row['destination_refs']=[{**ref(a if i<2 else b),'scope_item_uuids':[row['source_item_uuid']]}]
                    ops += [dict(operation='record.update',args=dict(uuid=b['uuid'],body={**b['body'],'content':'Actual remaining interpretation','item_uuids':ids[2:]},source_refs=source['source_refs'])),dict(operation='record.update',args=dict(uuid=source['uuid'],body={**source['body'],'item_uuids':[]},source_refs=source['source_refs']))]
            self.route(ops,rows)
            if mode=='supersede':self.ok(self.fx.run(self.req('record.supersede',dict(old_uuid=source['uuid'],new_uuid=a['uuid'],scope_item_uuids=ids,authority_ref=ref(self.fx.authority),reverse_input=False))));self.refresh()
            targets=[x for x in self.items if x['uuid'] in ([a['uuid'],b['uuid']] if b else [a['uuid']])];args=self.generic_approval(targets)
            for nested in (False,True):
                request=self.req('transaction.apply',dict(operations=[dict(operation='acceptance.record',args=args)])) if nested else self.req('acceptance.record',args);self.reject(request,'FORBIDDEN')
                active=dict(operation='record.update',args=dict(uuid=targets[0]['uuid'],body={**targets[0]['body'],'state':'active'},source_refs=targets[0]['source_refs']));request=self.req('transaction.apply',dict(operations=[active])) if nested else self.req(active['operation'],active['args']);self.reject(request,'FORBIDDEN')
            self.ok(self.fx.run(self.req('acceptance.record',self.generic_approval([self.capture]))));self.refresh() # Shared raw IDs alone do not burden original ordinary Capture.
            batch=self.present(targets);self.ok(self.fx.run(self.approval(batch)));self.refresh()
            for item in targets:self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=item['uuid']))))['details']['current_approval']['state'],'accepted')

    def test_final_transform_lineage_guards_earlier_same_transaction_acceptance_and_state(self):
        ids=self.capture['body']['item_uuids'];source=self.decision('Scoped pending source',ids);target=self.create('Already current prospective successor')
        self.ok(self.fx.run(self.req('record.update',dict(uuid=target['uuid'],body={**target['body'],'item_uuids':ids},source_refs=source['source_refs']))));self.refresh();target=next(x for x in self.items if x['uuid']==target['uuid'])
        edge=dict(operation='record.supersede',args=dict(old_uuid=source['uuid'],new_uuid=target['uuid'],scope_item_uuids=ids[:2],authority_ref=ref(self.fx.authority),reverse_input=False));accept=dict(operation='acceptance.record',args=self.generic_approval([target]));active=dict(operation='record.update',args=dict(uuid=target['uuid'],body={**target['body'],'state':'active'},source_refs=target['source_refs']))
        for early in (accept,active):self.reject(self.req('transaction.apply',dict(operations=[early,edge])),'FORBIDDEN')
        rows=self.rows(target);split=dict(operation='record.update',args=dict(uuid=source['uuid'],body={**source['body'],'item_uuids':[]},source_refs=source['source_refs']))
        ops=[active,split];expected=self.req('transaction.apply',dict(operations=ops))['expected'];pins=[]
        for sub in ops:
            for pin in sub['args']['source_refs']:
                if pin not in pins:pins.append(pin)
        self.reject(self.req('intake.route_preview',dict(source_refs=pins,proposed_operations=ops,target_expected=expected,coverage_rows=rows)),'FORBIDDEN')
        self.ok(self.fx.run(self.req(edge['operation'],edge['args'])));self.refresh();target=next(x for x in self.items if x['uuid']==target['uuid'])
        self.ok(self.fx.run(self.req('acceptance.record',self.generic_approval([target],{target['uuid']:ids[2:]}))));self.refresh();value=self.ok(self.fx.run(self.req('record.get',dict(uuid=target['uuid']))))['details']['current_approval'];self.assertEqual(set(value['applicable_item_uuids']),set(ids[2:]));self.assertEqual(set(value['uncovered_item_uuids']),set(ids[:2]))
        pins=[{**ref(target),'scope_item_uuids':ids[:2]}];proof=self.evidence('Exact interpreted subset display',dict(entry_refs=pins,batch_digest=digest(pins)));body=dict(entry_refs=pins,batch_digest=digest(pins),presentation_evidence_ref=ref(proof),state='pending',acceptance_ref=None)
        self.ok(self.fx.run(self.req('decision.present_batch',dict(body=body,authority_ref=ref(self.fx.authority)))));self.refresh();batch=next(x for x in self.items if x['kind']=='presented_batch' and x['body']==body);self.ok(self.fx.run(self.approval(batch)));self.refresh();self.assertEqual(self.ok(self.fx.run(self.req('record.get',dict(uuid=target['uuid']))))['details']['current_approval']['state'],'accepted')
