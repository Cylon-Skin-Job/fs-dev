"""A07 public real-filesystem discovery, bound concurrent journals and refusal proof."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from support import Fixture,CHECKOUT,CLI,current,read_generation,uid,ref,envelope,file_hash,encode
from core.commands import INSTALLED,REGISTRY
from core.schema import named
from core.store import digest


class DiscussionsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.fx=Fixture(self.tmp.name);self.raw=[]
        self.fx.actor['body']['granted_operations']=sorted(INSTALLED);self.fx.save(self.fx.actor)
        self.fx.run=self.call
        self.ok(self.fx.create('A07 disposable public proof'));self.ok(self.call(self.fx.seed()));self.refresh()

    def tearDown(self):
        destination=os.environ.get('LP_A07_REPORT')
        if destination:
            path=Path(destination);cases=json.loads(path.read_text()) if path.exists() else []
            self.refresh();prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text())
            cases.append(dict(test=self.id(),requests=self.raw,final_readback=dict(plan=self.plan,tickets=self.ts,prepared=prepared,plan_sha256=file_hash(self.folder/'plan.json'),
                ticket_sha256=file_hash(self.folder/'tickets'/(self.ticket['root_uuid']+'.json')),view_hashes={k:file_hash(self.folder/k) for k in prepared['view_hashes']}),temporary_fixture='Removed after exact canonical/raw proof retention'))
            path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(encode(cases))
        self.tmp.cleanup()

    def call(self,request,cwd=CHECKOUT,extra=None):
        path=self.fx.root/('request-'+uid()+'.json');path.write_bytes(encode(request));argv=[sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)]
        env={**os.environ,**(extra or {})};proc=subprocess.run(argv,cwd=cwd,env=env,capture_output=True,text=True)
        self.raw.append(dict(argv=argv,workdir=str(cwd),env_overrides=extra or {},request_bytes=path.read_text(),request_sha256=file_hash(path),stdout=proc.stdout,stderr=proc.stderr,exit=proc.returncode,
                             stdout_sha256=__import__('hashlib').sha256(proc.stdout.encode()).hexdigest()))
        if not proc.stdout:raise AssertionError(proc.stderr)
        value=json.loads(proc.stdout);named(value,'response.schema.json');return proc.returncode,value

    def ok(self,result):
        code,value=result;self.assertEqual(code,0,value);return value

    def refresh(self):
        self.plan,self.ts,self.folder=read_generation(self.fx.home);self.ticket=next(iter(self.ts.values()));self.items=current(self.ticket)
        self.phases=[x for x in self.items if x['kind']=='workflow_node' and x['body']['node_kind']=='conversation' and x['body']['parent_uuid'] is None and x['body']['title']!='Ticket Created']

    def request(self,op,args,actor=None,key=None,ticket=True):
        self.refresh();selected=actor or self.fx.actor
        scope=dict(plan_uuid=self.plan['root_uuid'],include_history=False)
        if ticket:scope['ticket_uuid']=self.ticket['root_uuid']
        value=dict(interface_version=1,tool=REGISTRY[op]['tool'],operation=op,args=args,scope=scope,actor_binding_ref=ref(selected))
        if value['tool'] in ('db.mutate','db.transaction'):
            expected={x['uuid']:x['revision_uuid'] for x in current(self.plan)+(self.items if ticket else [])}
            for path in (self.fx.root/'.evidence').glob('*.json'):
                e=json.loads(path.read_text());expected.setdefault(e['uuid'],e['revision_uuid'])
            value.update(idempotency_key=key or uid(),expected=expected,expected_plan_revision_uuid=self.plan['root_revision_uuid'])
            if op=='transaction.apply':value['args']['expected']=expected
        return value

    def entry(self,cwd=CHECKOUT,**kwargs):
        return dict(interface_version=1,tool='db.context',operation='session.entry',args=dict(actual_cwd=str(cwd),**kwargs))

    def bind(self,role='launchpad',runtime_kind='ephemeral',parent=None,ticket_id=None):
        identity=uid();writer=self.fx.writer;ticket_id=ticket_id or self.ticket['root_uuid']
        proof=dict(actual_cwd=str(CHECKOUT),runtime_kind=runtime_kind,permissions='danger-full-access')
        if runtime_kind=='child':proof.update(runtime_id='actual-test-child-'+identity,parent_actor_uuid=parent)
        binding=self.fx.save(envelope('content',dict(title='Saved local actual host evidence',category_uuid=uid(),format='json',content=proof,authority='active_code_constraint',state='active',item_uuids=[]),writer))
        old=self.fx.assignment['body'];assignment=self.fx.save(envelope('assignment',{**old,'ticket_uuid':ticket_id,'node_uuid':self.phases[0]['uuid'],'role':role,'eligible_actor_uuid':identity,'manager_uuid':parent or self.fx.actor['uuid'],
            'write_paths':[str(self.fx.home)],'report_path':str(self.fx.home/'reports'/identity),'source_checkout':str(self.fx.sources)},writer))
        body=dict(role=role,runtime_kind=runtime_kind,runtime_id=proof.get('runtime_id'),host_id=None,parent_actor_uuid=parent,actual_cwd=str(CHECKOUT),
            binding_evidence_ref=ref(binding),assignment_refs=[ref(assignment)],granted_operations=['discussion.summary_record'] if parent else ['actor.bind','discussion.register','discussion.summary_record'],state='active')
        manager=next(x for x in current(self.plan) if x['uuid']==parent) if parent else self.fx.actor
        req=self.request('actor.bind',dict(body=body,binding_evidence_ref=ref(binding),authority_ref=ref(self.fx.authority)),manager,ticket=False)
        result=self.ok(self.call(req));self.refresh();actor=next(x for x in current(self.plan) if x['uuid']==identity);self.assertEqual(ref(actor),next(x for x in result['changed_refs'] if x['entry_uuid']==identity))
        return actor,assignment,req

    def register(self,actor,phase=0):
        req=self.request('discussion.register',dict(phase_node_uuid=self.phases[phase]['uuid'],actor_uuid=actor['uuid']),actor)
        receipt=self.ok(self.call(req));self.refresh();discussion=next(x for x in self.items if x['kind']=='discussion' and x['body']['actor_uuid']==actor['uuid'] and x['body']['phase_node_uuid']==self.phases[phase]['uuid'])
        return discussion,receipt,req

    def summary(self,actor,discussion,focus='Saved focus',recorded=None):
        return self.request('discussion.summary_record',dict(discussion_uuid=discussion['uuid'],focus=focus,summary='Saved summary: '+focus,recorded_item_refs=recorded or [],
                            capture_only_items=['Capture-only thought, not a mutation'],open_threads=['Keep unfinished question'],gaps=[]),actor)

    def refuse(self,request,code,cwd=CHECKOUT):
        self.refresh();before=(self.plan['root_revision_uuid'],file_hash(self.folder/'plan.json'),file_hash(self.folder/'plan.HTML'))
        result,value=self.call(request,cwd);self.assertEqual(result,2,value);self.assertEqual(value['code'],code,value);self.assertEqual(value['commit_state'],'nonmutation')
        self.refresh();self.assertEqual(before,(self.plan['root_revision_uuid'],file_hash(self.folder/'plan.json'),file_hash(self.folder/'plan.HTML')));return value

    def test_actual_cwd_known_missing_explicit_assignment_and_manager_transition(self):
        child=self.fx.home/next(x for x in self.items if x['kind']=='ticket')['body']['current_home']
        original=file_hash(self.folder/'plan.json');known=self.ok(self.call(self.entry(child),child))
        self.assertEqual(known['resolution'],'resolved');self.assertEqual(known['selected_scope']['ticket_uuid'],self.ticket['root_uuid']);self.assertIsNone(known['actor_binding_ref']);self.assertEqual(known['next_action'],'request_manager_binding');self.assertEqual(file_hash(self.folder/'plan.json'),original)
        missing_dir=self.fx.root/'unknown';missing_dir.mkdir();missing=self.ok(self.call(self.entry(missing_dir),missing_dir));self.assertEqual(missing['resolution'],'missing');self.assertIsNone(missing['selected_scope']);self.assertEqual(missing['candidate_bindings'],[])
        self.refuse(self.entry(child),'SOURCE_UNVERIFIED')
        body=dict(phase_node_uuid=self.phases[0]['uuid'],actor_uuid=uid());unbound=dict(interface_version=1,tool='db.mutate',operation='discussion.register',args=body,scope=known['selected_scope'],idempotency_key=uid(),expected={},expected_plan_revision_uuid=self.plan['root_revision_uuid'])
        self.refuse(unbound,'INVALID_SCHEMA')
        actor,assignment,_=self.bind();selected=self.ok(self.call(self.entry(assignment_ref=ref(assignment))));self.assertEqual(selected['resolution'],'resolved');self.assertEqual(selected['options'],['Assigned role: launchpad']);self.assertIsNone(selected['actor_binding_ref'])
        req=self.entry(assignment_ref=ref(assignment));req['actor_binding_ref']=ref(actor);existing=self.ok(self.call(req));self.assertEqual(existing['next_action'],'use_existing_binding');self.assertEqual(existing['actor_binding_ref'],ref(actor))
        routing=self.fx.root/'plans.json';original_routes=routing.read_bytes();unrelated=[dict(uuid=uid(),title='Unavailable bounded header fixture',current_home='work-tickets/unrelated-'+str(i)) for i in range(101)]
        try:
            routing.write_bytes(encode(unrelated+json.loads(original_routes)));self.raw.append(dict(routing_fixture='Synthetic unrelated unavailable registry headers; exact assignment must filter before bounded lookup',headers=unrelated))
            exact=self.ok(self.call(req));self.assertEqual(exact['selected_scope']['ticket_uuid'],self.ticket['root_uuid'])
        finally:routing.write_bytes(original_routes)
        forged=copy.deepcopy(req);forged['actor_binding_ref']['sha256']='0'*64;self.refuse(forged,'FORBIDDEN')
        foreign=self.entry(assignment_ref=ref(assignment),ticket_uuid=uid());self.refuse(foreign,'BINDING_AMBIGUOUS')
        self.register(actor)
        resume=self.ok(self.call(self.request('discussion.resume_context',dict(ticket_uuid=self.ticket['root_uuid'],actual_cwd=str(CHECKOUT),assignment_uuid=assignment['uuid']),actor)))
        self.assertFalse(resume['details']['role_question_required']);self.assertEqual(resume['details']['role'],'launchpad');self.assertEqual(len(resume['details']['options']),3);self.assertIn('ask owner',resume['details']['prior_chat'])
        bounded=self.ok(self.call(self.request('discussion.resume_context',dict(ticket_uuid=self.ticket['root_uuid'],actual_cwd=str(CHECKOUT),budget_bytes=1500),actor)))
        self.assertLessEqual(len(json.dumps(bounded,ensure_ascii=False,separators=(',',':')).encode()),1500);self.assertEqual(bounded['details']['options'],resume['details']['options']);self.assertGreater(bounded['remaining'],0);self.assertTrue(bounded['gaps'])

    def test_ambiguous_exact_registered_assignments_return_choices_and_bounds(self):
        actor,assignment,_=self.bind();self.ok(self.call(self.fx.seed('Second ticket')));self.refresh();second=next(key for key in self.ts if key!=self.ticket['root_uuid']);other,other_assignment,_=self.bind(ticket_id=second)
        result=self.ok(self.call(self.entry()));self.assertEqual(result['resolution'],'ambiguous');self.assertIsNone(result['selected_scope']);self.assertEqual({x['ticket_uuid'] for x in result['candidate_bindings']},{self.ticket['root_uuid'],second});self.assertEqual(result['context_headers'],[])
        resolved=self.ok(self.call(self.entry(assignment_ref=ref(other_assignment))));self.assertEqual(resolved['selected_scope']['ticket_uuid'],second)
        bounded=self.ok(self.call(self.entry(budget_bytes=1800)));self.assertLessEqual(len(json.dumps(bounded,ensure_ascii=False,separators=(',',':')).encode()),1800);self.assertEqual(bounded['resolution'],'ambiguous')
        self.refuse(self.entry(budget_bytes=1),'INVALID_SCHEMA')

    def test_simultaneous_phase_entries_receipts_children_and_fresh_resume(self):
        a,assignment_a,_=self.bind();b,_,_=self.bind();da,receipt_a,registration=self.register(a,0);db,_,_=self.register(b,1)
        self.ok(self.call(self.summary(a,da,'Front A',recorded=[receipt_a['receipt_ref']])));self.refresh();saved_a=copy.deepcopy(next(x for x in self.items if x['uuid']==da['uuid']))
        a_result=self.ok(self.call(self.summary(b,db,'Front B')));self.refresh();self.assertEqual(next(x for x in self.items if x['kind']=='ticket')['body']['current_workflow_node_uuid'],self.phases[1]['uuid'])
        child,_,_=self.bind('inline-support','child',a['uuid']);self.ok(self.call(self.summary(child,saved_a,'Actual child contribution')));self.refresh()
        self.assertEqual(next(x for x in self.items if x['kind']=='ticket')['body']['current_workflow_node_uuid'],self.phases[1]['uuid'])
        entry=next(x for x in self.items if x['kind']=='journal_entry' and x['writer']['actor_uuid']==child['uuid']);self.assertEqual(entry['writer']['parent_actor_uuid'],a['uuid']);self.assertIsNone(entry['body']['source_native_locator'])
        self.refuse(self.request('discussion.register',dict(phase_node_uuid=self.phases[0]['uuid'],actor_uuid=child['uuid']),child),'FORBIDDEN')
        self.ok(self.call(self.summary(a,saved_a,'Front A again')));self.refresh();self.assertEqual(next(x for x in self.items if x['kind']=='ticket')['body']['current_workflow_node_uuid'],self.phases[0]['uuid'])
        before={x['uuid']:copy.deepcopy(x) for x in self.items if x['kind']=='discussion'};fresh,_,_=self.bind();self.register(fresh,1);self.refresh();self.assertEqual({x['uuid']:x for x in self.items if x['uuid'] in before},before)
        resume=self.ok(self.call(self.request('context.reentry',dict(ticket_uuid=self.ticket['root_uuid'],actual_cwd=str(CHECKOUT)),fresh)));self.assertEqual(len(resume['details']['unfinished_discussion_uuids']),3);self.assertTrue(all(not v for v in resume['details']['phase_checks'].values()))
        data=json.loads((self.folder/'tickets'/(self.ticket['root_uuid']+'.html')).read_text().split('<script id="rv-snapshot" type="application/json">')[1].split('</script>')[0]);logs=data['discussion_disclosures'][self.ticket['root_uuid']]['logs'][da['uuid']]['logs'];self.assertEqual(logs[0]['Recorded'][0]['receipt_ref'],receipt_a['receipt_ref']);self.assertEqual(ref(logs[0]['Recorded'][0]['receipt']),receipt_a['receipt_ref']);self.assertEqual(logs[1]['writer']['actor_uuid'],child['uuid']);self.assertEqual(logs[1]['Threads'],['Keep unfinished question'])
        self.assertEqual(self.ok(self.call(registration))['receipt_ref'],receipt_a['receipt_ref']);self.refresh();self.assertEqual(len([x for x in self.items if x['kind']=='discussion']),3)

    def test_direct_nested_refusals_grants_and_exact_dependencies(self):
        actor,_,bind=self.bind();disc,_,_=self.register(actor)
        forged=self.summary(actor,disc);forged['args']['discussion_uuid']=uid();self.refuse(forged,'INVALID_TRANSITION')
        native=self.summary(actor,disc);native['args']['native_locator']='invented:native';self.refuse(native,'SOURCE_UNVERIFIED')
        invalid=self.summary(actor,disc);invalid['args']['recorded_item_refs']=[ref(self.fx.authority)];self.refuse(invalid,'MISSING_EVIDENCE')
        stale=self.summary(actor,disc);stale['expected'].pop(disc['uuid']);self.refuse(stale,'REVISION_CONFLICT')
        nested=self.request('transaction.apply',dict(operations=[dict(operation='session.entry',args={'actual_cwd':str(CHECKOUT)})]));self.refuse(nested,'INVALID_SCHEMA')
        body=copy.deepcopy(bind['args']['body']);body['granted_operations'].append('ungranted.operation');self.refuse(self.request('actor.bind',{**bind['args'],'body':body},ticket=False),'FORBIDDEN')
        body=copy.deepcopy(bind['args']['body']);body['actual_cwd']=str(self.fx.root);self.refuse(self.request('actor.bind',{**bind['args'],'body':body},ticket=False),'SOURCE_UNVERIFIED')
        generic=self.request('record.create',dict(kind='discussion',body=disc['body'],source_refs=[]));self.refuse(generic,'FORBIDDEN')
        # Unknown fields never expand the installed closed contract.
        req=self.entry();req['args']['create_binding']=True;self.refuse(req,'INVALID_SCHEMA')

    def test_nested_phase_order_same_commit_and_reply_fault_replay(self):
        a,_,_=self.bind();b,_,_=self.bind();da,_,_=self.register(a,0);db,_,_=self.register(b,1)
        # A manager cannot impersonate either actor. Two actual entries in one
        # commit use its own nonexclusive phases and the monotonically ordered journal.
        ma,_,_=self.register(self.fx.actor,0);mb,_,_=self.register(self.fx.actor,1)
        one=self.summary(self.fx.actor,ma,'First ordinal')['args'];two=self.summary(self.fx.actor,mb,'Second ordinal')['args']
        req=self.request('transaction.apply',dict(operations=[dict(operation='discussion.summary_record',args=one),dict(operation='discussion.summary_record',args=two)]))
        self.ok(self.call(req));self.refresh();entries=[x for x in self.items if x['kind']=='journal_entry'];self.assertEqual(entries[0]['body']['commit_seq'],entries[1]['body']['commit_seq']);self.assertLess(entries[0]['body']['event_ordinal'],entries[1]['body']['event_ordinal']);self.assertEqual(next(x for x in self.items if x['kind']=='ticket')['body']['current_workflow_node_uuid'],self.phases[1]['uuid'])
        trace=self.fx.root/'fault-trace.jsonl';self.ok(self.call(self.summary(a,da,'Trace boundary'),extra={'LP_TX_TRACE':str(trace)}));events=[json.loads(x) for x in trace.read_text().splitlines()];self.raw.append(dict(actual_fault_boundaries=events));boundary=next(x['index'] for x in events if x['stage']=='reply');request=self.summary(a,da,'Replay after reply failure');code,result=self.call(request,extra={'LP_TX_FAIL':str(boundary)});self.assertEqual(code,3);self.assertEqual(result['commit_state'],'committed_unknown');self.refresh();before=self.plan['root_revision_uuid'];reply=self.ok(self.call(request));self.refresh();self.assertEqual(self.plan['root_revision_uuid'],before);self.assertEqual(reply['captured_plan_revision_uuid'],before);self.assertEqual(len([x for x in self.items if x['kind']=='journal_entry' and x['body']['focus']=='Replay after reply failure']),1)

    def test_added_journal_writes_real_faults_preserve_selector_and_replay(self):
        actor,_,_=self.bind();disc,_,_=self.register(actor)
        trace=self.fx.root/'write-trace.jsonl';self.ok(self.call(self.summary(actor,disc,'Trace actual added writes'),extra={'LP_TX_TRACE':str(trace)}))
        boundaries=[json.loads(x) for x in trace.read_text().splitlines()];self.raw.append(dict(actual_fault_boundaries=boundaries))
        cases=[next(x for x in boundaries if x['stage']=='write_bytes' and x['path'].endswith('ticket.json')),next(x for x in boundaries if x['stage']=='selector'),next(x for x in boundaries if x['stage']=='readback')]
        for index,boundary in enumerate(cases):
            self.refresh();before=self.plan['root_revision_uuid'];request=self.summary(actor,disc,'Fault case '+str(index));code,value=self.call(request,extra={'LP_TX_FAIL':str(boundary['index'])});self.assertEqual(code,3,value);self.refresh()
            committed=boundary['stage']=='readback';self.assertEqual(value['commit_state'],'committed_unknown' if committed else 'nonmutation');self.assertEqual(self.plan['root_revision_uuid']==before,not committed)
            receipt=self.ok(self.call(request));self.refresh();after=self.plan['root_revision_uuid'];self.assertEqual(self.ok(self.call(request))['receipt_ref'],receipt['receipt_ref']);self.refresh();self.assertEqual(after,self.plan['root_revision_uuid']);self.assertEqual(len([x for x in self.items if x['kind']=='journal_entry' and x['body']['focus']=='Fault case '+str(index)]),1)

    def test_closed_peer_is_excluded_from_saved_projection_without_closing_live_records(self):
        from core.discussions import projection
        actor,_,_=self.bind();other,_,_=self.bind();a,_,_=self.register(actor,0);b,_,_=self.register(other,1)
        self.ok(self.call(self.summary(actor,a,'Older open direct entry')));self.ok(self.call(self.summary(other,b,'Newer direct entry')));self.refresh()
        # Deliberately synthetic retained CLOSED input; actual reviewed closure
        # publication is S2. This checks the same projection used by real views.
        selected=copy.deepcopy(self.items);closed=next(x for x in selected if x['uuid']==b['uuid']);closed['body'].update(state='closed',accepted_checkpoint_ref=ref(self.fx.authority))
        landscape=projection(selected,self.phases[0]['uuid']);self.assertEqual(landscape['current_phase_node_uuid'],self.phases[0]['uuid']);self.assertEqual(next(x for x in landscape['discussions'] if x['discussion_uuid']==a['uuid'])['checked'],False)
        self.raw.append(dict(projection_fixture='Synthetic CLOSED input only; actual close is S2',input=selected,output=landscape))
        self.refresh();self.assertTrue(all(x['body']['state']=='open' for x in self.items if x['kind']=='discussion'))

    def test_unavailable_registered_routes_preserve_exact_cwd_and_unknown(self):
        child=self.fx.home/next(x for x in self.items if x['kind']=='ticket')['body']['current_home']
        original=file_hash(self.folder/'plan.json');healthy=self.ok(self.call(self.entry(child),child));self.assertEqual(healthy['resolution'],'resolved')
        routing=self.fx.root/'plans.json';original_routes=routing.read_bytes();missing=dict(uuid=uid(),title='Registered plan unavailable',current_home='work-tickets/unavailable')
        try:
            routing.write_bytes(encode(json.loads(original_routes)+[missing]));self.raw.append(dict(routing_fixture='One valid unavailable registered header',header=missing))
            known=self.ok(self.call(self.entry(child),child));self.assertEqual(known['selected_scope'],healthy['selected_scope']);self.assertEqual(known['remaining'],1);self.assertTrue(known['gaps'])
            unknown=self.fx.root/'unknown';unknown.mkdir();result=self.ok(self.call(self.entry(unknown),unknown));self.assertEqual(result['resolution'],'missing');self.assertIsNone(result['selected_scope']);self.assertTrue(result['gaps'])
            # An unreadable plan could share a registered actor checkout. One
            # verified actor candidate is insufficient to invent uniqueness.
            uncertain=self.ok(self.call(self.entry()));self.assertEqual(uncertain['resolution'],'missing');self.assertIsNone(uncertain['actor_binding_ref']);self.assertTrue(any('share' in x for x in uncertain['gaps']))
            bound=self.entry();bound['actor_binding_ref']=ref(self.fx.actor);self.refuse(bound,'FORBIDDEN')
            selected=self.entry();selected['scope']={'plan_uuid':missing['uuid']};code,error=self.call(selected);self.assertEqual(code,3);self.assertEqual(error['code'],'UNSUPPORTED_STORE')
            # A second healthy plan is provisioned through the public route;
            # the unavailable header cannot prevent either physical CWD entry.
            other=Fixture(self.fx.root,'other');other.run=self.call;self.ok(other.create('Second real healthy plan'));self.ok(self.call(other.seed()))
            other_plan,tickets,other_folder=read_generation(other.home);other_root=next(x for x in current(other_plan) if x['kind']=='plan');self.assertEqual(other_root['writer'],other.writer);self.raw.append(dict(second_actual_plan_readback=other_plan,plan_sha256=file_hash(other_folder/'plan.json')));ticket=next(iter(tickets.values()));other_child=other.home/next(x for x in current(ticket) if x['kind']=='ticket')['body']['current_home']
            result=self.ok(self.call(self.entry(other_child),other_child));self.assertEqual(result['selected_scope']['ticket_uuid'],ticket['root_uuid']);self.assertTrue(result['gaps'])
            ambiguous=self.ok(self.call(self.entry()));self.assertEqual(ambiguous['resolution'],'ambiguous');self.assertEqual(len(ambiguous['candidate_bindings']),2);self.assertIsNone(ambiguous['selected_scope'])
            routes=json.loads(routing.read_bytes());routing.write_bytes(encode(routes+[routes[0]]));self.refuse(self.entry(child),'BINDING_AMBIGUOUS',child)
            routing.write_bytes(encode([{**missing,'current_home':'../unsafe'}]));code,error=self.call(self.entry(child),child);self.assertEqual(code,3);self.assertEqual(error['code'],'UNSUPPORTED_STORE')
            routing.write_bytes(encode(routes));linked=self.fx.root/missing['current_home'];linked.symlink_to(self.fx.home);self.refuse(self.entry(child),'FORBIDDEN',child);linked.unlink()
        finally:routing.write_bytes(original_routes)
        self.refresh();self.assertEqual(file_hash(self.folder/'plan.json'),original)

    def test_actual_front_child_plan_root_writer_and_noop_preservation(self):
        root=next(x for x in current(self.plan) if x['kind']=='plan');self.assertEqual(root['writer']['actor_uuid'],self.fx.actor['uuid']);initial_uuid,initial_created=root['uuid'],root['created_at']
        actor,_,_=self.bind();disc,_,_=self.register(actor)
        def assert_writer(result,actual):
            self.refresh();business=next(x for x in current(self.plan) if x['kind']=='plan');ticket=next(x for x in self.items if x['kind']=='ticket');receipt=next(x for x in current(self.plan) if x['revision_uuid']==result['receipt_ref']['revision_uuid'])
            self.assertEqual(business['writer'],receipt['writer']);self.assertEqual(business['writer'],ticket['writer']);self.assertEqual(business['writer']['actor_uuid'],actual['uuid']);self.assertEqual((business['uuid'],business['created_at']),(initial_uuid,initial_created));return copy.deepcopy(business)
        request=self.summary(actor,disc,'Distinct front revision');result=self.ok(self.call(request));front=assert_writer(result,actor)
        child,_,_=self.bind('inline-support','child',actor['uuid']);request=self.summary(child,disc,'Distinct inline child revision');result=self.ok(self.call(request));latest=assert_writer(result,child);self.assertEqual(latest['writer']['parent_actor_uuid'],actor['uuid']);self.assertNotEqual(latest['revision_uuid'],front['revision_uuid']);self.assertIn(front,self.plan['revisions'])
        # A new receipt for existing registration changes no business root.
        unchanged=copy.deepcopy(self.ticket);registration=self.request('discussion.register',dict(phase_node_uuid=self.phases[0]['uuid'],actor_uuid=actor['uuid']),actor);receipt=self.ok(self.call(registration));self.refresh();self.assertEqual(next(x for x in current(self.plan) if x['kind']=='plan'),latest);self.assertEqual(self.ticket,unchanged);self.assertEqual(receipt['changed_refs'],[])
        before=self.plan['root_revision_uuid'];self.assertEqual(self.ok(self.call(request))['receipt_ref'],result['receipt_ref']);self.refresh();self.assertEqual(self.plan['root_revision_uuid'],before)
        self.raw.append(dict(actual_plan_writer_history=dict(front=front,child=latest,unchanged_root_after_noop=next(x for x in current(self.plan) if x['kind']=='plan'))))

    def test_real_unrelated_generation_read_failures_are_gaps_not_global_entry_failures(self):
        child=self.fx.home/next(x for x in self.items if x['kind']=='ticket')['body']['current_home'];healthy=self.ok(self.call(self.entry(child),child))
        unknown=self.fx.root/'unknown';unknown.mkdir();other=Fixture(self.fx.root,'other');other.run=self.call
        self.ok(other.create('Actual unrelated generation read failure'));self.ok(self.call(other.seed()))
        plan,tickets,folder=read_generation(other.home);ticket=next(iter(tickets.values()));root=next(x for x in current(plan) if x['kind']=='plan')
        binding=root['body']['ticket_bindings'][0];other_child=other.home/binding['current_home']
        cases=[('missing generated view',folder/'plan.HTML',None),('missing canonical ticket payload',other.home/binding['relative_path'],None),
               ('corrupt stored plan shape',folder/'plan.json',encode({k:v for k,v in plan.items() if k!='schema_version'}))]
        for label,path,replacement in cases:
            original=path.read_bytes();self.raw.append(dict(unavailable_generation_fixture=label,path=str(path),original_bytes=original.decode(),original_sha256=file_hash(path),replacement_bytes=replacement.decode() if replacement else None))
            try:
                if replacement is None:path.unlink()
                else:path.write_bytes(replacement)
                known=self.ok(self.call(self.entry(child),child));self.assertEqual(known['selected_scope'],healthy['selected_scope']);self.assertEqual(known['remaining'],1);self.assertTrue(known['gaps'])
                absent=self.ok(self.call(self.entry(unknown),unknown));self.assertEqual(absent['resolution'],'missing');self.assertIsNone(absent['selected_scope']);self.assertTrue(absent['gaps'])
                uncertain=self.ok(self.call(self.entry()));self.assertEqual(uncertain['resolution'],'missing');self.assertTrue(any('share' in x for x in uncertain['gaps']))
                for cwd in (child,other_child):
                    request=self.entry(cwd);request['scope']={'plan_uuid':plan['root_uuid']};code,error=self.call(request,cwd);self.assertNotEqual(code,0);self.assertIsNone(error['continuation'])
                code,error=self.call(self.entry(other_child),other_child);self.assertNotEqual(code,0)
                exact=self.entry(child);exact['scope']={'plan_uuid':self.plan['root_uuid']};self.assertEqual(self.ok(self.call(exact,child))['selected_scope'],healthy['selected_scope'])
            finally:path.write_bytes(original)
            restored=self.ok(self.call(self.entry(other_child),other_child));self.assertEqual(restored['selected_scope']['ticket_uuid'],ticket['root_uuid']);self.assertFalse(restored['gaps'])
        # Generation confinement errors remain refusals even for unrelated
        # headers. The fixture changes no routing registry or live owner data.
        revisions=other.home/'.revisions';saved=other.home/'saved-revisions';revisions.rename(saved);revisions.symlink_to(saved)
        try:self.refuse(self.entry(child),'FORBIDDEN',child)
        finally:revisions.unlink();saved.rename(revisions)

    def test_original_WA002_public_shape_samples(self):
        samples=json.loads((CHECKOUT/'launchpad/assets/schema/conformance.samples.json').read_text())
        cases=[x for x in samples['shape_cases'] if x['name'].startswith('WA002')]
        self.assertTrue(cases)
        for case in cases:
            request=copy.deepcopy(case['value'])
            if case['schema']=='request.schema.json' and request.get('operation')=='session.entry':
                if 'actual_cwd' in request['args']:request['args']['actual_cwd']=str(CHECKOUT)
                if 'assignment_ref' in request['args']:
                    actor,assignment,_=self.bind();request['args']['assignment_ref']=ref(assignment)
                if 'scope' in request:request['scope']['plan_uuid']=self.plan['root_uuid']
                result=self.call(request)
                if case['expected_shape']=='valid':self.ok(result)
                else:self.assertNotEqual(result[0],0)
            else:
                if case['expected_shape']=='valid':named(request,case['schema'])
                elif case['schema']=='request.schema.json':
                    code,response=self.call(request);self.assertEqual(code,2);self.assertEqual(response['code'],'INVALID_SCHEMA')
                else:
                    from core.schema import ContractError
                    with self.assertRaises(ContractError):named(request,case['schema'])
