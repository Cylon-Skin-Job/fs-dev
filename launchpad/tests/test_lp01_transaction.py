"""A02 public subprocess transaction, authority and physical readback checks."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from support import Fixture, CHECKOUT, CLI, ref, uid, envelope, encode, current, read_generation, file_hash
from core.store import digest, load

GRANTS=['record.update','record.create','issue.create','acceptance.record','transaction.apply','recovery.plan','recovery.apply']


class TransactionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.fx=Fixture(self.tmp.name)
        self.fx.actor['body']['granted_operations']+=GRANTS;self.fx.save(self.fx.actor)
        self.ok(self.fx.create())
        self.ok(self.fx.run(self.fx.seed()))
        self.refresh()

    def tearDown(self):self.tmp.cleanup()
    def ok(self,result):
        code,value=result;self.assertEqual(code,0,value);return value
    def refresh(self):
        self.plan,self.tickets,self.folder=read_generation(self.fx.home)
        self.ticket=next(iter(self.tickets.values()));self.items=current(self.ticket)
        self.capture=next((x for x in self.items if x['uuid']==getattr(self,'capture_uuid',None)),None) or next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Initial Capture')
        self.capture_uuid=self.capture['uuid']

    def request(self,op,args,key=None):
        tool='db.transaction' if op=='transaction.apply' else 'db.validate' if op=='recovery.inspect' else 'db.context' if op=='recovery.plan' else 'db.mutate'
        expected={x['uuid']:x['revision_uuid'] for x in current(self.plan)+self.items}
        value=self.fx.request('record.get',{})
        value.update(tool=tool,operation=op,args=args,scope={'plan_uuid':self.fx.plan_id,'ticket_uuid':self.ticket['root_uuid'],'include_history':False})
        if tool in ('db.mutate','db.transaction'):value.update(idempotency_key=key or uid(),expected=expected,expected_plan_revision_uuid=self.plan['root_revision_uuid'])
        return value

    def update(self,item=None,text='Revision-checked update'):
        item=item or self.capture;body=copy.deepcopy(item['body']);body['content']=text
        return self.request('record.update',dict(uuid=item['uuid'],body=body,source_refs=item['source_refs']))

    def test_real_competing_processes_conflict_and_inspected_nonoverlap(self):
        a=self.update(text='first');b=self.update(text='second');old=self.plan['root_revision_uuid']
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(self.fx.run,[a,b]))
        self.assertEqual(sorted(code for code,_ in results),[0,2]);conflict=next(r for c,r in results if c)
        self.assertEqual(conflict['code'],'REVISION_CONFLICT');self.assertTrue(conflict['actual_revisions']);self.assertTrue(conflict['changed_fields'])
        self.refresh();self.assertNotEqual(self.plan['root_revision_uuid'],old)
        # A deliberately refreshed request for another object is accepted; no blind stale-plan patch.
        other=next(x for x in self.items if x['kind']=='content' and x['body']['title']=='ToDo')
        fresh=self.update(other,'inspected nonoverlap');self.ok(self.fx.run(fresh))
        fresh['idempotency_key']=uid();fresh['expected'].pop(other['uuid']);code,value=self.fx.run(fresh)
        self.assertEqual(value['code'],'REVISION_CONFLICT')

    def test_original_receipt_replay_mismatch_and_noop_history(self):
        request=self.update();first=self.ok(self.fx.run(request));self.refresh();self.ok(self.fx.run(self.update(text='later')))
        before=(self.fx.home/'CURRENT').readlink();self.assertEqual(self.ok(self.fx.run(request)),first);self.assertEqual((self.fx.home/'CURRENT').readlink(),before)
        bad=copy.deepcopy(request);bad['args']['body']['content']='key reuse';self.assertEqual(self.fx.run(bad)[1]['code'],'IDEMPOTENCY_MISMATCH')
        self.refresh();old=self.ticket;oldroot=current(self.plan);same=self.update(text=self.capture['body']['content'])
        result=self.ok(self.fx.run(same));self.assertEqual(result['changed_refs'],[]);self.refresh();self.assertEqual(old,self.ticket)
        prior={x['uuid']:x for x in oldroot if x['kind']!='receipt'}
        self.assertTrue(all(x==prior[x['uuid']] for x in current(self.plan) if x['kind']!='receipt'))
        pinned=self.fx.request('record.get',dict(uuid=self.capture['uuid'],revision_uuid=request['expected'][self.capture['uuid']],fields=['body']))
        pinned['scope']['ticket_uuid']=self.ticket['root_uuid'];self.ok(self.fx.run(pinned))

    def batch_evidence(self):
        subject=self.capture;gate_writer={**self.fx.writer,'actor_uuid':uid()}
        report=self.fx.save(envelope('content',dict(title='Independent raw review',category_uuid=uid(),format='plain',content='Exact disposable A02 subject inspection',authority='active_code_constraint',state='active',item_uuids=[]),gate_writer))
        gate=self.fx.save(envelope('review',dict(assignment_uuid=uid(),attempt_uuid=uid(),subject_refs=[ref(subject)],subject_digest=digest([ref(subject)]),mode='A02 atomic fixture',reviewer_actor_uuid=gate_writer['actor_uuid'],evidence_refs=[ref(report)],verdict='pass',finding_refs=[],report_ref=ref(report)),gate_writer))
        cat=next(x for x in self.items if x['kind']=='category' and x['body']['title']=='Issues')
        issue=dict(body=dict(title='Scoped issue',category_uuid=cat['uuid'],format='plain',content='Retain follow-up obligation',authority='proposal',state='pending',item_uuids=[]),source_refs=[],item_uuids=[])
        edge=dict(kind='edge',body=dict(edge_kind='references',from_uuid=subject['uuid'],to_uuid=cat['uuid'],from_revision_uuid=subject['revision_uuid'],to_revision_uuid=cat['revision_uuid'],scope_item_uuids=[],authority_ref=ref(self.fx.authority)),source_refs=[])
        acceptance=dict(subject_refs=[ref(subject)],subject_digest=digest([ref(subject)]),gate_refs=[ref(gate)],authority_ref=ref(self.fx.authority),original_instruction_ref=ref(self.fx.authority))
        request=self.request('transaction.apply',dict(operations=[dict(operation='acceptance.record',args=acceptance),dict(operation='issue.create',args=issue),dict(operation='record.create',args=edge)],expected={}))
        for item in [self.fx.authority,gate,report]:request['expected'][item['uuid']]=item['revision_uuid']
        request['args']['expected']=copy.deepcopy(request['expected']);return request

    def test_authorized_acceptance_issue_edge_one_commit(self):
        request=self.batch_evidence();old=self.plan['commit_seq'];result=self.ok(self.fx.run(request));self.refresh()
        self.assertEqual(self.plan['commit_seq'],old+1);self.assertEqual(sum(x['kind']=='acceptance' for x in self.items),1)
        self.assertEqual(sum(x['kind']=='edge' for x in self.items),1);self.assertTrue(any(x['kind']=='content' and x['body']['title']=='Scoped issue' for x in self.items))
        self.assertEqual(self.ok(self.fx.run(request)),result)
        # Changed subject invalidates the acceptance only with an exact affected acceptance expectation.
        self.ok(self.fx.run(self.update()));self.refresh();self.assertEqual(next(x for x in self.items if x['kind']=='acceptance')['body']['state'],'invalidated')

    def test_atomic_batch_refusals_and_closed_shapes(self):
        request=self.batch_evidence();original=file_hash(self.folder/'plan.json')
        variants=[]
        for field in ['gate_refs','subject_refs']:
            bad=copy.deepcopy(request);bad['args']['operations'][0]['args'][field]=[];variants.append(bad)
        bad=copy.deepcopy(request);bad['args']['operations'][2]['args']['body']['to_revision_uuid']=uid();variants.append(bad)
        bad=copy.deepcopy(request);bad['args']['operations'][2]['args']['body']['plan_uuid']=uid();variants.append(bad)
        bad=copy.deepcopy(request);bad['args']['operations'][0]['args']['gate_refs'][0]['sha256']='0'*64;variants.append(bad)
        bad=copy.deepcopy(request);bad['expected'].pop(self.capture['uuid']);bad['args']['expected']=bad['expected'];variants.append(bad)
        for bad in variants:
            self.assertNotEqual(self.fx.run(bad)[0],0);self.assertEqual(file_hash(self.folder/'plan.json'),original)
        forge=self.request('record.create',dict(kind='acceptance',body=request['args']['operations'][0]['args'],source_refs=[]));self.assertNotEqual(self.fx.run(forge)[0],0)
        forge=self.update();forge['args']['body']['authority']='owner_decision';self.assertEqual(self.fx.run(forge)[1]['code'],'FORBIDDEN')
        # No subrequest can smuggle cross-plan scope or an invented edge.create operation.
        for extra in [dict(operation='edge.create',args={}),dict(operation='issue.create',args={},scope={'plan_uuid':uid()})]:
            bad=copy.deepcopy(request);bad['args']['operations'].append(extra);self.assertEqual(self.fx.run(bad)[1]['code'],'INVALID_SCHEMA')

    def test_prospective_duplicate_homes_no_staging(self):
        seed=self.fx.seed(title='Prospective member');request=self.request('transaction.apply',dict(operations=[dict(operation='ticket.create',args=seed['args'])]*2,expected={}))
        request['args']['expected']=request['expected'];old=set(self.fx.home.rglob('*'))
        self.assertEqual(self.fx.run(request)[1]['code'],'REVISION_CONFLICT');self.assertEqual(set(self.fx.home.rglob('*')),old)
        # Earlier valid edit is not written when a later suboperation is unsupported/grantless.
        request=self.request('transaction.apply',dict(operations=[dict(operation='record.update',args=self.update()['args']),dict(operation='run.start_record',args={})],expected={}))
        request['args']['expected']=request['expected'];self.assertNotEqual(self.fx.run(request)[0],0);self.assertEqual(set(self.fx.home.rglob('*')),old)

    def test_physical_owner_hashes_and_corruption_refusal(self):
        self.ok(self.fx.run(self.update()));self.refresh();root=next(x for x in current(self.plan) if x['kind']=='plan')
        binding=root['body']['ticket_bindings'][0];payload=self.fx.home/binding['relative_path']
        self.assertEqual(payload.parent.parent.parent.name,binding['current_home']);self.assertFalse(payload.is_symlink());self.assertEqual(file_hash(payload),binding['sha256'])
        self.assertEqual(load(payload.parent.parent.parent/'ticket.json'),self.ticket)
        payload.write_bytes(b'{}');self.assertEqual(self.fx.run(self.update())[1]['code'],'UNSUPPORTED_STORE')

    def test_unsupported_flock_symlink_fsync_actual_public_process(self):
        # Fault adapters replace only the unavailable OS capability, never the public command/readback route.
        for owner,name in [('fcntl','flock'),('os','symlink'),('os','fsync')]:
            inject=Path(self.tmp.name)/('inject-'+name);inject.mkdir()
            (inject/'sitecustomize.py').write_text(f'import {owner}\ndef unavailable(*args,**kwargs): raise OSError("unsupported {name}")\n{owner}.{name}=unavailable\n')
            req=self.update();path=Path(self.tmp.name)/'capability-request.json';path.write_bytes(encode(req));before=(self.fx.home/'CURRENT').readlink()
            env={**os.environ,'PYTHONPATH':str(inject)}
            result=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)],cwd=CHECKOUT,env=env,capture_output=True,text=True)
            self.assertEqual(json.loads(result.stdout)['code'],'UNSUPPORTED_STORE');self.assertEqual((self.fx.home/'CURRENT').readlink(),before)


    def test_each_suboperation_grant_and_dependency_required(self):
        self.fx=Fixture(Path(self.tmp.name)/'no-issue-grant')
        self.fx.actor['body']['granted_operations'] += [x for x in GRANTS if x!='issue.create'];self.fx.save(self.fx.actor)
        self.ok(self.fx.create());self.ok(self.fx.run(self.fx.seed()));self.refresh()
        issue=dict(body={**copy.deepcopy(self.capture['body']),'authority':'proposal','state':'pending'},source_refs=[],item_uuids=self.capture['body']['item_uuids'])
        request=self.request('transaction.apply',dict(operations=[dict(operation='record.update',args=self.update()['args']),dict(operation='issue.create',args=issue)],expected={}))
        request['args']['expected']=request['expected'];old=self.plan['root_revision_uuid']
        self.assertEqual(self.fx.run(request)[1]['code'],'FORBIDDEN');self.assertEqual(read_generation(self.fx.home)[0]['root_revision_uuid'],old)
        request=self.update();request['expected'].pop(self.capture['body']['category_uuid'])
        self.assertEqual(self.fx.run(request)[1]['code'],'REVISION_CONFLICT')
        request=self.update();request['args']['source_refs'].append({**self.capture['source_refs'][0],'locator':'/unassigned/missing-source','sha256':'0'*64})
        self.assertEqual(self.fx.run(request)[1]['code'],'SOURCE_UNVERIFIED')

    def test_malformed_prepared_registry_and_confined_view_refusal(self):
        prepared=self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json');raw=prepared.read_bytes()
        bad=json.loads(raw);bad['view_hashes']=[];prepared.write_bytes(encode(bad))
        self.assertEqual(self.fx.run(self.update())[1]['code'],'UNSUPPORTED_STORE');prepared.write_bytes(raw)
        registry=self.fx.root/'plans.json';raw=registry.read_bytes();bad=json.loads(raw);bad[0]['uuid']=uid();registry.write_bytes(encode(bad))
        req=self.update();req['scope']['plan_uuid']=bad[0]['uuid'];self.assertEqual(self.fx.run(req)[1]['code'],'UNSUPPORTED_STORE');registry.write_bytes(raw)
        view=self.folder/'plan.HTML';bytes_before=view.read_bytes();external=self.fx.root/'foreign-view';external.write_bytes(bytes_before);view.unlink();view.symlink_to(external)
        self.assertEqual(self.fx.run(self.update())[1]['code'],'FORBIDDEN')

    def test_complete_prepared_view_inventory_and_page_required(self):
        prepared=self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json');raw=prepared.read_bytes()
        old=(self.fx.home/'CURRENT').readlink();proof=json.loads(raw);variants=[]
        for views in [{}, {'plan.HTML':proof['view_hashes']['plan.HTML']}, {**proof['view_hashes'],'tickets/'+uid()+'.html':'0'*64}]:
            variants.append({**proof,'view_hashes':views})
        for key,value in [('old_generation',[]),('new_generation','x'*36),('request_sha256',None),('plan_sha256',[])]:
            variants.append({**proof,key:value})
        for bad in variants:
            prepared.write_bytes(encode(bad));self.assertEqual(self.fx.run(self.update())[1]['code'],'UNSUPPORTED_STORE')
            self.assertEqual((self.fx.home/'CURRENT').readlink(),old)
        prepared.write_bytes(raw)
        for name in proof['view_hashes']:
            page=self.folder/name;payload=page.read_bytes();page.unlink()
            self.assertEqual(self.fx.run(self.update())[1]['code'],'UNSUPPORTED_STORE');self.assertEqual((self.fx.home/'CURRENT').readlink(),old)
            page.write_bytes(payload)

    def test_generation_payload_alias_must_match_canonical_binding(self):
        binding=next(x for x in current(self.plan) if x['kind']=='plan')['body']['ticket_bindings'][0]
        self.ok(self.fx.run(self.update()));self.refresh();old=(self.fx.home/'CURRENT').readlink()
        alias=self.folder/'tickets'/(self.ticket['root_uuid']+'.json');target=os.readlink(alias)
        alias.unlink();alias.symlink_to(os.path.relpath(self.fx.home/binding['relative_path'],alias.parent))
        self.assertEqual(self.fx.run(self.update())[1]['code'],'UNSUPPORTED_STORE');self.assertEqual((self.fx.home/'CURRENT').readlink(),old)
        alias.unlink();self.assertEqual(self.fx.run(self.update())[1]['code'],'UNSUPPORTED_STORE')
        alias.symlink_to(target);foreign=self.folder/'tickets'/(uid()+'.json');foreign.symlink_to(target)
        self.assertEqual(self.fx.run(self.update())[1]['code'],'UNSUPPORTED_STORE');self.assertEqual((self.fx.home/'CURRENT').readlink(),old)

    def test_seed_roles_survive_renames_and_preserve_unrelated_titles(self):
        category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
        args=dict(kind='content',body=dict(title='Scope',category_uuid=category['uuid'],format='plain',content='Unrelated proposal',authority='proposal',state='pending',item_uuids=[]),source_refs=[])
        self.ok(self.fx.run(self.request('record.create',args)));self.refresh()
        unrelated=next(x for x in self.items if x['kind']=='content' and x['body']['content']=='Unrelated proposal')
        capture_category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='capture')
        for item,title in [(capture_category,'My Capture'),(self.capture,'Owner capture'),(next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Scope' and x['uuid']!=unrelated['uuid']),'Owner scope')]:
            self.ok(self.fx.run(self.request('record.update',dict(uuid=item['uuid'],body={**item['body'],'title':title},source_refs=item['source_refs']))));self.refresh()
        before={x['uuid']:x for x in self.items};seed=self.fx.seed(content='Changed source')
        args={key:seed['args'][key] for key in ('seed_ref','scope_items','checklist_items')}
        self.ok(self.fx.run(self.request('ticket.seed_apply',args)));self.refresh()
        after={x['uuid']:x for x in self.items};self.assertEqual(set(after),set(before));self.assertEqual(after[unrelated['uuid']],unrelated)
        for entry in before:
            if before[entry]['body'].get('title') in ('My Capture','Owner capture','Owner scope'):
                self.assertEqual(after[entry]['body']['title'],before[entry]['body']['title'])

    def test_category_parent_exact_expectation_direct_and_batch(self):
        child=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
        parent=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='references')
        args=dict(uuid=child['uuid'],body={**child['body'],'parent_uuid':parent['uuid']},source_refs=child['source_refs'])
        old=(self.fx.home/'CURRENT').readlink();paths=set(self.fx.home.rglob('*'))
        for op in ('record.update','transaction.apply'):
            request=self.request(op,args if op=='record.update' else dict(operations=[dict(operation='record.update',args=args)],expected={}))
            request['expected'].pop(parent['uuid'])
            if op=='transaction.apply':request['args']['expected']=request['expected']
            self.assertEqual(self.fx.run(request)[1]['code'],'REVISION_CONFLICT');self.assertEqual((self.fx.home/'CURRENT').readlink(),old);self.assertEqual(set(self.fx.home.rglob('*')),paths)
        self.ok(self.fx.run(self.request('record.update',args)))

    def test_prepared_lineage_must_match_unique_generation_receipt(self):
        path=self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json');raw=path.read_bytes();proof=json.loads(raw);old=(self.fx.home/'CURRENT').readlink()
        for key,value in [('request_sha256','0'*64),('old_generation',uid())]:
            path.write_bytes(encode({**proof,key:value}));self.assertEqual(self.fx.run(self.update())[1]['code'],'UNSUPPORTED_STORE');self.assertEqual((self.fx.home/'CURRENT').readlink(),old)
        path.write_bytes(raw);self.ok(self.fx.run(self.update()))

    def test_seed_retains_extensions_accumulated_pins_and_noop_business(self):
        scope=next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Scope')
        args=dict(uuid=scope['uuid'],body=scope['body'],source_refs=scope['source_refs'],extensions={'source.preserved':{'label':'Retained extension'}})
        self.ok(self.fx.run(self.request('record.update',args)));self.refresh()
        pin={**self.capture['source_refs'][0],'revision':'accumulated/current'}
        args=dict(uuid=self.capture['uuid'],body=self.capture['body'],source_refs=self.capture['source_refs']+[pin])
        self.ok(self.fx.run(self.request('record.update',args)));self.refresh()
        before=copy.deepcopy(self.ticket)
        args=dict(seed_ref=next(x for x in self.items if x['kind']=='ticket')['body']['seed_ref'],scope_items=[],checklist_items=[])
        for item in self.items:
            if item['kind']=='source_item':args['scope_items' if item['body']['source_alias'].startswith('scope-') else 'checklist_items'].append(item['body'])
        result=self.ok(self.fx.run(self.request('ticket.seed_apply',args)));self.refresh()
        self.assertEqual(before,self.ticket);self.assertEqual(result['changed_refs'],[])
        seed=self.fx.seed(content='Changed canonical seed');args={key:seed['args'][key] for key in ('seed_ref','scope_items','checklist_items')}
        self.ok(self.fx.run(self.request('ticket.seed_apply',args)));self.refresh()
        self.assertEqual(next(x for x in self.items if x['uuid']==scope['uuid'])['extensions'],{'source.preserved':{'label':'Retained extension'}})
        self.assertIn(pin,self.capture['source_refs'])

    def test_fresh_noop_direct_and_batch_requires_category_and_items(self):
        args=dict(uuid=self.capture['uuid'],body=self.capture['body'],source_refs=self.capture['source_refs'])
        old=(self.fx.home/'CURRENT').readlink();paths=set(self.fx.home.rglob('*'))
        for dependency in [self.capture['body']['category_uuid']]+self.capture['body']['item_uuids']:
            for op in ('record.update','transaction.apply'):
                request=self.request(op,args if op=='record.update' else dict(operations=[dict(operation='record.update',args=args)],expected={}))
                request['expected'].pop(dependency)
                if op=='transaction.apply':request['args']['expected']=request['expected']
                self.assertEqual(self.fx.run(request)[1]['code'],'REVISION_CONFLICT');self.assertEqual((self.fx.home/'CURRENT').readlink(),old);self.assertEqual(set(self.fx.home.rglob('*')),paths)
        self.assertEqual(self.ok(self.fx.run(self.request('record.update',args)))['changed_refs'],[])

    def seed_args(self):
        args=dict(seed_ref=next(x for x in self.items if x['kind']=='ticket')['body']['seed_ref'],scope_items=[],checklist_items=[])
        for item in self.items:
            if item['kind']=='source_item':args['scope_items' if item['body']['source_alias'].startswith('scope-') else 'checklist_items'].append(copy.deepcopy(item['body']))
        return args

    def seed_request(self,args,batch=False):
        request=self.request('ticket.seed_apply',args)
        if batch:request.update(operation='transaction.apply',tool='db.transaction',args=dict(operations=[dict(operation='ticket.seed_apply',args=args)],expected=copy.deepcopy(request['expected'])))
        return request

    def test_seed_changed_and_fresh_noop_require_exact_touched_dependencies(self):
        same=self.seed_args();seed=self.fx.seed(content='Changed seed source')
        changed={key:seed['args'][key] for key in ('seed_ref','scope_items','checklist_items')}
        dependencies={self.ticket['root_uuid'],self.capture['uuid']}|set(self.capture['body']['item_uuids'])
        for item in self.items:
            if item['kind']=='content' and item['body']['authority']=='source_of_truth_contract':
                dependencies.add(item['uuid']);dependencies.add(item['body']['category_uuid'])
        old=(self.fx.home/'CURRENT').readlink();paths=set(self.fx.home.rglob('*'))
        for args in (same,changed):
            for batch in (False,True):
                for dependency in dependencies:
                    for stale in (False,True):
                        request=self.seed_request(args,batch)
                        if stale:request['expected'][dependency]=uid()
                        else:request['expected'].pop(dependency)
                        if batch:request['args']['expected']=copy.deepcopy(request['expected'])
                        self.assertEqual(self.fx.run(request)[1]['code'],'REVISION_CONFLICT')
                        self.assertEqual((self.fx.home/'CURRENT').readlink(),old);self.assertEqual(set(self.fx.home.rglob('*')),paths)
        request=self.seed_request(same);result=self.ok(self.fx.run(request));self.assertEqual(result['changed_refs'],[])
        self.refresh();self.ok(self.fx.run(self.seed_request(changed)));self.assertEqual(self.ok(self.fx.run(request)),result)

    def test_seed_acceptance_changed_noop_history_and_exact_expectation(self):
        for batch in (False,True):
            with self.subTest(batch=batch):
                self.fx=Fixture(Path(self.tmp.name)/('accepted-'+str(batch)))
                self.fx.actor['body']['granted_operations']+=GRANTS;self.fx.save(self.fx.actor)
                self.ok(self.fx.create());self.ok(self.fx.run(self.fx.seed()));self.capture_uuid=None;self.refresh()
                self.ok(self.fx.run(self.batch_evidence()));self.refresh()
                accepted=copy.deepcopy(next(x for x in self.items if x['kind']=='acceptance'));subject=copy.deepcopy(self.capture)
                before=copy.deepcopy(self.ticket);same=self.seed_request(self.seed_args(),batch)
                original=self.ok(self.fx.run(same));self.refresh()
                self.assertEqual(before,self.ticket);self.assertEqual(original['changed_refs'],[])
                # A different seeded subject changes without invalidating this Capture acceptance.
                args=self.seed_args();args['scope_items'][0]['text']='Changed only scope'
                self.ok(self.fx.run(self.seed_request(args,batch)));self.refresh()
                self.assertEqual(next(x for x in self.items if x['kind']=='acceptance'),accepted)
                seed=self.fx.seed(content='Changed accepted Capture')
                args={key:seed['args'][key] for key in ('seed_ref','scope_items','checklist_items')}
                old=(self.fx.home/'CURRENT').readlink();paths=set(self.fx.home.rglob('*'));seq=self.plan['commit_seq']
                for stale in (False,True):
                    request=self.seed_request(args,batch)
                    if stale:request['expected'][accepted['uuid']]=uid()
                    else:request['expected'].pop(accepted['uuid'])
                    if batch:request['args']['expected']=copy.deepcopy(request['expected'])
                    self.assertEqual(self.fx.run(request)[1]['code'],'REVISION_CONFLICT')
                    self.assertEqual((self.fx.home/'CURRENT').readlink(),old);self.assertEqual(set(self.fx.home.rglob('*')),paths)
                request=self.seed_request(args,batch);result=self.ok(self.fx.run(request));self.refresh()
                invalidated=next(x for x in self.items if x['kind']=='acceptance')
                self.assertEqual(self.plan['commit_seq'],seq+1);self.assertEqual(invalidated['uuid'],accepted['uuid'])
                self.assertNotEqual(invalidated['revision_uuid'],accepted['revision_uuid']);self.assertEqual(invalidated['body']['state'],'invalidated')
                for key in ('subject_refs','gate_refs','subject_digest','authority_ref','original_instruction_ref'):
                    self.assertEqual(invalidated['body'][key],accepted['body'][key])
                for prior in (accepted,subject):
                    self.assertIn(prior,self.ticket['revisions'])
                    read=self.fx.request('record.get',dict(uuid=prior['uuid'],revision_uuid=prior['revision_uuid'],fields=list(prior)))
                    read['scope']['ticket_uuid']=self.ticket['root_uuid'];self.assertEqual(self.ok(self.fx.run(read))['rows'][0]['fields'],prior)
                self.assertEqual(self.ok(self.fx.run(request)),result);self.assertEqual(self.ok(self.fx.run(same)),original)

    def test_first_seed_item_requires_existing_destination_category(self):
        self.fx=Fixture(Path(self.tmp.name)/'empty-seed-items')
        self.fx.actor['body']['granted_operations']+=GRANTS;self.fx.save(self.fx.actor)
        self.ok(self.fx.create());create=self.fx.seed();create['args']['scope_items']=[];create['args']['checklist_items']=[]
        self.ok(self.fx.run(create));self.capture_uuid=None;self.refresh()
        old=(self.fx.home/'CURRENT').readlink();paths=set(self.fx.home.rglob('*'))
        for key,category_key in [('scope_items','capture'),('checklist_items','checklist')]:
            category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']==category_key)
            args=self.seed_args();args[key]=[dict(source=args['seed_ref'],text='First source item',source_alias='first-'+key)]
            for batch in (False,True):
                for stale in (False,True):
                    request=self.seed_request(args,batch)
                    if stale:request['expected'][category['uuid']]=uid()
                    else:request['expected'].pop(category['uuid'])
                    if batch:request['args']['expected']=copy.deepcopy(request['expected'])
                    self.assertEqual(self.fx.run(request)[1]['code'],'REVISION_CONFLICT')
                    self.assertEqual((self.fx.home/'CURRENT').readlink(),old);self.assertEqual(set(self.fx.home.rglob('*')),paths)
        self.ok(self.fx.run(self.seed_request(args,True)))

    def test_related_edge_and_updated_endpoint_share_original_expectations(self):
        for modified in (False,True):
            for reverse in (False,True):
                with self.subTest(modified=modified,reverse=reverse):
                    self.fx=Fixture(Path(self.tmp.name)/('edge-'+str(modified)+'-'+str(reverse)))
                    self.fx.actor['body']['granted_operations']+=GRANTS;self.fx.save(self.fx.actor)
                    self.ok(self.fx.create());self.ok(self.fx.run(self.fx.seed()));self.capture_uuid=None;self.refresh()
                    issues=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
                    references=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='references')
                    edge=dict(kind='edge',body=dict(edge_kind='references',from_uuid=self.capture['uuid'],to_uuid=issues['uuid'],from_revision_uuid=None,to_revision_uuid=None,scope_item_uuids=[],authority_ref=ref(self.fx.authority)),source_refs=[])
                    if modified:
                        create=self.request('record.create',edge);create['expected'][self.fx.authority['uuid']]=self.fx.authority['revision_uuid']
                        self.ok(self.fx.run(create));self.refresh();prior=next(x for x in self.items if x['kind']=='edge')
                        edge_op=dict(operation='record.update',args=dict(uuid=prior['uuid'],body={**prior['body'],'to_uuid':references['uuid']},source_refs=prior['source_refs']))
                        endpoint=references
                    else:edge_op=dict(operation='record.create',args=edge);endpoint=issues
                    operations=[dict(operation='record.update',args=self.update()['args']),edge_op]
                    if reverse:operations.reverse()
                    request=self.request('transaction.apply',dict(operations=operations,expected={}))
                    request['expected'][self.fx.authority['uuid']]=self.fx.authority['revision_uuid'];request['args']['expected']=copy.deepcopy(request['expected'])
                    selector=(self.fx.home/'CURRENT').readlink();paths=set(self.fx.home.rglob('*'));seq=self.plan['commit_seq'];original=copy.deepcopy(self.capture)
                    for dependency in (self.capture['uuid'],endpoint['uuid']):
                        for stale in (False,True):
                            bad=copy.deepcopy(request)
                            if stale:bad['expected'][dependency]=uid()
                            else:bad['expected'].pop(dependency)
                            bad['args']['expected']=copy.deepcopy(bad['expected'])
                            self.assertEqual(self.fx.run(bad)[1]['code'],'REVISION_CONFLICT')
                            self.assertEqual((self.fx.home/'CURRENT').readlink(),selector);self.assertEqual(set(self.fx.home.rglob('*')),paths)
                    # A newly saved explicit endpoint pin must still match the final prospective endpoint.
                    pinned=copy.deepcopy(request);edge_args=next(x['args'] for x in pinned['args']['operations'] if x['args']['body'].get('edge_kind')=='references')
                    edge_args['body']['from_revision_uuid']=original['revision_uuid']
                    self.assertEqual(self.fx.run(pinned)[1]['code'],'REVISION_CONFLICT');self.assertEqual((self.fx.home/'CURRENT').readlink(),selector);self.assertEqual(set(self.fx.home.rglob('*')),paths)
                    result=self.ok(self.fx.run(request));self.refresh()
                    self.assertEqual(self.plan['commit_seq'],seq+1);self.assertNotEqual(self.capture['revision_uuid'],original['revision_uuid']);self.assertIn(original,self.ticket['revisions'])
                    related=next(x for x in self.items if x['kind']=='edge');self.assertEqual(related['body']['from_uuid'],self.capture['uuid']);self.assertEqual(related['body']['to_uuid'],endpoint['uuid'])
                    if modified:self.assertEqual(related['uuid'],prior['uuid']);self.assertIn(prior,self.ticket['revisions'])
                    self.assertEqual(self.ok(self.fx.run(request)),result)
