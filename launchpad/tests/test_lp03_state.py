"""A09 public subprocess state positions and reviewed support integration."""
import copy
import json
import os
import unittest
from pathlib import Path
import test_lp03_discussions as discussion_tests
from support import CHECKOUT,current,uid,ref,envelope,encode,file_hash
from core.store import digest
from core.commands import INSTALLED


class StateTests(unittest.TestCase):
    def setUp(self):
        discussion_tests.DiscussionsTests.setUp(self);self.source_saves=[];original=self.fx.save
        def save(item):
            result=original(item);path=self.fx.root/'.evidence'/(item['revision_uuid']+'.json')
            self.source_saves.append(dict(fixture_save='Actual saved local source envelope, not native attestation',path=str(path),bytes=path.read_text(),sha256=file_hash(path)))
            return result
        self.fx.save=save
    def call(self,request,cwd=CHECKOUT,extra=None):
        if not extra or 'LP_TEST_CHECKED_AT' not in extra:return discussion_tests.DiscussionsTests.call(self,request,cwd,extra)
        import subprocess,sys,hashlib
        from support import CLI
        path=self.fx.root/('request-'+uid()+'.json');path.write_bytes(encode(request))
        code="import sys,os;sys.path.insert(0,os.environ['LP_TEST_TOOLS']);import ticket_cli;from core import state_check;state_check.now=lambda:os.environ['LP_TEST_CHECKED_AT'];sys.exit(ticket_cli.main())"
        env={**os.environ,**extra,'LP_TEST_TOOLS':str(CLI.parent)};argv=[sys.executable,'-c',code,'--framework',str(self.fx.root),'--request',str(path)]
        p=subprocess.run(argv,cwd=cwd,env=env,capture_output=True,text=True);self.raw.append(dict(argv=argv,workdir=str(cwd),env_overrides={**extra,'LP_TEST_TOOLS':str(CLI.parent)},request_bytes=path.read_text(),request_sha256=file_hash(path),stdout=p.stdout,stdout_sha256=hashlib.sha256(p.stdout.encode()).hexdigest(),stderr=p.stderr,exit=p.returncode,clock_fixture='Deterministic public CLI mock clock only; no product hook'))
        from core.schema import named
        value=json.loads(p.stdout);named(value,'response.schema.json');return p.returncode,value
    ok=discussion_tests.DiscussionsTests.ok
    refresh=discussion_tests.DiscussionsTests.refresh
    request=discussion_tests.DiscussionsTests.request
    register=discussion_tests.DiscussionsTests.register
    summary=discussion_tests.DiscussionsTests.summary
    refuse=discussion_tests.DiscussionsTests.refuse

    def tearDown(self):
        destination=os.environ.get('LP_A09_REPORT')
        if destination:
            self.refresh();path=Path(destination);cases=json.loads(path.read_text()) if path.exists() else []
            prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text())
            cases.append(dict(test=self.id(),requests=self.raw,external_source_history=self.source_saves,external_original_bytes=[dict(path=str(p),bytes=p.read_text(),sha256=file_hash(p)) for home in (self.fx.root/'.evidence',self.fx.sources) for p in sorted(home.rglob('*')) if p.is_file()],final_readback=dict(plan=self.plan,tickets=self.ts,prepared=prepared,plan_sha256=file_hash(self.folder/'plan.json'),view_hashes={k:file_hash(self.folder/k) for k in prepared['view_hashes']}),temporary_fixture='Removed after retained raw/readback proof'))
            path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(encode(cases))
        self.tmp.cleanup()

    def bind(self,role='launchpad',runtime_kind='ephemeral',parent=None,grants=None,node=None,ticket_id=None):
        identity=uid();ticket_id=ticket_id or self.ticket['root_uuid'];manager=next(x for x in current(self.plan) if x['uuid']==parent) if parent else self.fx.actor
        proof=dict(actual_cwd=str(CHECKOUT),runtime_kind=runtime_kind,permissions='danger-full-access')
        if runtime_kind=='child':proof.update(runtime_id='actual-test-child-'+identity,parent_actor_uuid=parent)
        binding=self.fx.save(envelope('content',dict(title='Saved actual local host evidence',category_uuid=uid(),format='json',content=proof,authority='active_code_constraint',state='active',item_uuids=[]),self.fx.writer))
        assignment=self.fx.save(envelope('assignment',{**self.fx.assignment['body'],'ticket_uuid':ticket_id,'node_uuid':node or self.phases[0]['uuid'],'role':role,'work_kind':'evaluation' if role=='support-reviewer' else 'research' if parent else 'slice','eligible_actor_uuid':identity,'manager_uuid':manager['uuid'],'write_paths':[str(self.fx.home)],'report_path':str(self.fx.home/'reports'/identity),'source_checkout':str(self.fx.sources)},self.fx.writer))
        body=dict(role=role,runtime_kind=runtime_kind,runtime_id=proof.get('runtime_id'),host_id=None,parent_actor_uuid=parent,actual_cwd=str(CHECKOUT),binding_evidence_ref=ref(binding),assignment_refs=[ref(assignment)],granted_operations=grants or (['discussion.summary_record','support.report_submit','state.check','transaction.apply'] if parent else sorted(INSTALLED-{'plan.create'})),state='active')
        result=self.ok(self.call(self.request('actor.bind',dict(body=body,binding_evidence_ref=ref(binding),authority_ref=ref(self.fx.authority)),manager,ticket=False)));self.refresh()
        return next(x for x in current(self.plan) if x['uuid']==identity),assignment

    def check(self,actor=None,mode='conversation',scope=None,limit=100,cursor=None,exclude=True,ack=None,nested=False):
        self.refresh();actor=actor or self.fx.actor;scope=scope or dict(plan_uuid=self.plan['root_uuid'],ticket_uuid=self.ticket['root_uuid'])
        args=dict(mode=mode,requester_uuid=actor['uuid'],scope=scope,exclude_actual_self=exclude,limit=limit)
        if cursor:args['cursor']=cursor
        if ack is not None:args['acknowledge_high_water']=ack
        return self.request('transaction.apply',dict(operations=[dict(operation='state.check',args=args)]),actor,ticket='ticket_uuid' in scope) if nested else self.request('state.check',args,actor,ticket='ticket_uuid' in scope)

    def new_content(self,actor=None,title='Other contribution'):
        category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='proposals')
        result=self.ok(self.call(self.request('record.create',dict(kind='content',body=dict(title=title,category_uuid=category['uuid'],format='plain',content=title,authority='proposal',state='pending',item_uuids=[]),source_refs=[]),actor)));self.refresh()
        return next(x for x in self.items if x['kind']=='content' and x['body']['title']==title),result

    def update(self,item,actor=None,text='Main integrated support'):
        return self.request('record.update',dict(uuid=item['uuid'],body={**item['body'],'content':text},source_refs=item['source_refs'],extensions=item['extensions']),actor)

    def support_packet(self,main=None,text='Reviewed contribution'):
        main=main or self.fx.actor;child,assignment=self.bind('inline-support','child',main['uuid']);target,_=self.new_content(main,'Support target '+uid())
        suggested=[dict(operation='record.update',args=self.update(target,main,text)['args'])]
        category=next(x for x in self.items if x['uuid']==target['body']['category_uuid']);bases=[ref(target),ref(category)]
        proof=dict(assignment_uuid=assignment['uuid'],source_base_refs=bases,suggested_operations=suggested)
        report=self.fx.save(envelope('content',dict(title='Bounded support report',category_uuid=uid(),format='json',content=proof,authority='implementation_choice',state='active',item_uuids=[]),dict(actor_uuid=child['uuid'],runtime_kind='child',runtime_id=child['body']['runtime_id'],parent_actor_uuid=main['uuid'])))
        args=dict(assignment_uuid=assignment['uuid'],report_ref=ref(report),source_base_refs=bases,suggested_operations=suggested)
        return main,child,assignment,target,report,args

    def reviewed(self,main,assignment,target,report,args):
        reviewer,evaluation=self.bind('support-reviewer',node=report['uuid'],grants=['state.check'])
        writer=dict(actor_uuid=reviewer['uuid'],runtime_kind='ephemeral',runtime_id=None,parent_actor_uuid=None)
        digest_value=digest(report['body']['content']);proof=dict(report_ref=ref(report),source_base_refs=args['source_base_refs'],preview_digest=digest_value,reviewer_actor_uuid=reviewer['uuid'],source_review=True)
        raw=self.fx.save(envelope('content',dict(title='Saved independent source review',category_uuid=uid(),format='json',content=proof,authority='active_code_constraint',state='active',item_uuids=[]),writer))
        subjects=[ref(report)]+args['source_base_refs']
        gate=self.fx.save(envelope('review',dict(assignment_uuid=evaluation['uuid'],attempt_uuid=uid(),subject_refs=subjects,subject_digest=digest_value,mode='support-raw-source',reviewer_actor_uuid=reviewer['uuid'],evidence_refs=subjects,verdict='pass',finding_refs=[],report_ref=ref(raw)),writer))
        integrate=dict(assignment_uuid=assignment['uuid'],report_ref=ref(report),source_base_refs=args['source_base_refs'],worker_review_ref=ref(gate),preview_digest=digest_value)
        return reviewer,gate,raw,integrate

    def test_independent_requesters_modes_scopes_and_no_observation_feedback(self):
        a,_=self.bind();b,_=self.bind();first=self.ok(self.call(self.check(a)));self.assertIsNone(first['previous_checked_at']);self.assertEqual(first['added_refs'],[])
        before=copy.deepcopy(self.ticket);native=self.fx.home/'CHECKPOINT.json';native.write_text('{"native_cursor":"unchanged"}');native_hash=file_hash(native)
        second=self.ok(self.call(self.check(a)));self.refresh();self.assertEqual(self.ticket,before);self.assertEqual(second['current_snapshot_sha256'],first['current_snapshot_sha256']);self.assertEqual(second['changed_refs'],[]);self.assertEqual(second['previous_checked_at'],first['checked_at']);self.assertEqual(file_hash(native),native_hash)
        bfirst=self.ok(self.call(self.check(b)));self.assertIsNone(bfirst['previous_checked_at']);no_feedback=self.ok(self.call(self.check(a)));self.assertEqual(no_feedback['changed_refs'],[]);self.assertEqual(no_feedback['added_refs'],[]);monitor=self.ok(self.call(self.check(a,mode='monitor')));self.assertIsNone(monitor['previous_checked_at'])
        ticket_first=self.ok(self.call(self.check(self.fx.actor)));plan_scope={'plan_uuid':self.plan['root_uuid']};p=self.ok(self.call(self.check(self.fx.actor,scope=plan_scope)));self.assertIsNone(p['previous_checked_at']);ticket_next=self.ok(self.call(self.check(self.fx.actor)));self.assertEqual(ticket_next['previous_checked_at'],ticket_first['checked_at'])
        normalized=self.check(self.fx.actor,scope={**plan_scope,'include_history':False});again=self.ok(self.call(normalized));self.assertEqual(again['previous_checked_at'],p['checked_at'])
        contribution,_=self.new_content(b);delta=self.ok(self.call(self.check(a)));self.assertIn(ref(contribution),delta['added_refs']);bdelta=self.ok(self.call(self.check(b)));self.assertNotIn(ref(contribution),bdelta['added_refs']);self.assertEqual(bdelta['previous_checked_at'],bfirst['checked_at'])

    def test_actual_self_filter_retains_actual_parent_attributed_child(self):
        main,_=self.bind();discussion,_,_=self.register(main);child,_=self.bind('inline-support','child',main['uuid'])
        first=self.ok(self.call(self.check(main)));self.ok(self.call(self.summary(main,discussion,'Actual main self turn')));self.refresh();main_snapshot=copy.deepcopy(self.ticket)
        delta=self.ok(self.call(self.check(main)));self.assertEqual(delta['added_refs'],[]);self.assertEqual(delta['changed_refs'],[])
        self.ok(self.call(self.summary(child,discussion,'Actual child retains parent attribution')));self.refresh();entry=next(x for x in self.items if x['kind']=='journal_entry' and x['writer']['actor_uuid']==child['uuid'])
        delta=self.ok(self.call(self.check(main)));self.assertIn(ref(entry),delta['added_refs']);self.assertEqual(entry['writer']['parent_actor_uuid'],main['uuid']);self.assertIn('liveness',delta['gaps'][0]);self.assertEqual(next(x for x in current(self.plan) if x['kind']=='plan')['writer']['actor_uuid'],child['uuid'])
        coverage=[x for x in self.items if x['kind'] in ('checkpoint','acceptance','coverage')];self.ok(self.call(self.check(main)));self.refresh();self.assertEqual([x for x in self.items if x['kind'] in ('checkpoint','acceptance','coverage')],coverage)
        self.ok(self.call(self.check(child)))

    def test_paginated_ack_frozen_high_water_repeat_pages_and_later_changes(self):
        a,_=self.bind();b,_=self.bind();baseline=self.ok(self.call(self.check(a)));items=[self.new_content(b,'Change '+str(i))[0] for i in range(4)]
        page=self.ok(self.call(self.check(a,limit=1)));self.assertTrue(page['continuation']);high=page['high_water'];self.assertEqual(page['acknowledged_high_water'],baseline['high_water'])
        repeated=self.ok(self.call(self.check(a,limit=1)));self.assertEqual(repeated,page)
        self.refuse(self.check(a,limit=1,ack=high),'INVALID_TRANSITION')
        later,_=self.new_content(b,'After frozen high water');seen=page['added_refs']+page['changed_refs'];cursor=page['continuation'];old_request=None
        while cursor:
            request=self.check(a,limit=1,cursor=cursor);value=self.ok(self.call(request));self.assertEqual(value['high_water'],high)
            replay=self.ok(self.call(request));self.assertEqual(replay,value)
            second_key=self.check(a,limit=1,cursor=cursor);cached=self.ok(self.call(second_key));self.assertEqual(cached,value)
            old_request=request;seen+=value['added_refs']+value['changed_refs'];cursor=value['continuation']
        self.assertEqual(value['acknowledged_high_water'],high);self.assertTrue(all(ref(i) in seen for i in items));self.assertNotIn(ref(later),seen)
        next_delta=self.ok(self.call(self.check(a)));self.assertIn(ref(later),next_delta['added_refs']);self.assertEqual(self.ok(self.call(old_request)),value)

    def test_removed_pages_history_scope_and_unfiltered_actual_self(self):
        a,_=self.bind();b,_=self.bind();items=[self.new_content(b,'Will archive '+str(i))[0] for i in range(2)]
        self.ok(self.call(self.check(a)));history_scope=dict(plan_uuid=self.plan['root_uuid'],ticket_uuid=self.ticket['root_uuid'],include_history=True);self.ok(self.call(self.check(a,scope=history_scope)))
        for item in items:self.ok(self.call(self.request('record.archive',dict(uuid=item['uuid'],reason='Exact disposable archive',source_refs=item['source_refs'],authority_ref=ref(self.fx.authority)),b)))
        page=self.ok(self.call(self.check(a,limit=1)));removed=page['removed_uuids'];self.assertTrue(page['continuation'])
        while page['continuation']:
            page=self.ok(self.call(self.check(a,limit=1,cursor=page['continuation'])));removed+=page['removed_uuids']
        self.assertTrue(all(x['uuid'] in removed for x in items));history=self.ok(self.call(self.check(a,scope=history_scope)));self.assertTrue(all(x['uuid'] in {p['entry_uuid'] for p in history['changed_refs']} for x in items));self.assertEqual(history['scope'],history_scope)
        self.ok(self.call(self.check(a,mode='monitor',exclude=False)));own,_=self.new_content(a,'Unfiltered actual self');delta=self.ok(self.call(self.check(a,mode='monitor',exclude=False)));self.assertIn(ref(own),delta['added_refs'])
        other,_=self.new_content(b,'Self archives another writer');self.ok(self.call(self.check(a)));self.ok(self.call(self.request('record.archive',dict(uuid=other['uuid'],reason='Actual self archive',source_refs=[],authority_ref=ref(self.fx.authority)),a)));self.assertNotIn(other['uuid'],self.ok(self.call(self.check(a)))['removed_uuids'])
        self.ok(self.call(self.request('record.archive',dict(uuid=own['uuid'],reason='Other writer archive',source_refs=[],authority_ref=ref(self.fx.authority)),b)));self.assertIn(own['uuid'],self.ok(self.call(self.check(a)))['removed_uuids'])

    def test_direct_nested_refusals_scope_requester_expectations_and_ack(self):
        actor,_=self.bind();other,_=self.bind();first=self.ok(self.call(self.check(actor)))
        for nested in (False,True):
            req=self.check(actor,nested=nested);args=req['args']['operations'][0]['args'] if nested else req['args'];args['requester_uuid']=other['uuid'];self.refuse(req,'FORBIDDEN')
            req=self.check(actor,nested=nested);req['expected'].pop(first['check_ref']['entry_uuid']);
            if nested:req['args']['expected']=req['expected']
            self.refuse(req,'REVISION_CONFLICT')
        self.refuse(self.check(actor,scope={'plan_uuid':uid()}),'FORBIDDEN')
        req=self.check(actor);req['args']['scope']={'plan_uuid':self.plan['root_uuid']};self.refuse(req,'FORBIDDEN')
        req=self.check(actor,cursor='forged');self.refuse(req,'INVALID_TRANSITION')
        valid=self.ok(self.call(self.check(actor,nested=True)));self.assertEqual(valid['result_kind'],'mutation')
        # Explicit final bounded acknowledgment has the same exact guards.
        self.refresh();self.ok(self.call(self.check(actor,ack=self.plan['commit_seq'])))

    def test_clock_anomaly_and_cosmetic_metadata_never_substantive_progress(self):
        a,_=self.bind();first=self.ok(self.call(self.check(a),extra={'LP_TEST_CHECKED_AT':'2030-01-01T00:00:00Z'}));before=copy.deepcopy(self.ticket)
        backwards=self.ok(self.call(self.check(a),extra={'LP_TEST_CHECKED_AT':'2029-12-31T23:59:59Z'}));self.assertTrue(backwards['clock_anomaly']);self.assertEqual(backwards['elapsed_seconds'],-1);self.assertEqual(backwards['changed_refs'],[]);self.refresh();self.assertEqual(self.ticket,before)
        self.assertEqual(backwards['acknowledged_high_water'],backwards['high_water']);self.assertTrue(any('clock' in x for x in backwards['gaps']))

    def test_existing_ongoing_headers_remain_unchanged_and_observation_is_not_progress(self):
        # Seed retained provider headers, without installing LP04 run/claim APIs.
        # Public subprocess checks below observe these real canonical files.
        from core.transaction import publish
        from core.store import now
        actor,_=self.bind();claim=self.fx.save(envelope('content',dict(title='Retained provider claim fixture',category_uuid=uid(),format='plain',content='Historical saved claim, not a live native process',authority='active_code_constraint',state='active',item_uuids=[]),self.fx.writer))
        header=envelope('attempt',dict(assignment_uuid=self.fx.assignment['uuid'],actor_uuid=self.fx.actor['uuid'],predecessor_attempt_uuid=None,claim_ref=ref(claim),start_ref=None,state='running',summary='Unchanged retained run',last_progress_at=now(),last_checkpoint_at=None,return_refs=[]),self.fx.writer)
        def seed_header(value):
            self.refresh();req=self.request('record.create',dict(kind='content',body=claim['body'],source_refs=[]));req['operation']='fixture.retained-header'
            records=[copy.deepcopy(x) for x in current(self.plan) if x['uuid']!=value['uuid']]+[value]
            publish(self.fx.root,self.fx.home,req,self.fx.actor,self.fx.assignment,self.plan,self.ts,records,[])
            self.raw.append(dict(fixture_setup='In-process retained provider header only; no real native activation/claim',header_bytes=encode(value).decode(),header_sha256=digest(value),generation=self.plan['root_revision_uuid']))
        seed_header(header);self.ok(self.call(self.check(actor,mode='monitor')));progress=header['body']['last_progress_at']
        result=self.ok(self.call(self.check(actor,mode='monitor')));self.assertIn(ref(header),result['unchanged_run_refs']);self.refresh();self.assertEqual(next(x for x in current(self.plan) if x['uuid']==header['uuid'])['body']['last_progress_at'],progress)
        summary_change=copy.deepcopy(header);summary_change['revision_uuid']=uid();summary_change['last_updated']=now();summary_change['body']['summary']='Meaningful worker resume information';seed_header(summary_change)
        result=self.ok(self.call(self.check(actor,mode='monitor')));self.assertIn(ref(summary_change),result['changed_refs']);self.assertNotIn(ref(summary_change),result['unchanged_run_refs']);self.assertEqual(summary_change['body']['last_progress_at'],progress)
        substantive=copy.deepcopy(summary_change);substantive['revision_uuid']=uid();substantive['body']['state']='blocked';seed_header(substantive)
        result=self.ok(self.call(self.check(actor,mode='monitor')));self.assertIn(ref(substantive),result['changed_refs']);self.assertTrue(any('liveness' in x for x in result['gaps']))

    def test_support_report_only_exact_review_main_once_only_and_distinct_receipts(self):
        main,child,assignment,target,report,args=self.support_packet();before=copy.deepcopy(self.ticket)
        submitted=self.ok(self.call(self.request('support.report_submit',args,child)));self.refresh();self.assertEqual(self.ticket,before)
        _,gate,raw,integrate=self.reviewed(main,assignment,target,report,args)
        self.refuse(self.request('support.integrate',integrate,child),'FORBIDDEN')
        bad={**integrate,'preview_digest':'0'*64};self.refuse(self.request('support.integrate',bad,main),'REVISION_CONFLICT')
        request=self.request('support.integrate',integrate,main);accepted=self.ok(self.call(request));self.refresh();updated=next(x for x in self.items if x['uuid']==target['uuid']);self.assertEqual(updated['body']['content'],'Reviewed contribution');self.assertEqual(updated['writer']['actor_uuid'],main['uuid'])
        ready=next(x for x in current(self.plan) if x['kind']=='event' and x['body']['event_kind']=='support.report_submit');integration=next(x for x in current(self.plan) if x['kind']=='event' and x['body']['event_kind']=='support.integrate');acceptance=next(x for x in current(self.plan) if x['kind']=='acceptance');self.assertEqual(integration['body']['reply_to_ref'],ref(acceptance));self.assertNotEqual(submitted['receipt_ref'],accepted['receipt_ref']);self.assertEqual(len({ready['uuid'],integration['uuid'],acceptance['uuid']}),3)
        before=self.plan['root_revision_uuid'];self.assertEqual(self.ok(self.call(request)),accepted);self.refresh();self.assertEqual(before,self.plan['root_revision_uuid']);self.refuse(self.request('support.integrate',integrate,main),'INVALID_TRANSITION')

    def test_support_stale_target_source_and_forged_review_refuse_both_routes(self):
        for nested in (False,True):
            main,child,assignment,target,report,args=self.support_packet();self.ok(self.call(self.request('support.report_submit',args,child)));_,gate,raw,integrate=self.reviewed(main,assignment,target,report,args)
            self.ok(self.call(self.update(target,main,'Newer main edit')));self.refresh();request=self.request('transaction.apply',dict(operations=[dict(operation='support.integrate',args=integrate)]),main) if nested else self.request('support.integrate',integrate,main)
            self.refuse(request,'REVISION_CONFLICT');self.assertEqual(next(x for x in self.items if x['uuid']==target['uuid'])['body']['content'],'Newer main edit')
        main,child,assignment,target,report,args=self.support_packet();self.ok(self.call(self.request('support.report_submit',args,child)));_,gate,raw,integrate=self.reviewed(main,assignment,target,report,args)
        gate['body']['verdict']='failed';self.fx.save(gate);self.refuse(self.request('support.integrate',integrate,main),'SOURCE_UNVERIFIED')

    def test_support_existing_dependency_omitted_and_raw_source_drift_refuse(self):
        for payload in ('invalid',[None],[{'operation':'record.update','args':'bad'}]):
            main,child,assignment,target,report,args=self.support_packet();report['body']['content']['suggested_operations']=payload;self.fx.save(report);args={**args,'report_ref':ref(report)};self.refuse(self.request('support.report_submit',args,child),'INVALID_SCHEMA')
        for nested in (False,True):
            main,child,assignment,target,report,args=self.support_packet();report['body']['content']['source_base_refs']=[ref(target)];self.fx.save(report);args={**args,'report_ref':ref(report),'source_base_refs':[ref(target)]}
            self.ok(self.call(self.request('support.report_submit',args,child)));_,gate,raw,integrate=self.reviewed(main,assignment,target,report,args)
            request=self.request('transaction.apply',dict(operations=[dict(operation='support.integrate',args=integrate)]),main) if nested else self.request('support.integrate',integrate,main)
            self.refuse(request,'MISSING_EVIDENCE')
        main,child,assignment,target,report,args=self.support_packet();self.ok(self.call(self.request('support.report_submit',args,child)));_,gate,raw,integrate=self.reviewed(main,assignment,target,report,args)
        request=self.request('support.integrate',integrate,main);report['body']['content']['suggested_operations'][0]['args']['body']['content']='Unreviewed report drift';self.fx.save(report);self.refuse(request,'SOURCE_UNVERIFIED')

    def test_support_nested_integration_and_later_nested_change_refusal(self):
        main,child,assignment,target,report,args=self.support_packet();submit_request=self.request('transaction.apply',dict(operations=[dict(operation='support.report_submit',args=args)]),child);submitted=self.ok(self.call(submit_request));self.assertEqual(self.ok(self.call(submit_request)),submitted)
        _,gate,raw,integrate=self.reviewed(main,assignment,target,report,args)
        trial=self.request('transaction.apply',dict(operations=[dict(operation='support.integrate',args=integrate),dict(operation='record.update',args=self.update(target,main,'Later unreviewed patch')['args'])]),main);self.refuse(trial,'INVALID_SCHEMA')
        request=self.request('transaction.apply',dict(operations=[dict(operation='support.integrate',args=integrate)]),main);result=self.ok(self.call(request));self.assertEqual(self.ok(self.call(request)),result);self.refresh();self.assertEqual(next(x for x in self.items if x['uuid']==target['uuid'])['body']['content'],'Reviewed contribution')

    def source_support_packet(self,reviewed_source_edit=False):
        main,child,assignment,target,report,args=self.support_packet()
        source,_=self.new_content(main,'Additional substantive reviewed source')
        bases=args['source_base_refs']+[ref(source)]
        suggested=copy.deepcopy(args['suggested_operations'])
        if reviewed_source_edit:suggested.append(dict(operation='record.update',args=self.update(source,main,'Exact reviewed source effect')['args']))
        report['body']['content'].update(source_base_refs=bases,suggested_operations=suggested)
        self.fx.save(report);args={**args,'report_ref':ref(report),'source_base_refs':bases,'suggested_operations':suggested}
        self.ok(self.call(self.request('support.report_submit',args,child)))
        _,gate,raw,integrate=self.reviewed(main,assignment,target,report,args)
        return main,source,target,integrate

    def physical_images(self):
        return {str(p.relative_to(self.fx.home)):dict(bytes=p.read_bytes().hex(),sha256=file_hash(p)) for p in sorted(self.fx.home.rglob('*')) if p.is_file() and p.name!='.lock'}

    def test_support_final_source_update_archive_move_reject_both_orders_atomically(self):
        for operation in ('record.update','record.archive','record.move_category'):
            for order in ('source_before','source_after'):
                with self.subTest(operation=operation,order=order):
                    main,source,target,integrate=self.source_support_packet()
                    if operation=='record.update':args=self.update(source,main,'Newer main source')['args']
                    elif operation=='record.archive':args=dict(uuid=source['uuid'],reason='Newer source lifecycle',source_refs=[],authority_ref=ref(self.fx.authority))
                    else:
                        category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
                        args=dict(uuid=source['uuid'],category_uuid=category['uuid'],reason='Newer reviewed source routing',source_refs=[])
                    edit=dict(operation=operation,args=args);integration=dict(operation='support.integrate',args=integrate)
                    operations=[edit,integration] if order=='source_before' else [integration,edit]
                    request=self.request('transaction.apply',dict(operations=operations),main)
                    before=self.physical_images();self.refuse(request,'REVISION_CONFLICT');after=self.physical_images();self.assertEqual(after,before)
                    # A refused key is safely retryable and creates no acceptance,
                    # integration, selector, prepared generation or view changes.
                    self.refuse(request,'REVISION_CONFLICT');self.assertEqual(self.physical_images(),before)
                    self.raw.append(dict(case='Final prospective source conflict',operation=operation,order=order,before_physical=before,after_physical=after,repeated_physical=self.physical_images()))
                    self.assertEqual(ref(next(x for x in self.items if x['uuid']==source['uuid'])),ref(source))
                    self.assertEqual(ref(next(x for x in self.items if x['uuid']==target['uuid'])),ref(target))

    def test_support_reviewed_source_effects_and_unrelated_edits_pass_both_routes_replay(self):
        for nested in (False,True):
            with self.subTest(nested=nested):
                main,source,target,integrate=self.source_support_packet(reviewed_source_edit=True)
                other,_=self.new_content(main,'Unrelated main source')
                args=dict(operations=[dict(operation='record.update',args=self.update(other,main,'Independent main edit')['args']),dict(operation='support.integrate',args=integrate)])
                request=self.request('transaction.apply',args,main) if nested else self.request('support.integrate',integrate,main)
                result=self.ok(self.call(request));self.refresh()
                by_id={x['uuid']:x for x in self.items}
                self.assertEqual(by_id[source['uuid']]['body']['content'],'Exact reviewed source effect')
                self.assertEqual(by_id[target['uuid']]['body']['content'],'Reviewed contribution')
                self.assertEqual(by_id[other['uuid']]['body']['content'],'Independent main edit' if nested else 'Unrelated main source')
                before=self.physical_images();self.assertEqual(self.ok(self.call(request)),result);self.refresh();self.assertEqual(self.physical_images(),before)

if __name__=='__main__':unittest.main()
