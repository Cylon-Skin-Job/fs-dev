"""A04 public subprocess, immutable filesystem, lifecycle and bounded-read proof."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import shutil
import unittest
from pathlib import Path
from support import Fixture,CHECKOUT,CLI,current,read_generation,uid,ref,envelope,file_hash,encode
from core.store import digest
from core.commands import INSTALLED,REGISTRY

GRANTS=list(INSTALLED-{'plan.create','ticket.create','ticket.seed_apply','seed.edit_preview'})


class RecordsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.fx=Fixture(self.tmp.name)
        self.fx.actor['body']['granted_operations']+=GRANTS;self.fx.save(self.fx.actor)
        self.raw=[];run=self.fx.run
        def audited(request):
            result=run(request);self.raw.append(dict(request=copy.deepcopy(request),exit=result[0],response=copy.deepcopy(result[1])));return result
        self.fx.run=audited
        self.ok(self.fx.create('A04 small disposable fixture'));self.ok(self.fx.run(self.fx.seed()));self.refresh()
    def tearDown(self):
        report=os.environ.get('LP_A04_REPORT')
        if report:
            path=Path(report);all_cases=json.loads(path.read_text()) if path.exists() else []
            self.refresh();readback=dict(plan=self.plan,tickets=self.ts,plan_sha256=file_hash(self.folder/'plan.json'),prepared=json.loads((self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json')).read_text()))
            all_cases.append(dict(test=self.id(),requests=self.raw,final_readback=readback));path.write_bytes(encode(all_cases))
        self.tmp.cleanup()
    def ok(self,result):
        code,value=result;self.assertEqual(code,0,value);return value
    def refresh(self):
        self.plan,self.ts,self.folder=read_generation(self.fx.home);self.ticket=next(iter(self.ts.values()));self.items=current(self.ticket)
        self.capture=next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Initial Capture')
    def request(self,op,args,key=None):
        value=self.fx.request('record.get',{})
        value.update(tool=REGISTRY[op]['tool'],operation=op,args=args,scope=dict(plan_uuid=self.fx.plan_id,ticket_uuid=self.ticket['root_uuid'],include_history=False))
        if value['tool'] in ('db.mutate','db.transaction'):
            expected={x['uuid']:x['revision_uuid'] for x in current(self.plan)+self.items+[self.fx.authority]}
            value.update(idempotency_key=key or uid(),expected=expected,expected_plan_revision_uuid=self.plan['root_revision_uuid'])
            if op=='transaction.apply':value['args']['expected']=copy.deepcopy(expected)
        return value
    def create(self,title='Disposable draft',extensions=None):
        args=dict(kind='content',body=dict(title=title,category_uuid=self.capture['body']['category_uuid'],format='json',content={'nested':['retained',{'deep':True}]},authority='proposal',state='pending',item_uuids=[]),source_refs=[],extensions=extensions or {'source.preserved':{'nested':{'keep':[1,2]}}})
        self.ok(self.fx.run(self.request('record.create',args)));self.refresh();return next(x for x in self.items if x['body'].get('title')==title)
    def lifecycle(self,op,item):return self.request(op,dict(uuid=item['uuid'],reason='Exact owner-controlled fixture',source_refs=item['source_refs'],authority_ref=ref(self.fx.authority)))
    def inspect(self,item,pinned=False):
        args=dict(uuid=item['uuid'],fields=list(item))
        if pinned:args['revision_uuid']=item['revision_uuid']
        return self.ok(self.fx.run(self.request('record.get',args)))['rows'][0]['fields']
    def reject(self,request,code=None):
        before=(self.fx.home/'CURRENT').readlink();value=self.fx.run(request)[1]
        self.assertEqual(value['commit_state'],'nonmutation',value)
        if code:self.assertEqual(value['code'],code,value)
        self.assertEqual(before,(self.fx.home/'CURRENT').readlink());return value
    def test_metadata_route_preview_direct_nested_and_noop(self):
        item=self.create();original=copy.deepcopy(item);category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
        args=dict(uuid=item['uuid'],category_uuid=category['uuid'],reason='Route without compaction',source_refs=[])
        move=self.request('record.move_category',args);preview_args=dict(source_refs=[],proposed_operations=[dict(operation='record.move_category',args=args)],target_expected=move['expected'],coverage_rows=[])
        preview=self.ok(self.fx.run(self.request('intake.route_preview',preview_args)))
        apply=self.request('intake.route',dict(preview_digest=preview['preview_digest'],operations=preview_args['proposed_operations'],coverage_rows=[],authority_refs=[ref(self.fx.authority)]))
        first=self.ok(self.fx.run(apply));self.refresh();item=next(x for x in self.items if x['uuid']==item['uuid'])
        for k in ('uuid','created_at','extensions','source_refs','kind'):self.assertEqual(item[k],original[k])
        self.assertEqual(item['writer'],self.fx.writer);self.assertNotEqual(item['revision_uuid'],original['revision_uuid']);self.assertEqual(item['body']['content'],original['body']['content'])
        self.assertEqual(self.inspect(original,True),original);self.assertEqual(self.inspect(item),item);self.assertEqual(self.ok(self.fx.run(apply)),first)
        self.assertEqual(self.ok(self.fx.run(self.request('record.move_category',args)))['changed_refs'],[]);self.refresh()
        for op in ('record.move_category','transaction.apply'):
            req=self.request(op,args if op=='record.move_category' else dict(operations=[dict(operation='record.move_category',args=args)]))
            req['expected'].pop(category['uuid'])
            if op=='transaction.apply':req['args']['expected']=req['expected']
            self.reject(req,'REVISION_CONFLICT')
        body={**item['body'],'content':{'edited':True}}
        self.ok(self.fx.run(self.request('transaction.apply',dict(operations=[dict(operation='record.update',args=dict(uuid=item['uuid'],body=body,source_refs=[],extensions=item['extensions']))]))));self.refresh()
        edited=next(x for x in self.items if x['uuid']==item['uuid']);self.assertEqual(edited['created_at'],original['created_at']);self.assertEqual(edited['extensions'],original['extensions'])
        stale=copy.deepcopy(apply);stale['idempotency_key']=uid();self.reject(stale,'REVISION_CONFLICT')
    def test_same_uuid_tombstone_restore_pins_default_exclusion_and_replay(self):
        item=self.create();original=copy.deepcopy(item);request=self.lifecycle('record.delete',item);deleted_result=self.ok(self.fx.run(request));self.refresh()
        deleted=next(x for x in self.items if x['uuid']==item['uuid']);self.assertEqual(deleted['lifecycle'],'deleted')
        for k in ('uuid','kind','body','extensions','created_at'):self.assertEqual(deleted[k],original[k])
        self.assertEqual(deleted['lifecycle_evidence']['previous_live_revision_uuid'],original['revision_uuid']);self.assertEqual(self.inspect(deleted),deleted);self.assertEqual(self.inspect(original,True),original)
        query=self.ok(self.fx.run(self.request('query.filter',dict(collection='content'))));self.assertNotIn(item['uuid'],[x['uuid'] for x in query['rows']])
        self.assertFalse(self.ok(self.fx.run(self.request('record.exists',dict(uuid=item['uuid']))))['details']['exists'])
        self.assertTrue(self.ok(self.fx.run(self.request('record.exists',dict(uuid=item['uuid'],revision_uuid=original['revision_uuid']))))['details']['exists'])
        self.assertEqual(self.ok(self.fx.run(request)),deleted_result);self.reject(self.lifecycle('record.delete',deleted),'INVALID_TRANSITION')
        self.reject(self.request('record.update',dict(uuid=deleted['uuid'],body=deleted['body'],source_refs=[])),'FORBIDDEN')
        restore=self.lifecycle('record.restore',deleted);restored_result=self.ok(self.fx.run(restore));self.refresh();live=next(x for x in self.items if x['uuid']==item['uuid'])
        self.assertEqual(live['lifecycle'],'live');self.assertEqual(live['uuid'],original['uuid']);self.assertNotEqual(live['revision_uuid'],original['revision_uuid']);self.assertEqual(self.inspect(deleted,True),deleted)
        self.assertEqual(self.ok(self.fx.run(restore)),restored_result);self.reject(self.lifecycle('record.restore',live),'INVALID_TRANSITION')
        self.ok(self.fx.run(self.request('record.update',dict(uuid=live['uuid'],body={**live['body'],'title':'Edited after restore'},source_refs=[]))))
    def test_archive_seed_cannot_revive_and_approval_stays_invalidated(self):
        from test_lp01_transaction import TransactionTests
        helper=TransactionTests();helper.fx=self.fx;helper.refresh()
        approval=helper.batch_evidence();self.ok(self.fx.run(approval));self.refresh()
        accepted=next(x for x in self.items if x['kind']=='acceptance');request=self.lifecycle('record.archive',self.capture)
        self.ok(self.fx.run(request));self.refresh();archived=copy.deepcopy(self.capture)
        self.assertEqual(next(x for x in self.items if x['uuid']==accepted['uuid'])['body']['state'],'invalidated')
        seed=self.fx.seed(content='Attempt silent revival');args={k:seed['args'][k] for k in ('seed_ref','scope_items','checklist_items')}
        self.reject(self.request('ticket.seed_apply',args),'INVALID_TRANSITION')
        self.ok(self.fx.run(self.lifecycle('record.restore',archived)));self.refresh()
        self.assertEqual(next(x for x in self.items if x['uuid']==accepted['uuid'])['body']['state'],'invalidated');self.assertEqual(self.capture['uuid'],archived['uuid']);self.assertEqual(self.inspect(archived,True),archived)
    def test_delete_evidenced_referenced_source_items_and_protected_reject(self):
        self.reject(self.lifecycle('record.delete',self.capture),'FORBIDDEN')
        item=self.create();edge=dict(kind='edge',body=dict(edge_kind='references',from_uuid=self.capture['uuid'],to_uuid=item['uuid'],from_revision_uuid=None,to_revision_uuid=None,scope_item_uuids=[],authority_ref=ref(self.fx.authority)),source_refs=[])
        self.ok(self.fx.run(self.request('record.create',edge)));self.refresh();self.reject(self.lifecycle('record.delete',item),'FORBIDDEN')
        self.reject(self.lifecycle('record.archive',next(x for x in self.items if x['kind']=='category')),'FORBIDDEN')
        forged=self.request('record.update',dict(uuid=item['uuid'],body=item['body'],source_refs=[]));forged['args']['lifecycle']='deleted';self.reject(forged,'INVALID_SCHEMA')
        bad=self.lifecycle('record.archive',item);bad['args']['authority_ref']=ref(self.fx.binding);bad['expected'][self.fx.binding['uuid']]=self.fx.binding['revision_uuid'];self.reject(bad,'FORBIDDEN')
    def test_frozen_paging_filter_search_count_projection_hash_and_scope(self):
        ops=[]
        for i in range(25):
            body=dict(title='Query %02d'%i,category_uuid=self.capture['body']['category_uuid'],format='plain',content='search needle',authority='proposal',state='pending',item_uuids=[])
            ops.append(dict(operation='record.create',args=dict(kind='content',body=body,source_refs=[])))
        self.ok(self.fx.run(self.request('transaction.apply',dict(operations=ops))));self.refresh()
        args=dict(collection='content',where=[dict(field='title',operator='contains-text',value='Query')],sort=dict(field='title',direction='asc'))
        first=self.ok(self.fx.run(self.request('query.filter',args)));self.assertEqual(len(first['rows']),20);self.assertEqual(first['remaining'],5);self.assertLessEqual(len(encode(first)),16384)
        old=first['captured_plan_revision_uuid'];self.create('New concurrent record')
        second=self.ok(self.fx.run(self.request('query.filter',{**args,'cursor':first['continuation']})));self.assertEqual(second['captured_plan_revision_uuid'],old);self.assertEqual(len(second['rows']),5);self.assertEqual(second['remaining'],0)
        self.reject(self.request('query.filter',{**args,'limit':99,'cursor':first['continuation']}),'CURSOR_INVALID')
        foreign=self.request('query.filter',{**args,'cursor':first['continuation']});foreign['scope'].pop('ticket_uuid');self.reject(foreign,'CURSOR_INVALID')
        cursor=first['continuation'];self.reject(self.request('query.filter',{**args,'cursor':cursor[:-4]+'AAAA'}),'CURSOR_INVALID')
        count=self.ok(self.fx.run(self.request('query.count',dict(collection='content',where=args['where']))));self.assertEqual(count['details']['count'],25)
        search=self.ok(self.fx.run(self.request('query.search',dict(collection='content',text='needle',fields=['title'],limit=100))));self.assertEqual(len(search['rows']),25)
        self.reject(self.request('query.filter',dict(collection='content',fields=['body.unregistered'])),'INVALID_SCHEMA');self.reject(self.request('query.filter',dict(collection='content',limit=101)),'INVALID_SCHEMA')
        for op in ('query.group_count','query.distinct'):
            self.ok(self.fx.run(self.request(op,dict(collection='content',group_field='state'))))
        self.ok(self.fx.run(self.request('query.exists',dict(collection='content'))));self.ok(self.fx.run(self.request('query.explain',dict(collection='content'))))
    def test_reverse_related_and_history_diff_scoped(self):
        item=self.create();edge=dict(kind='edge',body=dict(edge_kind='references',from_uuid=self.capture['uuid'],to_uuid=item['uuid'],from_revision_uuid=None,to_revision_uuid=None,scope_item_uuids=[],authority_ref=ref(self.fx.authority)),source_refs=[])
        self.ok(self.fx.run(self.request('record.create',edge)));self.refresh()
        related=self.ok(self.fx.run(self.request('record.related',dict(uuid=item['uuid'],direction='inverse'))));self.assertEqual([x['uuid'] for x in related['rows']],[self.capture['uuid']])
        self.ok(self.fx.run(self.lifecycle('record.archive',item)));self.refresh();new=next(x for x in self.items if x['uuid']==item['uuid'])
        history=self.ok(self.fx.run(self.request('record.history',dict(uuid=item['uuid']))));self.assertEqual(len(history['rows']),2)
        diff=self.ok(self.fx.run(self.request('record.diff',dict(uuid=item['uuid'],revision_uuid=item['revision_uuid'],compare_revision_uuid=new['revision_uuid']))));self.assertIn('lifecycle',diff['details']['changed_fields'])
        allhistory=self.ok(self.fx.run(self.request('query.filter',dict(collection='content',include_history=True,limit=100))));self.assertIn('archived',[x['fields']['lifecycle'] for x in allhistory['rows']])
    def test_unsupported_extension_retained_request_and_closed_kind_registry(self):
        item=self.create();args=dict(uuid=item['uuid'],body=item['body'],source_refs=[],extensions={'unsupported.extra':{'do_not_drop':'original'}})
        request=self.request('record.update',args);response=self.reject(request,'INVALID_SCHEMA')
        retained=list((self.fx.home/'.migration-reports').glob('*.json'));self.assertTrue(retained);self.assertEqual(json.loads(retained[0].read_text())['original_request'],request)
        report={'original_request':request,'migration_result':response,'disposition':'Rejected; current and original bytes retained'}
        path=self.fx.root/'migration-report.json';path.write_bytes(encode(report));self.assertEqual(json.loads(path.read_text())['original_request']['args']['extensions'],args['extensions']);self.assertEqual(self.inspect(item),item)
        catalog=self.ok(self.fx.run(self.request('catalog.list',{})))['details'];available={x['operation'] for x in catalog if x['availability']=='installed'};self.assertEqual(available,INSTALLED);self.assertIn('record.merge',available);self.assertIn('record.supersede',available)
        for kind in ('actor','assignment','source_item','coverage','receipt','plan','ticket'):
            schema=self.ok(self.fx.run(self.request('schema.describe',dict(name='record.schema.json'))))['details'];self.assertIn(kind,schema['properties']['kind']['enum'])
        self.ok(self.fx.run(self.request('validation.record',dict(record_refs=[ref(item)],checks=['shape','registered extensions'],scope=self.request('record.get',{})['scope']))))
    def test_oversize_projection_is_bounded_with_explicit_gap(self):
        item=self.create();body={**item['body'],'content':'X'*30000};self.ok(self.fx.run(self.request('record.update',dict(uuid=item['uuid'],body=body,source_refs=[]))));self.refresh()
        result=self.ok(self.fx.run(self.request('record.get',dict(uuid=item['uuid'],fields=['body','extensions']))));self.assertLessEqual(len(encode(result)),16384);self.assertIn('body',result['rows'][0]['omitted_fields']);self.assertTrue(result['gaps'])
    def test_real_publication_failure_and_reply_replay_for_lifecycle(self):
        item=self.create();request=self.lifecycle('record.delete',item);trace=self.fx.root/'trace.jsonl';path=self.fx.root/'fault.json';path.write_bytes(encode(request))
        command=[sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)]
        proc=subprocess.run(command,cwd=CHECKOUT,env={**os.environ,'LP_TX_TRACE':str(trace)},capture_output=True,text=True);self.assertEqual(proc.returncode,0,proc.stdout)
        stages=[json.loads(x) for x in trace.read_text().splitlines()];self.assertIn('selector',[x['stage'] for x in stages]);self.assertIn('fsync_file',[x['stage'] for x in stages]);self.refresh()
        # Separate request injects real selector failure; CURRENT remains old and retry once commits.
        restore=self.lifecycle('record.restore',next(x for x in self.items if x['uuid']==item['uuid']));path.write_bytes(encode(restore));trace.unlink()
        proc=subprocess.run(command,cwd=CHECKOUT,env={**os.environ,'LP_TX_TRACE':str(trace)},capture_output=True,text=True);self.assertEqual(proc.returncode,0,proc.stdout);self.refresh()
        probe=self.lifecycle('record.archive',next(x for x in self.items if x['uuid']==item['uuid']));path.write_bytes(encode(probe));trace.unlink()
        proc=subprocess.run(command,cwd=CHECKOUT,env={**os.environ,'LP_TX_TRACE':str(trace)},capture_output=True,text=True);self.assertEqual(proc.returncode,0,proc.stdout)
        archived=json.loads(proc.stdout);self.refresh()
        # Exact replay after postcommit reply error resolves original receipt, never creates another tombstone.
        boundary=next(x['index'] for x in [json.loads(x) for x in trace.read_text().splitlines()] if x['stage']=='reply')
        # replay itself has different boundary count; count its actual reply first.
        trace.unlink();subprocess.run(command,cwd=CHECKOUT,env={**os.environ,'LP_TX_TRACE':str(trace)},capture_output=True,text=True)
        boundary=next(x['index'] for x in [json.loads(x) for x in trace.read_text().splitlines()] if x['stage']=='reply')
        result=subprocess.run(command,cwd=CHECKOUT,env={**os.environ,'LP_TX_FAIL':str(boundary)},capture_output=True,text=True);self.assertEqual(result.returncode,3);self.assertEqual(json.loads(result.stdout)['commit_state'],'committed_unknown')
        self.assertEqual(self.ok(self.fx.run(probe)),archived)

    def test_numeric_sort_clone_and_source_item_route_roundtrip(self):
        sorted_rows=self.ok(self.fx.run(self.request('query.filter',dict(collection='category',sort=dict(field='order',direction='asc'),fields=['order'],limit=100))))['rows']
        orders=[x['fields']['order'] for x in sorted_rows];self.assertEqual(orders,sorted(orders));self.assertIn(10,orders)
        old=copy.deepcopy(self.capture);destination=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
        args=dict(uuid=old['uuid'],category_uuid=destination['uuid'],reason='Preserve source items and pins',source_refs=old['source_refs'])
        self.ok(self.fx.run(self.request('transaction.apply',dict(operations=[dict(operation='record.move_category',args=args)]))));self.refresh()
        moved=next(x for x in self.items if x['uuid']==old['uuid']);self.assertEqual(moved['body']['item_uuids'],old['body']['item_uuids']);self.assertEqual(moved['source_refs'],old['source_refs']);self.assertEqual(self.inspect(old,True),old)
        draft=self.create('Clone source');body={**draft['body'],'title':'Cloned pending content'}
        self.ok(self.fx.run(self.request('record.clone',dict(uuid=draft['uuid'],kind='content',source_refs=draft['source_refs'],body=body))));self.refresh()
        clone=next(x for x in self.items if x['body'].get('title')=='Cloned pending content');self.assertNotEqual(clone['uuid'],draft['uuid']);self.assertNotEqual(clone['created_at'],draft['created_at']);self.assertEqual(clone['extensions'],draft['extensions'])
        edge=next(x for x in self.items if x['kind']=='edge' and x['body']['from_uuid']==clone['uuid']);self.assertEqual(edge['body']['to_revision_uuid'],draft['revision_uuid']);self.assertEqual(edge['body']['edge_kind'],'derived_from')
        self.reject(self.lifecycle('record.delete',draft),'FORBIDDEN')

    def test_every_closed_kind_rejects_unknown_nested_field_publicly(self):
        from core.schema import schema,validate
        def sample(shape,document):
            if '$ref' in shape:
                name,_,pointer=shape['$ref'].partition('#');owner=schema(name) if name else document;target=owner
                for key in pointer.strip('/').split('/') if pointer else []:target=target[key]
                return sample(target,owner)
            if 'const' in shape:return shape['const']
            if 'enum' in shape:return shape['enum'][0]
            if 'anyOf' in shape or 'oneOf' in shape:return sample((shape.get('anyOf') or shape['oneOf'])[0],document)
            kind=shape.get('type');kind=kind[0] if isinstance(kind,list) else kind
            if kind=='object':return {k:sample(shape['properties'][k],document) for k in shape.get('required',[])}
            if kind=='array':return [sample(shape['items'],document) for _ in range(shape.get('minItems',0))]
            if kind=='integer' or kind=='number':return shape.get('minimum',0)
            if kind=='boolean':return False
            if kind=='null':return None
            if shape.get('format')=='uuid':return uid()
            if shape.get('format')=='date-time':return self.capture['created_at']
            if shape.get('pattern')=='^[a-f0-9]{64}$':return '0'*64
            return 'sample'
        document=schema('record.schema.json');checked=[]
        for kind in document['properties']['kind']['enum']:
            body=sample(document['$defs'][kind],document);validate(body,document['$defs'][kind],document)
            bad={**body,'unsupported_extra':{'retain':'this exact source field'}}
            self.reject(self.request('record.create',dict(kind=kind,body=bad,source_refs=[])),'INVALID_SCHEMA');checked.append(kind)
        self.assertEqual(len(checked),27)

    def test_invalid_retained_predecessor_refuses_public_restore(self):
        item=self.create();self.ok(self.fx.run(self.lifecycle('record.archive',item)));self.refresh();archived=next(x for x in self.items if x['uuid']==item['uuid']);request=self.lifecycle('record.restore',archived)
        planpath=self.folder/'plan.json';planraw=planpath.read_bytes();plan=json.loads(planraw);binding=next(x for x in current(plan) if x['kind']=='plan')['body']['ticket_bindings'][0];payload=self.fx.home/binding['relative_path'];raw=payload.read_bytes();ticket=json.loads(raw)
        next(x for x in current(ticket) if x['uuid']==item['uuid'])['lifecycle_evidence']['previous_live_revision_uuid']=self.capture['revision_uuid']
        payload.write_bytes(encode(ticket));binding['sha256']=file_hash(payload);planpath.write_bytes(encode(plan));proofpath=self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json');proofraw=proofpath.read_bytes();proof=json.loads(proofraw);proof['plan_sha256']=file_hash(planpath);proofpath.write_bytes(encode(proof))
        try:self.reject(request,'INVALID_SCHEMA')
        finally:payload.write_bytes(raw);planpath.write_bytes(planraw);proofpath.write_bytes(proofraw)

    def test_new_mutation_real_boundary_failures_old_or_new_and_retry(self):
        item=self.create();category=next(x for x in self.items if x['kind']=='category' and x['body']['category_key']=='issues')
        cases=[]
        for op in ('record.archive','record.delete','record.restore','record.move_category','record.clone','intake.route'):
            self.refresh();selected=next(x for x in self.items if x['uuid']==item['uuid'])
            if selected['lifecycle']!='live':self.ok(self.fx.run(self.lifecycle('record.restore',selected)));self.refresh();selected=next(x for x in self.items if x['uuid']==item['uuid'])
            # Use a distinct unused draft for each case; prior clone links must not alter delete eligibility.
            selected=self.create('Boundary '+op)
            if op=='record.restore':self.ok(self.fx.run(self.lifecycle('record.archive',selected)));self.refresh();selected=next(x for x in self.items if x['uuid']==selected['uuid'])
            if op in ('record.archive','record.delete','record.restore'):request=self.lifecycle(op,selected)
            elif op=='record.clone':request=self.request(op,dict(uuid=selected['uuid'],kind='content',source_refs=[]))
            else:
                args=dict(uuid=selected['uuid'],category_uuid=category['uuid'],reason='Boundary route',source_refs=[])
                request=self.request('record.move_category',args)
                if op=='intake.route':
                    previewargs=dict(source_refs=[],proposed_operations=[dict(operation='record.move_category',args=args)],target_expected=request['expected'],coverage_rows=[])
                    preview=self.ok(self.fx.run(self.request('intake.route_preview',previewargs)))
                    request=self.request(op,dict(preview_digest=preview['preview_digest'],operations=previewargs['proposed_operations'],coverage_rows=[],authority_refs=[]))
            backup=Path(self.tmp.name+'-backup');shutil.copytree(self.fx.root,backup,symlinks=True);old=self.plan['root_revision_uuid']
            def execute(env):
                req=self.fx.root/'fault-request.json';req.write_bytes(encode(request));result=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(req)],cwd=CHECKOUT,env={**os.environ,**env},capture_output=True,text=True);return result,json.loads(result.stdout) if result.stdout else None
            trace=self.fx.root/'boundary-trace.jsonl';proc,response=execute({'LP_TX_TRACE':str(trace)});self.assertEqual(proc.returncode,0,response);stages=[json.loads(line) for line in trace.read_text().splitlines()]
            selected_stages=[]
            for name in ('write_bytes','flush','fsync_file','selector','readback','reply'):selected_stages.append(next(x for x in stages if x['stage']==name))
            for stage in selected_stages:
                for fault in ('LP_TX_FAIL','LP_TX_STOP'):
                    shutil.rmtree(self.fx.root);shutil.copytree(backup,self.fx.root,symlinks=True)
                    proc,error=execute({fault:str(stage['index'])});self.assertNotEqual(proc.returncode,0)
                    plan,ts,folder=read_generation(self.fx.home);committed=plan['root_revision_uuid']!=old
                    self.assertEqual(committed,stage['stage'] in ('readback','reply'))
                    retry,receipt=execute({});self.assertEqual(retry.returncode,0,receipt);again,replay=execute({});self.assertEqual(again.returncode,0,replay);self.assertEqual(receipt,replay)
                    final,final_ts,final_folder=read_generation(self.fx.home);subject=next(x for x in current(final_ts[self.ticket['root_uuid']]) if x['uuid']==selected['uuid'])
                    cases.append(dict(operation=op,request=request,fault=fault,boundary=stage,exit=proc.returncode,error=error,old_generation=old,before_retry_generation=plan['root_revision_uuid'],after_retry_generation=final['root_revision_uuid'],plan_sha256=file_hash(final_folder/'plan.json'),subject=subject,receipt=receipt,replay=replay))
            shutil.rmtree(backup);self.refresh()
        output=os.environ.get('LP_A04_BOUNDARIES')
        if output:Path(output).write_bytes(encode(dict(result='PASS',cases=cases)))
        self.assertEqual(len(cases),72)

    def test_wa003_original_shape_fixtures_through_public_validation(self):
        samples=json.loads((CHECKOUT/'launchpad/assets/schema/conformance.samples.json').read_text())
        for sample in samples['shape_cases']:
            if not sample['name'].startswith('WA003') or sample['schema']!='record.schema.json':continue
            item=copy.deepcopy(sample['value']);self.fx.save(item)
            req=self.request('validation.record',dict(record_refs=[ref(item)],checks=['shape','registered extensions'],scope=self.request('record.get',{})['scope']))
            if sample['expected_shape']=='valid':self.assertEqual(self.ok(self.fx.run(req))['verdict'],'pass')
            else:self.reject(req,sample['expected_shape'])

    def test_wa003_evidenced_gate_used_owner_and_missing_predecessor(self):
        item=self.create('Evidenced draft');pin=self.capture['source_refs'][0]
        self.ok(self.fx.run(self.request('record.update',dict(uuid=item['uuid'],body=item['body'],source_refs=[pin]))));self.refresh();item=next(x for x in self.items if x['uuid']==item['uuid']);self.reject(self.lifecycle('record.delete',item),'FORBIDDEN')
        # An actual canonical independent-gate acceptance makes a draft ineligible.
        item=self.create('Gate used draft');from test_lp01_transaction import TransactionTests
        helper=TransactionTests();helper.fx=self.fx;helper.refresh();helper.capture=item
        self.ok(self.fx.run(helper.batch_evidence()));self.refresh();self.reject(self.lifecycle('record.delete',item),'FORBIDDEN')
        # Exact owner-decision authority is a controlled canonical conformance fixture.
        item=self.create('Owner decision draft');request=self.lifecycle('record.delete',item)
        planpath=self.folder/'plan.json';planraw=planpath.read_bytes();plan=json.loads(planraw);binding=next(x for x in current(plan) if x['kind']=='plan')['body']['ticket_bindings'][0];payload=self.fx.home/binding['relative_path'];raw=payload.read_bytes();ticket=json.loads(raw)
        decision=next(x for x in current(ticket) if x['uuid']==item['uuid']);decision['body']['authority']='owner_decision'
        root=next(x for x in current(ticket) if x['kind']=='ticket');root['body']['record_refs']=[ref(decision) if x['entry_uuid']==decision['uuid'] else x for x in root['body']['record_refs']]
        payload.write_bytes(encode(ticket));binding['sha256']=file_hash(payload);planpath.write_bytes(encode(plan));proofpath=self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json');proofraw=proofpath.read_bytes();proof=json.loads(proofraw);proof['plan_sha256']=file_hash(planpath);proofpath.write_bytes(encode(proof))
        try:self.reject(request,'FORBIDDEN')
        finally:payload.write_bytes(raw);planpath.write_bytes(planraw);proofpath.write_bytes(proofraw)
        item=self.create('Missing predecessor draft');self.ok(self.fx.run(self.lifecycle('record.delete',item)));self.refresh();deleted=next(x for x in self.items if x['uuid']==item['uuid']);request=self.lifecycle('record.restore',deleted)
        planpath=self.folder/'plan.json';planraw=planpath.read_bytes();plan=json.loads(planraw);binding=next(x for x in current(plan) if x['kind']=='plan')['body']['ticket_bindings'][0];payload=self.fx.home/binding['relative_path'];raw=payload.read_bytes();ticket=json.loads(raw)
        ticket['revisions']=[x for x in ticket['revisions'] if x['revision_uuid']!=item['revision_uuid']];payload.write_bytes(encode(ticket));binding['sha256']=file_hash(payload);planpath.write_bytes(encode(plan));proofpath=self.fx.home/'.prepared'/(self.plan['root_revision_uuid']+'.json');proofraw=proofpath.read_bytes();proof=json.loads(proofraw);proof['plan_sha256']=file_hash(planpath);proofpath.write_bytes(encode(proof))
        try:self.reject(request,'MISSING_EVIDENCE')
        finally:payload.write_bytes(raw);planpath.write_bytes(planraw);proofpath.write_bytes(proofraw)

    def test_nested_lifecycle_exact_metadata_and_dependency_guards(self):
        item=self.create('Nested lifecycle');original=copy.deepcopy(item)
        for op in ('record.delete','record.restore','record.archive','record.restore'):
            self.refresh();item=next(x for x in self.items if x['uuid']==original['uuid']);args=self.lifecycle(op,item)['args'];nested=self.request('transaction.apply',dict(operations=[dict(operation=op,args=args)]))
            bad=copy.deepcopy(nested);bad['expected'].pop(item['uuid']);bad['args']['expected']=copy.deepcopy(bad['expected']);self.reject(bad,'REVISION_CONFLICT')
            receipt=self.ok(self.fx.run(nested));self.refresh();item=next(x for x in self.items if x['uuid']==original['uuid'])
            for field in ('uuid','body','extensions','kind','created_at'):self.assertEqual(item[field],original[field])
            self.assertEqual(self.inspect(item),item);self.assertEqual(self.inspect(original,True),original);self.assertEqual(self.ok(self.fx.run(nested)),receipt)
        # Unbound or forged lifecycle changes cannot enter through a nested wrapper.
        args=self.lifecycle('record.delete',item)['args'];args['lifecycle']='deleted';self.reject(self.request('transaction.apply',dict(operations=[dict(operation='record.delete',args=args)])),'INVALID_SCHEMA')
        # Clone defaults clear active source/owner authority while retaining exact source/item pins.
        self.ok(self.fx.run(self.request('record.clone',dict(uuid=self.capture['uuid'],kind='content',source_refs=self.capture['source_refs']))));self.refresh()
        cloned=[x for x in self.items if x['kind']=='content' and x['body']['title']=='Initial Capture' and x['uuid']!=self.capture['uuid']][0]
        self.assertEqual(cloned['body']['state'],'pending');self.assertEqual(cloned['body']['authority'],'proposal');self.assertEqual(cloned['source_refs'],self.capture['source_refs']);self.assertEqual(cloned['body']['item_uuids'],self.capture['body']['item_uuids'])

    def test_medium_details_advance_complete_response_bound(self):
        item=self.create('Medium detail one')
        for size in (14100,14200,14300,14400):
            self.ok(self.fx.run(self.request('record.update',dict(uuid=item['uuid'],body={**item['body'],'content':'X'*size},source_refs=[]))));self.refresh();item=next(x for x in self.items if x['uuid']==item['uuid'])
            read=self.ok(self.fx.run(self.request('record.get',dict(uuid=item['uuid'],fields=['body']))))
            self.assertEqual(len(read['rows']),1);self.assertEqual(read['remaining'],0);self.assertIsNone(read['continuation']);self.assertLessEqual(len(encode(read)),16384)
            if 'body' in read['rows'][0]['fields']:self.assertEqual(read['rows'][0]['fields']['body'],item['body'])
            else:self.assertTrue(read['gaps']);self.assertIn('body',read['rows'][0]['omitted_fields'])
        other=self.create('Medium detail two');self.ok(self.fx.run(self.request('record.update',dict(uuid=other['uuid'],body={**other['body'],'content':'Y'*14100},source_refs=[]))));self.refresh()
        args=dict(collection='content',where=[dict(field='title',operator='contains-text',value='Medium detail')],fields=['body'],sort=dict(field='title',direction='asc'))
        results=[];cursor=None
        while True:
            page=self.ok(self.fx.run(self.request('query.filter',{**args,**({'cursor':cursor} if cursor else {})})));self.assertTrue(page['rows']);self.assertLessEqual(len(encode(page)),16384);results.extend(x['uuid'] for x in page['rows']);cursor=page['continuation']
            if not cursor:break
        self.assertEqual(results,[item['uuid'],other['uuid']])

    def test_typed_reference_and_retained_source_pin_forbid_direct_nested_delete(self):
        item=self.create('Typed referenced draft');body=dict(target_kind='plan_entry',locator=item['uuid'],source_checkout=None,source_ref=None,used_revision=item['revision_uuid'],used_sha256=digest(item),used_stamp=None,supported_scope=[])
        self.ok(self.fx.run(self.request('record.create',dict(kind='reference',body=body,source_refs=[]))));self.refresh();self.reject(self.lifecycle('record.delete',item),'FORBIDDEN');self.assertEqual(self.inspect(item),item)
        source=self.create('Source-used draft');consumer=self.create('Current pin consumer');original=copy.deepcopy(source);self.fx.save(source)
        pin=dict(kind='source_of_truth_contract',locator=str(self.fx.root/'.evidence'/(source['revision_uuid']+'.json')),native_ref=None,revision=source['revision_uuid'],sha256=digest(source),recorded_at=source['last_updated'])
        self.ok(self.fx.run(self.request('record.update',dict(uuid=consumer['uuid'],body=consumer['body'],source_refs=[pin]))));self.refresh()
        # A newer source revision does not make the retained source-used pin disappear.
        self.ok(self.fx.run(self.request('record.update',dict(uuid=source['uuid'],body={**source['body'],'title':'Source-used revised draft'},source_refs=[]))));self.refresh();source=next(x for x in self.items if x['uuid']==source['uuid'])
        nested=self.request('transaction.apply',dict(operations=[dict(operation='record.delete',args=self.lifecycle('record.delete',source)['args'])]));self.reject(nested,'FORBIDDEN');self.assertEqual(self.inspect(source),source);self.assertEqual(self.inspect(original,True),original)

    def test_category_source_consumption_is_not_membership_bookkeeping(self):
        source=self.create('Category-used draft');self.fx.save(source)
        pin=dict(kind='source_of_truth_contract',locator=str(self.fx.root/'.evidence'/(source['revision_uuid']+'.json')),native_ref=None,revision=source['revision_uuid'],sha256=digest(source),recorded_at=source['last_updated'])
        body=dict(title='Sourced category',category_key='sourced-category',parent_uuid=None,order=50)
        self.ok(self.fx.run(self.request('record.create',dict(kind='category',body=body,source_refs=[pin]))));self.refresh();self.reject(self.lifecycle('record.delete',source),'FORBIDDEN');self.assertEqual(self.inspect(source),source)

    def test_diff_has_both_bounded_sides_and_no_unsupported_continuation(self):
        item=self.create('Large comparison')
        revisions=[]
        for text in ('A'*14000,'B'*14000):
            self.ok(self.fx.run(self.request('record.update',dict(uuid=item['uuid'],body={**item['body'],'content':text},source_refs=[]))));self.refresh();item=next(x for x in self.items if x['uuid']==item['uuid']);revisions.append(copy.deepcopy(item))
        diff=self.ok(self.fx.run(self.request('record.diff',dict(uuid=item['uuid'],revision_uuid=revisions[0]['revision_uuid'],compare_revision_uuid=revisions[1]['revision_uuid'],fields=['body']))))
        self.assertEqual({x['revision_uuid'] for x in diff['rows']},{x['revision_uuid'] for x in revisions});self.assertEqual(diff['remaining'],0);self.assertIsNone(diff['continuation']);self.assertTrue(diff['gaps']);self.assertLessEqual(len(encode(diff)),16384);self.assertIn('body',diff['details']['changed_fields'])
        for original in revisions:
            exact=self.ok(self.fx.run(self.request('record.get',dict(uuid=item['uuid'],revision_uuid=original['revision_uuid'],fields=['body']))));self.assertEqual(exact['rows'][0]['fields']['body'],original['body'])

    def test_actual_public_utf8_wire_bytes_meet_budget(self):
        item=self.create('Wire budget array');self.ok(self.fx.run(self.request('record.update',dict(uuid=item['uuid'],body={**item['body'],'content':[0]*6800},source_refs=[]))));self.refresh()
        for op,args in [('query.filter',dict(collection='content',where=[dict(field='title',operator='eq',value='Wire budget array')],fields=['body'])),('record.get',dict(uuid=item['uuid'],fields=['body']))]:
            request=self.request(op,args);path=self.fx.root/'wire-request.json';path.write_bytes(encode(request));proc=subprocess.run([sys.executable,str(CLI),'--framework',str(self.fx.root),'--request',str(path)],cwd=CHECKOUT,capture_output=True,text=True);response=json.loads(proc.stdout)
            self.raw.append(dict(request=request,exit=proc.returncode,response=response,actual_utf8_bytes=len(proc.stdout.encode()),stdout_sha256=__import__('hashlib').sha256(proc.stdout.encode()).hexdigest()))
            self.assertEqual(proc.returncode,0,response);self.assertEqual(len(response['rows']),1);self.assertLessEqual(len(proc.stdout.encode()),16384)

    def test_nested_unknown_extensions_retain_actual_original_migration_artifact(self):
        item=self.create('Nested failed migration');old=self.plan['root_revision_uuid'];args=dict(uuid=item['uuid'],body=item['body'],source_refs=[],extensions={'unsupported.extra':{'retain':'original nested input'}})
        request=self.request('transaction.apply',dict(operations=[dict(operation='record.update',args=args)]));response=self.reject(request,'INVALID_SCHEMA');self.refresh();self.assertEqual(self.plan['root_revision_uuid'],old)
        report=self.fx.home/'.migration-reports'/(digest(request)+'.json');self.assertTrue(report.is_file());stored=json.loads(report.read_text());self.assertEqual(stored['original_request'],request);self.assertEqual(stored['rejection']['code'],'INVALID_SCHEMA');self.assertIn(str(report),response['reconciliation']);self.assertEqual(self.inspect(item),item)
        args.pop('extensions');args['unsupported_field']={'retain':'original nested closed field'};request=self.request('transaction.apply',dict(operations=[dict(operation='record.update',args=args)]));self.reject(request,'INVALID_SCHEMA');report=self.fx.home/'.migration-reports'/(digest(request)+'.json');self.assertTrue(report.is_file());self.assertEqual(json.loads(report.read_text())['original_request'],request);self.refresh();self.assertEqual(self.plan['root_revision_uuid'],old)

    def test_restored_seed_noop_retains_envelopes_and_fresh_acceptance(self):
        from test_lp01_transaction import TransactionTests
        # All owned seed contents retain restoration evidence on unchanged reseed.
        owned=[x['uuid'] for x in self.items if x['kind']=='content']
        for uuid in owned:
            self.refresh();item=next(x for x in self.items if x['uuid']==uuid);self.ok(self.fx.run(self.lifecycle('record.archive',item)));self.refresh();item=next(x for x in self.items if x['uuid']==uuid);self.ok(self.fx.run(self.lifecycle('record.restore',item)))
        self.refresh();helper=TransactionTests();helper.fx=self.fx;helper.refresh();args=helper.seed_args();before=copy.deepcopy(self.ticket)
        receipt=self.ok(self.fx.run(self.request('ticket.seed_apply',args)));self.refresh();self.assertEqual(receipt['changed_refs'],[]);self.assertEqual(self.ticket,before)
        helper.refresh();self.ok(self.fx.run(helper.batch_evidence()));self.refresh();accepted=next(x for x in self.items if x['kind']=='acceptance');self.assertEqual(accepted['body']['state'],'active');before=copy.deepcopy(self.ticket)
        nested=self.request('transaction.apply',dict(operations=[dict(operation='ticket.seed_apply',args=args)]));receipt=self.ok(self.fx.run(nested));self.refresh();self.assertEqual(receipt['changed_refs'],[]);self.assertEqual(self.ticket,before);self.assertEqual(self.ok(self.fx.run(nested)),receipt)
        self.assertEqual(next(x for x in self.items if x['kind']=='acceptance'),accepted)
        # Genuine business edits receive new live revisions, not mismatched restore evidence.
        scope=next(x for x in self.items if x['kind']=='content' and x['body']['title']=='Scope');args['scope_items'][0]['text']='Genuine changed scope after restore'
        self.ok(self.fx.run(self.request('ticket.seed_apply',args)));self.refresh();changed=next(x for x in self.items if x['uuid']==scope['uuid']);self.assertNotEqual(changed['revision_uuid'],scope['revision_uuid']);self.assertTrue(all(x is None for x in changed['lifecycle_evidence'].values()));self.assertEqual(self.inspect(scope,True),scope)
