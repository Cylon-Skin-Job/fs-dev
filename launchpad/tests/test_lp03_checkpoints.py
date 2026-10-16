"""A08 public subprocess checkpoints, exact raw source and physical replay proof."""
import copy
import json
import os
import unittest
from pathlib import Path
from test_lp03_discussions import DiscussionsTests
from support import current,read_generation,uid,ref,envelope,file_hash,encode,CHECKOUT
from core.store import digest
from core.checkpoints import patch_manifest


class CheckpointsTests(DiscussionsTests):
    # Reuse the actual public fixture methods, not the inherited A07 tests.
    def tearDown(self):
        old=os.environ.get('LP_A07_REPORT');destination=os.environ.get('LP_A08_REPORT')
        if destination:os.environ['LP_A07_REPORT']=destination
        try:super().tearDown()
        finally:
            if old is None:os.environ.pop('LP_A07_REPORT',None)
            else:os.environ['LP_A07_REPORT']=old

    def register(self,actor,phase=0):
        request=self.request('discussion.register',dict(phase_node_uuid=self.phases[phase]['uuid'],actor_uuid=actor['uuid']),actor)
        receipt=self.ok(self.call(request));self.refresh()
        return next(x for x in self.items if x['kind']=='discussion' and x['body']['actor_uuid']==actor['uuid'] and x['body']['phase_node_uuid']==self.phases[phase]['uuid'] and x['body']['state']=='open'),receipt,request

    def actor(self):
        # The provisioned fronting manager already holds the complete bounded grant.
        return self.fx.actor

    def prepare_cp(self,disc,previous=None,inputs=None,nested=False):
        self.refresh();args=dict(discussion_uuid=disc['uuid'],previous_accepted_ref=previous,high_water=self.plan['commit_seq'],input_refs=inputs or [],next_action='Inline reconcile then independent raw-source review')
        request=self.request('checkpoint.prepare',args)
        if nested:request=self.request('transaction.apply',dict(operations=[dict(operation='checkpoint.prepare',args=args)]))
        receipt=self.ok(self.call(request));self.refresh();cp=[x for x in self.items if x['kind']=='checkpoint' and x['body']['discussion_uuid']==disc['uuid']][-1]
        return cp,request,receipt

    def apply_cp(self,cp,updates=None):
        self.refresh();base=copy.deepcopy(self.ticket);items=copy.deepcopy(self.items);ops=[]
        for old,body in updates or []:
            item=next(x for x in items if x['uuid']==old['uuid']);item['body']=body;item['revision_uuid']=uid()
            ops.append(dict(operation='record.update',args=dict(uuid=old['uuid'],body=body,source_refs=old['source_refs'],extensions=old['extensions'])))
        args=dict(discussion_uuid=cp['body']['discussion_uuid'],patch_preview_digest=digest(dict(input_sha256=cp['body']['input_sha256'],patches=patch_manifest(base,items))))
        ops.append(dict(operation='checkpoint.apply',args=args));request=self.request('transaction.apply',dict(operations=ops)) if updates else self.request('checkpoint.apply',args)
        self.ok(self.call(request));self.refresh();return next(x for x in self.items if x['uuid']==cp['uuid'])

    def review_cp(self,cp,verdict='pass',proof_override=None,reviewer=None):
        self.refresh();identity=uid();writer=self.fx.writer
        binding=self.fx.save(envelope('content',dict(title='Independent reviewer actual host',category_uuid=uid(),format='json',content=dict(actual_cwd=str(CHECKOUT),permissions='danger-full-access',runtime_kind='ephemeral'),authority='active_code_constraint',state='active',item_uuids=[]),writer))
        assignment=self.fx.save(envelope('assignment',{**self.fx.assignment['body'],'ticket_uuid':self.ticket['root_uuid'],'work_kind':'evaluation','role':'checkpoint-reviewer','eligible_actor_uuid':identity,'node_uuid':cp['uuid'],'manager_uuid':self.fx.actor['uuid'],'report_path':str(self.fx.home/'reports'/identity)},writer))
        body=dict(role='checkpoint-reviewer',runtime_kind='ephemeral',runtime_id=None,host_id=None,parent_actor_uuid=None,actual_cwd=str(CHECKOUT),binding_evidence_ref=ref(binding),assignment_refs=[ref(assignment)],granted_operations=[],state='active')
        self.ok(self.call(self.request('actor.bind',dict(body=body,binding_evidence_ref=ref(binding),authority_ref=ref(self.fx.authority)),ticket=False)));self.refresh()
        reviewer=reviewer or next(x for x in current(self.plan) if x['uuid']==identity);w=dict(actor_uuid=reviewer['uuid'],runtime_kind='ephemeral',runtime_id=None,parent_actor_uuid=None)
        required=[ref(cp)]+cp['body']['patched_refs'];proof=dict(checkpoint_ref=ref(cp),input_sha256=cp['body']['input_sha256'],raw_input_refs=cp['body']['input_refs'],patched_refs=cp['body']['patched_refs'],readback_refs=required,reviewer_actor_uuid=reviewer['uuid'],source_review=True)
        if proof_override:proof.update(proof_override)
        report=self.fx.save(envelope('content',dict(title='Fresh raw-source review report',category_uuid=uid(),format='json',content=proof,authority='active_code_constraint',state='active',item_uuids=[]),w))
        review=self.fx.save(envelope('review',dict(assignment_uuid=assignment['uuid'],attempt_uuid=uid(),subject_refs=required,subject_digest=digest(required),mode='checkpoint-raw-source',reviewer_actor_uuid=reviewer['uuid'],evidence_refs=cp['body']['input_refs'],verdict=verdict,finding_refs=[],report_ref=ref(report)),w))
        return review

    def close_req(self,cp,review,nested=False):
        args=dict(discussion_uuid=cp['body']['discussion_uuid'],review_ref=ref(review),readback_refs=[ref(cp)]+cp['body']['patched_refs'],next_action='Owner resumes saved questions')
        return self.request('transaction.apply',dict(operations=[dict(operation='checkpoint.close',args=args)])) if nested else self.request('checkpoint.close',args)

    def close_cp(self,cp,nested=False):
        review=self.review_cp(cp);request=self.close_req(cp,review,nested);receipt=self.ok(self.call(request));self.refresh();return next(x for x in self.items if x['uuid']==cp['uuid']),request,receipt

    def test_a08_first_null_later_exact_peer_and_tail_physical_readback(self):
        a,_,_=self.register(self.actor());other,_,_=self.bind();b,_,_=self.register(other)
        # Peer is independently registered; use manager's own second phase peer for public closure.
        # The main may create later discussions only after closing its first one.
        self.ok(self.call(self.summary(self.actor(),a,'Original correction retained')))
        original=copy.deepcopy(self.ticket);cp,_,_=self.prepare_cp(a,nested=True)
        self.assertIsNone(cp['body']['prior_checkpoint_ref']);self.assertEqual(cp['body']['lower_seq'],a['body']['opened_seq']);self.assertEqual(len(cp['body']['coverage_refs']),1)
        self.ok(self.call(self.summary(self.actor(),a,'Tail after frozen high-water')))
        cp=self.apply_cp(cp);closed,request,receipt=self.close_cp(cp,nested=True)
        self.assertEqual(closed['body']['state'],'closed');self.assertEqual(closed['body']['coverage_refs'],cp['body']['coverage_refs'])
        self.assertEqual(self.ok(self.call(request))['receipt_ref'],receipt['receipt_ref'])
        from core.discussions import projection
        from core.journal import readout
        landscape=projection(self.items,self.phases[0]['uuid']);self.assertFalse(landscape['phase_checks'][self.phases[0]['uuid']]);self.assertTrue(next(x for x in landscape['discussions'] if x['discussion_uuid']==a['uuid'])['checked'])
        log=readout(next(x for x in self.items if x['uuid']==a['uuid']),self.items,current(self.plan));self.assertEqual(len(log['uncovered_entry_refs']),1);self.assertEqual(log['logs'][0]['Threads'],['Keep unfinished question']);self.assertIn(original['revisions'][0],self.ticket['revisions'])
        later,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),later,'Later same phase')))
        bad=self.request('checkpoint.prepare',dict(discussion_uuid=later['uuid'],previous_accepted_ref=None,high_water=self.plan['commit_seq'],input_refs=[],next_action='Must refuse'))
        self.refuse(bad,'REVISION_CONFLICT');cp,_,_=self.prepare_cp(later,ref(closed));self.assertEqual(cp['body']['prior_checkpoint_ref'],ref(closed));self.close_cp(self.apply_cp(cp))
        self.assertFalse((self.fx.home/'CHECKPOINT.json').exists())

    def test_a08_guards_direct_nested_omitted_foreign_unreviewed_and_closed(self):
        a,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),a)));cp,_,_=self.prepare_cp(a)
        for nested in (False,True):
            args=dict(discussion_uuid=a['uuid'],high_water=self.plan['commit_seq'],input_refs=[],next_action='Refusal')
            req=self.request('transaction.apply',dict(operations=[dict(operation='checkpoint.prepare',args=args)])) if nested else self.request('checkpoint.prepare',args)
            self.refuse(req,'INVALID_SCHEMA')
            args['previous_accepted_ref']=ref(cp);req=self.request('transaction.apply',dict(operations=[dict(operation='checkpoint.prepare',args=args)])) if nested else self.request('checkpoint.prepare',args)
            self.refuse(req,'INVALID_TRANSITION')
            args['previous_accepted_ref']=ref(self.fx.authority);req=self.request('transaction.apply',dict(operations=[dict(operation='checkpoint.prepare',args=args)])) if nested else self.request('checkpoint.prepare',args)
            self.refuse(req,'INVALID_TRANSITION')
        reconciled=self.apply_cp(cp);closed,_,_=self.close_cp(reconciled)
        self.refuse(self.request('checkpoint.prepare',dict(discussion_uuid=a['uuid'],previous_accepted_ref=ref(closed),high_water=self.plan['commit_seq'],input_refs=[],next_action='Cannot reopen')),'INVALID_TRANSITION')
        d,_,_=self.register(self.actor(),1)
        self.refuse(self.request('checkpoint.prepare',dict(discussion_uuid=d['uuid'],previous_accepted_ref=ref(closed),high_water=self.plan['commit_seq'],input_refs=[],next_action='Foreign phase')),'INVALID_TRANSITION')

    def test_a08_failed_incomplete_self_stale_review_and_missing_raw_preserve_open(self):
        d,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),d)));cp,_,_=self.prepare_cp(d)
        review=self.review_cp(cp);self.refuse(self.close_req(cp,review),'INVALID_TRANSITION');cp=self.apply_cp(cp)
        for verdict in ('failed','incomplete','findings'):
            r=self.review_cp(cp,verdict);self.refuse(self.close_req(cp,r),'MISSING_EVIDENCE')
        r=self.review_cp(cp,proof_override={'source_review':False});self.refuse(self.close_req(cp,r,True),'MISSING_EVIDENCE')
        r=self.review_cp(cp,reviewer=self.actor());self.refuse(self.close_req(cp,r),'FORBIDDEN')
        r=self.review_cp(cp);bad=self.close_req(cp,r);bad['args']['readback_refs']=[];self.refuse(bad,'MISSING_EVIDENCE')
        declared=self.fx.save(envelope('content',dict(title='Declared source',category_uuid=uid(),format='plain',content='raw',authority='source_of_truth_contract',state='active',item_uuids=[]),self.fx.writer))
        fresh,_,_=self.prepare_cp(d,inputs=[ref(declared)]);fresh=self.apply_cp(fresh);r=self.review_cp(fresh)
        source=self.fx.root/'.evidence'/(declared['revision_uuid']+'.json');data=source.read_bytes();source.unlink()
        try:self.refuse(self.close_req(fresh,r),'MISSING_EVIDENCE')
        finally:source.write_bytes(data)
        self.refresh();self.assertTrue(all(x['body']['state']=='open' for x in self.items if x['kind']=='discussion'));self.assertTrue(all(x['body']['state']!='closed' for x in self.items if x['kind']=='checkpoint'))
        self.close_cp(fresh)

    def test_a08_inline_patch_original_hash_and_later_nested_edit_refused(self):
        d,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),d)))
        category=next(x for x in self.items if x['kind']=='category');old=next(x for x in self.items if x['kind']=='content' and x['body']['authority']=='implementation_choice') if any(x['kind']=='content' and x['body']['authority']=='implementation_choice' for x in self.items) else None
        if old is None:
            self.ok(self.call(self.request('record.create',dict(kind='content',body=dict(title='Reconcile',category_uuid=category['uuid'],format='plain',content='Original unresolved question',authority='proposal',state='pending',item_uuids=[]),source_refs=[],extensions={'source.preserved':{'false_flag':False}}))));self.refresh();old=next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Reconcile')
        cp,_,_=self.prepare_cp(d,inputs=[ref(old)]);new={**old['body'],'content':'Corrected, preserve original unresolved question'};cp=self.apply_cp(cp,[(old,new)]);self.assertEqual(len(cp['body']['patched_refs']),1);self.assertIn(old,self.ticket['revisions'])
        review=self.review_cp(cp);request=self.close_req(cp,review,True);current_item=next(x for x in self.items if x['uuid']==old['uuid']);request['args']['operations'].append(dict(operation='record.update',args=dict(uuid=old['uuid'],body={**new,'content':'Unreviewed later change'},source_refs=[],extensions=current_item['extensions'])))
        self.refuse(request,'REVISION_CONFLICT');closed,_,_=self.close_cp(cp);self.assertEqual(closed['body']['input_refs'][-1],ref(old))

    def test_a08_peer_acceptance_invalidates_prepared_then_all_phase_closed(self):
        # Two actual fronting actors require their own grants. Bind a peer using
        # manager actor.bind, preserving local host evidence and exact assignment.
        a,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),a,'A')))
        # Another open phase of same actor has foreign predecessor semantics.
        # A second same-phase peer is bound through the public manager operation.
        identity=uid();binding=self.fx.binding;assignment=self.fx.save(envelope('assignment',{**self.fx.assignment['body'],'ticket_uuid':self.ticket['root_uuid'],'role':'launchpad','eligible_actor_uuid':identity,'report_path':str(self.fx.home/'reports'/identity)},self.fx.writer))
        body={**self.fx.actor['body'],'role':'launchpad','assignment_refs':[ref(assignment)],'granted_operations':self.fx.actor['body']['granted_operations']}
        self.ok(self.call(self.request('actor.bind',dict(body=body,binding_evidence_ref=ref(binding),authority_ref=ref(self.fx.authority)),ticket=False)));self.refresh();peer=next(x for x in current(self.plan) if x['uuid']==identity);b,_,_=self.register(peer);self.ok(self.call(self.summary(peer,b,'B')))
        ca,_,_=self.prepare_cp(a);ca=self.apply_cp(ca);ra=self.review_cp(ca);old_actor=self.fx.actor
        self.fx.actor=peer
        try:
            cb,_,_=self.prepare_cp(b);cb=self.apply_cp(cb)
            # review manager binding stays assigned parent; use original manager.
            self.fx.actor=old_actor;r=self.review_cp(cb);self.fx.actor=peer
            self.ok(self.call(self.close_req(cb,r)));self.refresh();cb=next(x for x in self.items if x['uuid']==cb['uuid'])
        finally:self.fx.actor=old_actor
        bad=self.request('checkpoint.apply',dict(discussion_uuid=a['uuid'],patch_preview_digest=digest(dict(input_sha256=ca['body']['input_sha256'],patches=[]))));self.refuse(bad,'REVISION_CONFLICT')
        for nested in (False,True):self.refuse(self.close_req(ca,ra,nested),'REVISION_CONFLICT')
        ca,_,_=self.prepare_cp(a,ref(cb));ca=self.apply_cp(ca);self.close_cp(ca)
        from core.discussions import projection
        self.assertTrue(projection(self.items)['phase_checks'][self.phases[0]['uuid']]);self.assertEqual(len([x for x in self.items if x['kind']=='discussion' and x['body']['state']=='closed']),2)
        latest=next(x for x in self.items if x['uuid']==ca['uuid']);later,_,_=self.register(self.actor());self.assertFalse(projection(self.items)['phase_checks'][self.phases[0]['uuid']])
        for nested in (False,True):
            args=dict(discussion_uuid=later['uuid'],previous_accepted_ref=ref(cb),high_water=self.plan['commit_seq'],input_refs=[],next_action='Stale accepted predecessor')
            request=self.request('transaction.apply',dict(operations=[dict(operation='checkpoint.prepare',args=args)])) if nested else self.request('checkpoint.prepare',args)
            self.refuse(request,'REVISION_CONFLICT')

    def test_a08_added_checkpoint_fault_original_replay_and_exact_canonical(self):
        d,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),d)))
        trace=self.fx.root/'trace.jsonl';self.refresh();args=dict(discussion_uuid=d['uuid'],previous_accepted_ref=None,high_water=self.plan['commit_seq'],input_refs=[],next_action='Trace')
        self.ok(self.call(self.request('checkpoint.prepare',args),extra={'LP_TX_TRACE':str(trace)}));events=[json.loads(x) for x in trace.read_text().splitlines()];self.raw.append(dict(boundaries=events))
        cases=[next(x for x in events if x['stage']=='write_bytes' and x['path'].endswith('ticket.json')),next(x for x in events if x['stage']=='selector'),next(x for x in events if x['stage']=='readback'),next(x for x in events if x['stage']=='reply')]
        for event in cases:
            self.refresh();original=dict(plan=copy.deepcopy(self.plan),ticket=copy.deepcopy(self.ticket),prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text()))
            args['high_water']=self.plan['commit_seq'];request=self.request('checkpoint.prepare',args);code,result=self.call(request,extra={'LP_TX_FAIL':str(event['index'])});self.assertEqual(code,3,result);self.refresh();failed=copy.deepcopy(self.ticket)
            receipt=self.ok(self.call(request));self.refresh();replay=self.ok(self.call(request));self.assertEqual(replay['receipt_ref'],receipt['receipt_ref']);self.refresh();self.raw.append(dict(physical_fault_stage=event,original=original,after_fault=failed,after_replay=dict(plan=self.plan,ticket=self.ticket,prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text())),request_sha256=digest(request)))

    def test_a08_old_accepted_coverage_survives_raw_source_gap_and_stale_review(self):
        d,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),d)))
        cp,_,_=self.prepare_cp(d);closed,_,_=self.close_cp(self.apply_cp(cp));old=copy.deepcopy(closed)
        later,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),later,'Later raw inputs')))
        source=self.fx.sources/'declared.txt';source.write_text('Original exact raw bytes')
        pin=dict(kind='source_of_truth_contract',locator=str(source),revision='raw/1',sha256=file_hash(source),recorded_at=old['last_updated'],native_ref=None)
        declared=self.fx.save(envelope('content',dict(title='Exact physical source',category_uuid=uid(),format='plain',content='Original exact raw bytes',authority='source_of_truth_contract',state='active',item_uuids=[]),self.fx.writer,[pin]))
        cp,_,_=self.prepare_cp(later,ref(closed),[ref(declared)]);cp=self.apply_cp(cp);review=self.review_cp(cp)
        for replacement in (None,'Newer different raw bytes'):
            original=source.read_bytes()
            if replacement is None:source.unlink()
            else:source.write_text(replacement)
            try:
                for nested in (False,True):self.refuse(self.close_req(cp,review,nested),'MISSING_EVIDENCE' if replacement is None else 'REVISION_CONFLICT')
            finally:source.write_bytes(original)
        newer,_,_=self.prepare_cp(later,ref(closed),[ref(declared)]);newer=self.apply_cp(newer)
        self.refuse(self.close_req(newer,review),'MISSING_EVIDENCE');self.refresh();self.assertIn(old,self.items);self.assertEqual(next(x for x in self.items if x['uuid']==later['uuid'])['body']['state'],'open')
        self.close_cp(newer)

    def test_a08_close_added_write_faults_preserve_exact_acceptance_and_replay(self):
        d,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),d)));cp,_,_=self.prepare_cp(d);cp=self.apply_cp(cp);review=self.review_cp(cp)
        trace=self.fx.root/'close-trace.jsonl';request=self.close_req(cp,review);self.ok(self.call(request,extra={'LP_TX_TRACE':str(trace)}));events=[json.loads(x) for x in trace.read_text().splitlines()];self.raw.append(dict(close_boundaries=events))
        # A later fresh same-phase discussion gives a real current close target
        # for every stage; no canonical reconstruction or fake closure.
        prior=next(x for x in self.items if x['uuid']==cp['uuid']) if cp['body']['state']=='closed' else None
        self.refresh();prior=next(x for x in self.items if x['uuid']==cp['uuid'])
        for event in [next(x for x in events if x['stage']=='write_bytes' and x['path'].endswith('ticket.json')),next(x for x in events if x['stage']=='selector'),next(x for x in events if x['stage']=='readback'),next(x for x in events if x['stage']=='reply')]:
            d,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),d)));cp,_,_=self.prepare_cp(d,ref(prior));cp=self.apply_cp(cp);review=self.review_cp(cp);request=self.close_req(cp,review)
            self.refresh();original=dict(plan=copy.deepcopy(self.plan),ticket=copy.deepcopy(self.ticket));code,result=self.call(request,extra={'LP_TX_FAIL':str(event['index'])});self.assertEqual(code,3,result);self.refresh();failed=dict(plan=copy.deepcopy(self.plan),ticket=copy.deepcopy(self.ticket));committed=event['stage'] in ('readback','reply');self.assertEqual(next(x for x in self.items if x['uuid']==d['uuid'])['body']['state'],'closed' if committed else 'open')
            receipt=self.ok(self.call(request));self.refresh();self.assertEqual(self.ok(self.call(request))['receipt_ref'],receipt['receipt_ref']);self.refresh();prior=next(x for x in self.items if x['uuid']==cp['uuid']);self.raw.append(dict(close_fault=event,original=original,after_fault=failed,after_replay=dict(plan=self.plan,ticket=self.ticket),request_sha256=digest(request)))

    def test_a08_public_fresh_readback_and_real_closed_phase_exclusion(self):
        native=self.fx.root/'CHECKPOINT.json';native.write_bytes(b'{"native_cursor":"untouched-original"}');original_native=file_hash(native)
        a,_,_=self.register(self.actor(),0);self.ok(self.call(self.summary(self.actor(),a,'Older still-open phase')))
        b,_,_=self.register(self.actor(),1);self.ok(self.call(self.summary(self.actor(),b,'Newer closing phase')))
        cp,_,_=self.prepare_cp(b);cp=self.apply_cp(cp);closed,_,_=self.close_cp(cp)
        from core.discussions import projection
        landscape=projection(self.items);self.assertEqual(landscape['current_phase_node_uuid'],self.phases[0]['uuid']);self.assertTrue(landscape['phase_checks'][self.phases[1]['uuid']]);self.assertFalse(landscape['phase_checks'][self.phases[0]['uuid']])
        response=self.ok(self.call(self.request('record.get',dict(uuid=closed['uuid'],fields=['uuid','revision_uuid','body','writer','extensions','created_at']))));self.assertEqual(response['rows'][0]['fields']['body'],closed['body']);self.assertEqual(response['rows'][0]['fields']['revision_uuid'],closed['revision_uuid']);self.assertEqual(file_hash(native),original_native)
        self.raw.append(dict(native_checkpoint_original_bytes=native.read_text(),native_checkpoint_sha256=original_native,exact_closed_record_sha256=digest(closed),fresh_public_readback=response))

    def test_a08_foreign_ticket_predecessor_is_refused_direct_and_nested(self):
        d,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),d)));cp,_,_=self.prepare_cp(d);closed,_,_=self.close_cp(self.apply_cp(cp))
        first=self.ticket['root_uuid'];self.ok(self.call(self.fx.seed('Foreign disposable ticket')));self.refresh();second=next(t for key,t in self.ts.items() if key!=first);items=current(second);phase=next(x for x in items if x['kind']=='workflow_node' and x['body']['node_kind']=='conversation')
        def scoped(op,args):
            request=self.request(op,args);request['scope']['ticket_uuid']=second['root_uuid'];request['expected']={k:v for k,v in request['expected'].items() if k not in {x['uuid'] for x in self.items}};request['expected'].update({x['uuid']:x['revision_uuid'] for x in items})
            if op=='transaction.apply':request['args']['expected']=request['expected']
            return request
        receipt=self.ok(self.call(scoped('discussion.register',dict(actor_uuid=self.actor()['uuid'],phase_node_uuid=phase['uuid']))));self.refresh();second=self.ts[second['root_uuid']];items=current(second);discussion=next(x for x in items if x['kind']=='discussion')
        for nested in (False,True):
            args=dict(discussion_uuid=discussion['uuid'],previous_accepted_ref=ref(closed),high_water=self.plan['commit_seq'],input_refs=[],next_action='Foreign same-shaped predecessor must refuse')
            req=scoped('transaction.apply',dict(operations=[dict(operation='checkpoint.prepare',args=args)])) if nested else scoped('checkpoint.prepare',args)
            self.refuse(req,'INVALID_TRANSITION')

    def test_a08_original_WA001_public_direct_nested_shapes(self):
        d,_,_=self.register(self.actor());self.ok(self.call(self.summary(self.actor(),d)))
        samples=json.loads((CHECKOUT/'launchpad/assets/schema/conformance.samples.json').read_text())
        for case in samples['shape_cases']:
            if not case['name'].startswith('WA001'):continue
            self.refresh();args=dict(discussion_uuid=d['uuid'],high_water=self.plan['commit_seq'],input_refs=[],next_action='Original WA001 public semantics')
            if 'missing' not in case['name']:args['previous_accepted_ref']=None
            req=self.request('transaction.apply',dict(operations=[dict(operation='checkpoint.prepare',args=args)])) if 'nested' in case['name'] else self.request('checkpoint.prepare',args)
            if 'missing' in case['name']:self.refuse(req,'INVALID_SCHEMA')
            else:self.ok(self.call(req))


# Do not duplicate inherited test functions in this suite's public evidence.
for _name in list(DiscussionsTests.__dict__):
    if _name.startswith('test_'):
        setattr(CheckpointsTests,_name,None)

del DiscussionsTests
