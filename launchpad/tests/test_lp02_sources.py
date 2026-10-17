"""A05 public subprocess and physical source/transaction readback proof."""
import copy
import json
import os
import sys
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from support import Fixture,CHECKOUT,CLI,current,read_generation,uid,ref,encode,file_hash,now
from core.store import digest
from core.commands import INSTALLED,REGISTRY
import test_lp02_records as records_tests


# Derive the expected source revision from the live checkout instead of a frozen
# HEAD literal: sources.py observes the real checkout HEAD, so the oracle must
# compare against the same runtime revision (HEAD-independent).
HEAD=subprocess.check_output(['git','rev-parse','HEAD'],cwd=CHECKOUT,text=True).strip()


class SourcesTests(unittest.TestCase):
    ok=records_tests.RecordsTests.ok
    refresh=records_tests.RecordsTests.refresh
    request=records_tests.RecordsTests.request
    create=records_tests.RecordsTests.create
    lifecycle=records_tests.RecordsTests.lifecycle
    reject=records_tests.RecordsTests.reject
    inspect=records_tests.RecordsTests.inspect

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='.s2-',dir=CHECKOUT/'launchpad/tests')
        self.fx=Fixture(self.tmp.name);self.fx.assignment['body'].update(source_checkout=str(CHECKOUT),source_branch='codex/build-workflow-and-tickets',source_head=HEAD);self.fx.save(self.fx.assignment)
        self.fx.actor['body']['assignment_refs']=[ref(self.fx.assignment)];self.fx.actor['body']['granted_operations']=sorted(INSTALLED);self.fx.save(self.fx.actor)
        self.raw=[];run=self.fx.run
        def audited(request):
            result=run(request);self.raw.append(dict(request=copy.deepcopy(request),exit=result[0],response=copy.deepcopy(result[1])));return result
        self.fx.run=audited
        self.ok(self.fx.create('A05 disposable source fixture'));self.ok(self.fx.run(self.fx.seed(scope=['Clause A','Clause B'])));self.refresh()

    def tearDown(self):
        report=os.environ.get('LP_A05_REPORT')
        if report:
            path=Path(report);rows=json.loads(path.read_text()) if path.exists() else [];self.refresh()
            rows.append(dict(test=self.id(),requests=self.raw,final_readback=dict(plan=self.plan,tickets=self.ts,plan_sha256=file_hash(self.folder/'plan.json'),prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text()))));path.write_bytes(encode(rows))
        self.tmp.cleanup()

    def supersede(self,old,new,scope=None,reverse=False,op='record.supersede'):
        return self.request(op,dict(old_uuid=old['uuid'],new_uuid=new['uuid'],scope_item_uuids=scope or [],authority_ref=ref(self.fx.authority),reverse_input=reverse))

    def get(self,item,pinned=False):
        args=dict(uuid=item['uuid'],fields=['body','revision_uuid','lifecycle'])
        if pinned:args['revision_uuid']=item['revision_uuid']
        return self.ok(self.fx.run(self.request('record.get',args)))

    def reference(self,target_kind='plan_entry',target=None,path=None,scope=None,branch=None):
        body=dict(target_kind=target_kind,locator=target['uuid'] if target else str(path),source_checkout=str(CHECKOUT) if target_kind=='wiki_metadata' else None,source_ref=branch or 'codex/build-workflow-and-tickets' if target_kind=='wiki_metadata' else None,
                  used_revision=self.fx.assignment['body']['source_head'] if path else target['revision_uuid'],used_sha256=file_hash(path) if path else digest(target),used_stamp='2026-10-11T20:00:00Z' if path else target['last_updated'],supported_scope=scope or [])
        self.ok(self.fx.run(self.request('record.create',dict(kind='reference',body=body,source_refs=[]))));self.refresh()
        return next(x for x in self.items if x['kind']=='reference' and x['body']==body)

    def wiki(self,content='Original rule',stamp='2026-10-11T20:00:00Z'):
        path=self.fx.sources/'PAGE.md';path.write_text('---\nname: Rule\nmetadata:\n  last-modified: "'+stamp+'"\n---\n'+content+'\n');return path

    def test_reference_history_current_and_exact_old_pin_frozen_paging_wire(self):
        def wire(label,request):
            path=self.fx.root/'history-wire-request.json';path.write_bytes(encode(request))
            proc=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)],cwd=CHECKOUT,capture_output=True)
            self.assertEqual(proc.returncode,0,proc.stdout);self.assertLessEqual(len(proc.stdout),16384)
            result=json.loads(proc.stdout);self.raw.append(dict(request=request,exit=proc.returncode,response=result,wire_bytes=len(proc.stdout)))
            evidence=os.environ.get('LP_A05_WIRE_DIR')
            if evidence:
                folder=Path(evidence);folder.mkdir(parents=True,exist_ok=True);(folder/(label+'.json')).write_bytes(proc.stdout);(folder/(label+'-request.json')).write_bytes(encode(request))
            return result
        for kind in ('wiki_metadata','plan_entry'):
            with self.subTest(kind=kind):
                path=self.wiki() if kind=='wiki_metadata' else None;target=self.create('History Plan source') if kind=='plan_entry' else None
                old=self.reference(kind,target=target,path=path)
                if path:
                    self.wiki('Reconciled new Wiki rule','2026-10-11T21:00:00Z');used=dict(used_revision=old['body']['used_revision'],used_sha256=file_hash(path),used_stamp='2026-10-11T21:00:00Z')
                else:
                    self.ok(self.fx.run(self.request('record.update',dict(uuid=target['uuid'],body={**target['body'],'content':'Reconciled new Plan rule'},source_refs=[]))));self.refresh();target=next(x for x in self.items if x['uuid']==target['uuid']);used=dict(used_revision=target['revision_uuid'],used_sha256=digest(target),used_stamp=target['last_updated'])
                self.ok(self.fx.run(self.request('record.update',dict(uuid=old['uuid'],body={**old['body'],**used},source_refs=[]))));self.refresh();new=next(x for x in self.items if x['uuid']==old['uuid'])
                before=(self.fx.home/'CURRENT').readlink()
                for op in ('record.get','record.history'):
                    for pinned,item,status in ((False,new,'current'),(True,old,'changed')):
                        args=dict(uuid=item['uuid'],fields=['body','revision_uuid'])
                        if pinned:args['revision_uuid']=item['revision_uuid']
                        result=wire(kind+'-'+op+('-pin' if pinned else '-current'),self.request(op,args));source=result['details']['source']
                        self.assertEqual(result['details']['selector'],'pinned' if pinned else 'current');self.assertEqual(source['reference_revision_uuid'],item['revision_uuid']);self.assertEqual(source['freshness'],status)
                        self.assertEqual(source['used'],dict(revision=item['body']['used_revision'],sha256=item['body']['used_sha256'],stamp=item['body']['used_stamp']))
                        if pinned:self.assertEqual(result['rows'][0]['fields']['body'],old['body']);self.assertEqual(len(result['rows']),1)
                        elif op=='record.history':self.assertEqual({x['revision_uuid'] for x in result['rows']},{old['revision_uuid'],new['revision_uuid']})
                self.assertEqual(before,(self.fx.home/'CURRENT').readlink())
                request=self.request('record.history',dict(uuid=old['uuid'],fields=['body'],limit=1));first=wire(kind+'-history-page1',request);self.assertIsNotNone(first['continuation'])
                self.ok(self.fx.run(self.request('record.update',dict(uuid=new['uuid'],body={**new['body'],'used_stamp':'2099-10-11T20:00:00Z'},source_refs=[]))));self.refresh()
                request['args']['cursor']=first['continuation'];second=wire(kind+'-history-page2',request)
                self.assertEqual(second['captured_plan_revision_uuid'],first['captured_plan_revision_uuid']);self.assertEqual(second['high_water'],first['high_water']);self.assertEqual(second['details']['source']['reference_revision_uuid'],new['revision_uuid']);self.assertEqual(second['details']['source']['freshness'],'current');self.assertIsNone(second['continuation'])
                self.assertEqual({first['rows'][0]['revision_uuid'],second['rows'][0]['revision_uuid']},{old['revision_uuid'],new['revision_uuid']})

    def test_direction_normalization_residual_inverse_and_full_union(self):
        original=copy.deepcopy(self.capture);first=self.create('Replacement A');second=self.create('Replacement B');ids=self.capture['body']['item_uuids']
        self.ok(self.fx.run(self.supersede(self.capture,first,[ids[0]])));self.refresh()
        self.assertEqual(self.capture,original);detail=self.get(original)['details']['lineage'];self.assertFalse(detail['fully_superseded']);self.assertEqual(detail['residual_item_uuids'],ids[1:])
        inverse=self.ok(self.fx.run(self.request('record.related',dict(uuid=first['uuid'],direction='inverse',edge_kinds=['supersedes']))));self.assertEqual(inverse['rows'][0]['uuid'],original['uuid']);self.assertEqual(inverse['details']['related_lineage'][0]['superseded_by'][0]['replacement_uuid'],first['uuid'])
        self.ok(self.fx.run(self.supersede(self.capture,second,ids[1:],True,'decision.supersede')));self.refresh()
        edges=[x for x in self.items if x['kind']=='edge' and x['body']['edge_kind']=='supersedes'];self.assertEqual(len(edges),2);self.assertTrue(all(x['body']['from_uuid']==original['uuid'] for x in edges));self.assertTrue(self.get(original)['details']['lineage']['fully_superseded']);history=self.ok(self.fx.run(self.request('record.history',dict(uuid=original['uuid'],fields=['body']))));self.assertTrue(history['details']['lineage']['fully_superseded']);self.assertEqual(len(history['details']['lineage']['superseded_by']),2)
        query=self.ok(self.fx.run(self.request('query.filter',dict(collection='content'))));self.assertNotIn(original['uuid'],[x['uuid'] for x in query['rows']]);self.assertEqual(self.get(original,True)['rows'][0]['fields']['body'],original['body'])

    def test_replacement_invalid_direct_nested_scope_expectation_and_replay(self):
        a=self.create('A');b=self.create('B');c=self.create('C');req=self.supersede(a,b,reverse=True);first=self.ok(self.fx.run(req));self.refresh();self.assertEqual(self.ok(self.fx.run(req)),first)
        requests=[self.supersede(a,b),self.supersede(a,a),self.supersede(b,a),self.supersede(a,c),self.supersede(a,b,[uid()]),self.supersede(a,dict(uuid=uid()))]
        for req in requests:
            self.reject(req)
            sub=dict(operation=req['operation'],args=req['args']);self.reject(self.request('transaction.apply',dict(operations=[sub])))
        scope=self.capture['body']['item_uuids'];req=self.supersede(self.capture,c,[scope[0],scope[0]]);self.reject(req)
        req=self.supersede(self.capture,c,[scope[0]]);req['expected'].pop(scope[0]);self.reject(req,'REVISION_CONFLICT')
        self.ok(self.fx.run(self.lifecycle('record.archive',b)));self.refresh();self.reject(self.supersede(c,b),'INVALID_TRANSITION')

    def test_plan_current_changed_equal_stamp_older_restore_missing_and_history(self):
        item=self.create('Plan source');reference=self.reference(target=item)
        before=(self.fx.home/'CURRENT').readlink();result=self.get(reference);self.assertEqual(result['details']['source']['freshness'],'current');self.assertEqual(before,(self.fx.home/'CURRENT').readlink())
        self.ok(self.fx.run(self.request('record.update',dict(uuid=item['uuid'],body={**item['body'],'content':'Changed'},source_refs=[]))));self.refresh()
        result=self.get(reference)['details']['source'];self.assertEqual(result['freshness'],'changed');self.assertTrue(result['historical_pin_available']);self.assertEqual(result['used']['sha256'],digest(item))
        changed=next(x for x in self.items if x['uuid']==item['uuid']);self.ok(self.fx.run(self.lifecycle('record.archive',changed)));self.refresh();self.assertEqual(self.get(reference)['details']['source']['source_lifecycle'],'archived')
        archived=next(x for x in self.items if x['uuid']==item['uuid']);self.ok(self.fx.run(self.lifecycle('record.restore',archived)));self.refresh();self.assertEqual(self.get(reference)['details']['source']['freshness'],'changed')
        # Missing selected target is a truthful bounded read, not another-plan scan.
        missing=copy.deepcopy(reference['body']);missing['locator']=uid();self.ok(self.fx.run(self.request('record.create',dict(kind='reference',body=missing,source_refs=[]))));self.refresh();missing_reference=next(x for x in self.items if x['kind']=='reference' and x['body']==missing);self.assertEqual(self.get(missing_reference)['details']['source']['freshness'],'unverified')

    def test_wiki_equal_stamp_hash_older_missing_malformed_wrong_ref_external(self):
        path=self.wiki();reference=self.reference('wiki_metadata',path=path);self.assertEqual(self.get(reference)['details']['source']['freshness'],'current')
        baseline=copy.deepcopy(self.plan);original=path.read_bytes();self.wiki('Changed equal stamp');self.assertIn('equal stamp',self.get(reference)['details']['source']['reason']);self.assertEqual(self.plan,baseline)
        self.wiki('Older restoration','2026-10-10T20:00:00Z');self.assertIn('older/restored',self.get(reference)['details']['source']['reason'])
        path.write_text('---\nlast-modified: "2026-10-11T20:00:00Z"\n---\nMissing metadata section');self.assertEqual(self.get(reference)['details']['source']['freshness'],'unverified')
        path.write_text('---\nmetadata:\n  last-modified: \"2026-10-11T20:00:00Z\"\nUnclosed frontmatter');self.assertEqual(self.get(reference)['details']['source']['freshness'],'unverified')
        for stamp in ('', '"2026-10-11T20:00:00Z', "'2026-10-11T20:00:00Z", '2026-10-11T20:00:00Z"'):
            path.write_text('---\nname: Rule\nmetadata:\n  last-modified: '+stamp+'\n---\nBody');self.assertEqual(self.get(reference)['details']['source']['freshness'],'unverified')
        path.unlink();self.assertEqual(self.get(reference)['details']['source']['freshness'],'unverified');path.write_bytes(original)
        wrong=self.reference('wiki_metadata',path=path,branch='main');self.assertIn('Wrong source branch',self.get(wrong)['details']['source']['reason'])
        external=self.reference('external',path=path);self.assertEqual(self.get(external)['details']['source']['freshness'],'not_checked')

    def test_all_registered_obligations_main_exact_reconciliation_missed_consumer(self):
        path=self.wiki();a=self.create('Consumer A');b=self.create('Consumer B');reference=self.reference('wiki_metadata',path=path,scope=[a['uuid'],b['uuid']]);self.wiki('Deliberate new rule','2026-10-11T21:00:00Z')
        result=self.get(reference)['details'];self.assertEqual(result['reconciliation']['registered_count'],2);self.assertEqual(result['reconciliation']['unreconciled_count'],2)
        pin=dict(kind='source_of_truth_contract',locator=str(path),revision=self.fx.assignment['body']['source_head'],sha256=file_hash(path),recorded_at=now(),native_ref=None)
        req=self.request('record.update',dict(uuid=a['uuid'],body={**a['body'],'content':'Adapted to exact current rule; still pending'},source_refs=[pin]));first=self.ok(self.fx.run(req));self.refresh();self.assertEqual(self.ok(self.fx.run(req)),first)
        result=self.get(reference)['details'];self.assertEqual(result['reconciliation']['unreconciled_count'],1);self.assertEqual(next(x for x in result['reconciliation']['entries'] if x['entry_uuid']==b['uuid'])['state'],'needs_reconciliation')
        self.ok(self.fx.run(self.request('record.update',dict(uuid=b['uuid'],body={**b['body'],'content':'Explicit unchanged disposition against current rule; pending'},source_refs=[pin]))));self.refresh();self.assertEqual(self.get(reference)['details']['reconciliation']['unreconciled_count'],0)
        self.assertTrue(all(x['body']['state']=='pending' for x in self.items if x['uuid'] in (a['uuid'],b['uuid'])));self.assertEqual(path.read_text(), '---\nname: Rule\nmetadata:\n  last-modified: "2026-10-11T21:00:00Z"\n---\nDeliberate new rule\n')
        self.assertEqual(self.get(reference,True)['details']['source']['used']['sha256'],reference['body']['used_sha256'])


    def test_wiki_trusted_assigned_branch_and_exact_ref_not_caller_selected(self):
        actual=HEAD
        older=subprocess.check_output(['git','rev-parse','HEAD^'],cwd=CHECKOUT,text=True).strip()
        for label,assigned,head,selected,expected_status in [('wrong-branch','main',actual,'codex/build-workflow-and-tickets','unverified'),('wrong-commit','0'*40,'0'*40,'codex/build-workflow-and-tickets','unverified'),('exact-head',actual,actual,actual,'current'),('named-newer-head','codex/build-workflow-and-tickets',older,'codex/build-workflow-and-tickets','changed')]:
            self.fx=Fixture(self.fx.root/label);self.fx.assignment['body'].update(source_checkout=str(CHECKOUT),source_branch=assigned,source_head=head);self.fx.save(self.fx.assignment);self.fx.actor['body']['assignment_refs']=[ref(self.fx.assignment)];self.fx.actor['body']['granted_operations']=sorted(INSTALLED);self.fx.save(self.fx.actor)
            run=self.fx.run
            def audited(request):
                result=run(request);self.raw.append(dict(request=copy.deepcopy(request),exit=result[0],response=copy.deepcopy(result[1])));return result
            self.fx.run=audited;self.ok(self.fx.create());self.ok(self.fx.run(self.fx.seed()));self.refresh();path=self.wiki();reference=self.reference('wiki_metadata',path=path,branch=selected);status=self.get(reference)['details']['source'];self.assertEqual(status['freshness'],expected_status)
            if expected_status!='unverified':self.assertEqual(status['observed_revision'],actual);self.assertEqual(status['assigned_baseline_head'],head)
    def test_reference_exact_dependencies_and_protected_observation(self):
        a=self.create('Target');args=dict(kind='reference',body=dict(target_kind='plan_entry',locator=a['uuid'],source_checkout=None,source_ref=None,used_revision=a['revision_uuid'],used_sha256=digest(a),used_stamp=a['last_updated'],supported_scope=[self.capture['uuid']]),source_refs=[])
        req=self.request('record.create',args);req['expected'].pop(a['uuid']);self.reject(req,'REVISION_CONFLICT')
        req=self.request('record.create',args);req['expected'].pop(self.capture['uuid']);self.reject(req,'REVISION_CONFLICT');self.ok(self.fx.run(self.request('record.create',args)))
        self.refresh();body=dict(reference_uuid=uid(),observed_at=now(),observed_revision=None,observed_stamp=None,observed_sha256=None,freshness='unverified',reason='No forged observer')
        self.reject(self.request('record.create',dict(kind='source_observation',body=body,source_refs=[])),'FORBIDDEN')

    def test_plan_equal_stamp_old_stamp_and_deleted_retained_pin_public(self):
        old=self.create('Equal/old stamp source');reference=self.reference(target=old)
        self.ok(self.fx.run(self.request('record.update',dict(uuid=old['uuid'],body={**old['body'],'content':'new bytes'},source_refs=[]))));self.refresh();target=next(x for x in self.items if x['uuid']==old['uuid'])
        self.ok(self.fx.run(self.request('record.update',dict(uuid=reference['uuid'],body={**reference['body'],'used_stamp':target['last_updated']},source_refs=[]))));self.refresh();reference=next(x for x in self.items if x['uuid']==reference['uuid']);self.assertIn('equal stamp',self.get(reference)['details']['source']['reason'])
        self.ok(self.fx.run(self.request('record.update',dict(uuid=reference['uuid'],body={**reference['body'],'used_stamp':'2099-10-11T20:00:00Z'},source_refs=[]))));self.refresh();reference=next(x for x in self.items if x['uuid']==reference['uuid']);self.assertIn('older/restored',self.get(reference)['details']['source']['reason'])
        draft=self.create('Deleted source');self.ok(self.fx.run(self.lifecycle('record.delete',draft)));self.refresh();reference=self.reference(target=draft)
        status=self.get(reference)['details']['source'];self.assertEqual(status['source_lifecycle'],'deleted');self.assertTrue(status['historical_pin_available']);self.assertEqual(status['freshness'],'changed')

    def test_validation_exposes_missed_registered_entry_and_bounded_actual_wire(self):
        path=self.wiki();operations=[]
        for index in range(60):
            operations.append(dict(operation='record.create',args=dict(kind='content',body=dict(title='Dependent '+str(index),category_uuid=self.capture['body']['category_uuid'],format='plain',content='Not approved',authority='proposal',state='pending',item_uuids=[]),source_refs=[])))
        self.ok(self.fx.run(self.request('transaction.apply',dict(operations=operations))));self.refresh();consumers=[x['uuid'] for x in self.items if x['body'].get('title','').startswith('Dependent ')]
        reference=self.reference('wiki_metadata',path=path,scope=consumers);self.wiki('new bytes same stamp')
        request=self.request('record.get',dict(uuid=reference['uuid'],fields=['body','source_refs']));file=self.fx.root/'wire.json';file.write_bytes(encode(request));proc=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(file)],cwd=CHECKOUT,capture_output=True);self.assertEqual(proc.returncode,0,proc.stdout);self.assertLessEqual(len(proc.stdout),16384)
        result=json.loads(proc.stdout);self.assertEqual(result['details']['reconciliation']['registered_count'],60);self.assertIn('disclosure_gap',result['details']);self.assertEqual(result['remaining'],0)
        validation=self.ok(self.fx.run(self.request('validation.record',dict(record_refs=[ref(reference)],checks=['source freshness','registered reconciliation'],scope=request['scope']))));self.assertEqual(validation['verdict'],'incomplete');self.assertTrue(validation['uncovered_scope'])


    def test_plan_evidence_locator_pin_registered_consumption_and_old_payload_restore(self):
        source=self.create('Canonical Plan source');self.fx.save(source);consumer=self.create('Plan consumer')
        pin=dict(kind='active_code_constraint',locator=str(self.fx.root/'.evidence'/(source['revision_uuid']+'.json')),revision=source['revision_uuid'],sha256=digest(source),recorded_at=now(),native_ref=source['uuid'])
        self.ok(self.fx.run(self.request('record.update',dict(uuid=consumer['uuid'],body=consumer['body'],source_refs=[pin]))));self.refresh();reference=self.reference(target=source)
        self.assertEqual(self.get(reference)['details']['reconciliation']['registered_count'],1)
        self.ok(self.fx.run(self.request('record.update',dict(uuid=source['uuid'],body={**source['body'],'content':'New authoritative source bytes'},source_refs=[]))));self.refresh();new=next(x for x in self.items if x['uuid']==source['uuid']);self.fx.save(new)
        detail=self.get(reference)['details'];self.assertEqual(detail['source']['freshness'],'changed');self.assertEqual(detail['reconciliation']['unreconciled_count'],1)
        self.ok(self.fx.run(self.request('record.update',dict(uuid=reference['uuid'],body={**reference['body'],'used_revision':new['revision_uuid'],'used_sha256':digest(new),'used_stamp':new['last_updated']},source_refs=[]))));self.refresh();reference=next(x for x in self.items if x['uuid']==reference['uuid'])
        consumer=next(x for x in self.items if x['uuid']==consumer['uuid']);newpin={**pin,'locator':str(self.fx.root/'.evidence'/(new['revision_uuid']+'.json')),'revision':new['revision_uuid'],'sha256':digest(new)}
        self.ok(self.fx.run(self.request('record.update',dict(uuid=consumer['uuid'],body={**consumer['body'],'content':'Main explicitly adapted'},source_refs=[pin,newpin]))));self.refresh();self.assertEqual(self.get(reference)['details']['reconciliation']['unreconciled_count'],0)
        self.ok(self.fx.run(self.request('record.update',dict(uuid=source['uuid'],body=source['body'],source_refs=[]))));self.refresh();self.assertIn('restored older retained payload',self.get(reference)['details']['source']['reason']);self.assertEqual(self.get(reference)['details']['reconciliation']['unreconciled_count'],1)

    def test_named_supersession_invalidates_exact_acceptance_generic_refused(self):
        import test_lp01_transaction as transaction_tests
        helper=transaction_tests.TransactionTests();helper.fx=self.fx;helper.refresh();self.ok(self.fx.run(helper.batch_evidence()));self.refresh();acceptance=next(x for x in self.items if x['kind']=='acceptance');target=self.create('Replacement after acceptance')
        body=dict(edge_kind='supersedes',from_uuid=self.capture['uuid'],to_uuid=target['uuid'],from_revision_uuid=None,to_revision_uuid=None,scope_item_uuids=[],authority_ref=ref(self.fx.authority))
        self.reject(self.request('record.create',dict(kind='edge',body=body,source_refs=[])),'FORBIDDEN')
        req=self.supersede(self.capture,target);req['expected'].pop(acceptance['uuid']);self.reject(req,'REVISION_CONFLICT');self.ok(self.fx.run(self.supersede(self.capture,target)));self.refresh();self.assertEqual(next(x for x in self.items if x['uuid']==acceptance['uuid'])['body']['state'],'invalidated')
    def test_generic_edge_bypass_scope_reject_and_replacement_immutable(self):
        a=self.create('Generic old');b=self.create('Generic new');self.ok(self.fx.run(self.supersede(a,b)));self.refresh();edge=next(x for x in self.items if x['kind']=='edge' and x['body']['edge_kind']=='supersedes')
        self.reject(self.request('record.update',dict(uuid=edge['uuid'],body={**edge['body'],'edge_kind':'references'},source_refs=[])),'FORBIDDEN')
        bad={**edge['body'],'from_uuid':self.capture['uuid'],'scope_item_uuids':[uid()]};self.reject(self.request('record.create',dict(kind='edge',body=bad,source_refs=[])))
        bad={**edge['body'],'from_uuid':b['uuid'],'to_uuid':a['uuid'],'authority_ref':ref(self.fx.binding)};self.reject(self.request('record.create',dict(kind='edge',body=bad,source_refs=[])))


    def test_diff_complete_actual_wire_includes_large_inverse_disclosure(self):
        target=self.create('Many incoming replacements');self.ok(self.fx.run(self.request('record.update',dict(uuid=target['uuid'],body={**target['body'],'content':'a'*6500},source_refs=[]))));self.refresh();old=next(x for x in self.items if x['uuid']==target['uuid'])
        self.ok(self.fx.run(self.request('record.update',dict(uuid=old['uuid'],body={**old['body'],'content':'b'*6500},source_refs=[]))));self.refresh();target=next(x for x in self.items if x['uuid']==target['uuid']);ops=[]
        for i in range(50):ops.append(dict(operation='record.create',args=dict(kind='content',body=dict(title='Many source '+str(i),category_uuid=self.capture['body']['category_uuid'],format='plain',content='source',authority='proposal',state='pending',item_uuids=[]),source_refs=[])))
        self.ok(self.fx.run(self.request('transaction.apply',dict(operations=ops))));self.refresh();sources=[x for x in self.items if x['body'].get('title','').startswith('Many source ')]
        self.ok(self.fx.run(self.request('transaction.apply',dict(operations=[dict(operation='record.supersede',args=dict(old_uuid=x['uuid'],new_uuid=target['uuid'],scope_item_uuids=[],authority_ref=ref(self.fx.authority))) for x in sources]))));self.refresh()
        req=self.request('record.diff',dict(uuid=target['uuid'],revision_uuid=target['revision_uuid'],compare_revision_uuid=old['revision_uuid'],fields=['body']));file=self.fx.root/'diff-wire.json';file.write_bytes(encode(req));proc=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(file)],cwd=CHECKOUT,capture_output=True);self.assertEqual(proc.returncode,0,proc.stdout);self.assertLessEqual(len(proc.stdout),16384);result=json.loads(proc.stdout);self.assertEqual(len(result['rows']),2);self.assertIsNone(result['continuation']);self.assertTrue(result['gaps']);self.assertIn('lineage',result['details'])

    def test_atomic_updated_endpoint_supersession_uses_captured_expectations(self):
        old=self.create('Atomic old');target=self.create('Atomic target');body={**target['body'],'content':'Exact revised replacement in atomic transaction'}
        operations=[dict(operation='record.update',args=dict(uuid=target['uuid'],body=body,source_refs=[])),dict(operation='record.supersede',args=self.supersede(old,target)['args'])]
        req=self.request('transaction.apply',dict(operations=operations));stale=copy.deepcopy(req);stale['idempotency_key']=uid();stale['expected'][target['uuid']]=uid();stale['args']['expected']=stale['expected'];self.reject(stale,'REVISION_CONFLICT')
        first=self.ok(self.fx.run(req));self.refresh();self.assertEqual(self.ok(self.fx.run(req)),first);new=next(x for x in self.items if x['uuid']==target['uuid']);edge=next(x for x in self.items if x['kind']=='edge' and x['body']['edge_kind']=='supersedes');self.assertEqual(edge['body']['to_revision_uuid'],new['revision_uuid']);self.assertEqual(new['body'],body);self.assertTrue(self.get(old)['details']['lineage']['fully_superseded'])

    def test_supported_consumer_guard_direct_nested_plan_wiki_and_unused_control(self):
        source=self.create('Plan source support');path=self.wiki()
        for kind in ('plan_entry','wiki_metadata'):
            consumer=self.create(kind+' registered consumer');self.reference(kind,target=source if kind=='plan_entry' else None,path=path if kind=='wiki_metadata' else None,scope=[consumer['uuid']])
            request=self.lifecycle('record.delete',consumer);self.reject(request,'FORBIDDEN');self.reject(self.request('transaction.apply',dict(operations=[dict(operation='record.delete',args=request['args'])])),'FORBIDDEN')
            self.ok(self.fx.run(self.lifecycle('record.archive',consumer)));self.refresh();self.assertEqual(next(x for x in self.items if x['uuid']==consumer['uuid'])['lifecycle'],'archived')
        control=self.create('Actually unused eligible draft');request=self.lifecycle('record.delete',control);receipt=self.ok(self.fx.run(request));self.refresh();self.assertEqual(self.ok(self.fx.run(request)),receipt);self.assertEqual(next(x for x in self.items if x['uuid']==control['uuid'])['lifecycle'],'deleted')
    def test_new_mutation_actual_boundaries_failure_kill_retry_readback(self):
        cases=[]
        for op in ('record.supersede','decision.supersede'):
            a=self.create(op+' old');b=self.create(op+' new');request=self.supersede(a,b,op=op);old=self.plan['root_revision_uuid'];backup=Path(self.tmp.name+'-backup');shutil.copytree(self.fx.root,backup,symlinks=True)
            def execute(env):
                path=self.fx.root/'fault.json';path.write_bytes(encode(request));proc=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)],cwd=CHECKOUT,env={**os.environ,**env},capture_output=True,text=True);return proc,json.loads(proc.stdout) if proc.stdout else None
            trace=self.fx.root/'trace.jsonl';proc,value=execute({'LP_TX_TRACE':str(trace)});self.assertEqual(proc.returncode,0,value);stages=[json.loads(x) for x in trace.read_text().splitlines()]
            for name in ('write_bytes','flush','fsync_file','selector','readback','reply'):
                stage=next(x for x in stages if x['stage']==name)
                for fault in ('LP_TX_FAIL','LP_TX_STOP'):
                    shutil.rmtree(self.fx.root);shutil.copytree(backup,self.fx.root,symlinks=True);proc,error=execute({fault:str(stage['index'])});self.assertNotEqual(proc.returncode,0);fault_exit=proc.returncode
                    plan,tickets,folder=read_generation(self.fx.home);self.assertEqual(plan['root_revision_uuid']!=old,name in ('readback','reply'))
                    proc,receipt=execute({});self.assertEqual(proc.returncode,0,receipt);proc,replay=execute({});self.assertEqual(proc.returncode,0,replay);self.assertEqual(receipt,replay)
                    plan,tickets,folder=read_generation(self.fx.home);edges=[x for x in current(tickets[self.ticket['root_uuid']]) if x['kind']=='edge' and x['body']['edge_kind']=='supersedes' and x['body']['from_uuid']==a['uuid']];self.assertEqual(len(edges),1)
                    cases.append(dict(operation=op,fault=fault,boundary=stage,fault_exit=fault_exit,replay_exit=proc.returncode,error=error,request=request,old_generation=old,final_generation=plan['root_revision_uuid'],plan_sha256=file_hash(folder/'plan.json'),edge=edges[0],receipt=receipt,replay=replay))
            shutil.rmtree(backup);self.refresh()
        if os.environ.get('LP_A05_BOUNDARIES'):Path(os.environ['LP_A05_BOUNDARIES']).write_bytes(encode(dict(result='PASS',cases=cases)))
        self.assertEqual(len(cases),24)


if __name__=='__main__':unittest.main()
