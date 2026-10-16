import copy
import json
import tempfile
import unittest
from pathlib import Path
from support import Fixture, ref, read_generation, current, file_hash, load, uid
from core.store import digest


class SeedTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.fx=Fixture(self.temp.name)
        code,result=self.fx.create();self.assertEqual(code,0,result)

    def success(self,request):
        code,result=self.fx.run(request);self.assertEqual(code,0,result);return result

    def test_idempotent_create_clone_readback(self):
        request=self.fx.seed(scope=['Exact scope'],todo=['Exact ToDo'])
        result=self.success(request);again=self.success(request)
        self.assertEqual(result['receipt_ref'],again['receipt_ref'])
        self.assertEqual(result['captured_plan_revision_uuid'],again['captured_plan_revision_uuid'])
        plan,tickets,folder=read_generation(self.fx.home);ticket=next(iter(tickets.values()))
        contents=[x['body']['content'] for x in current(ticket) if x['kind']=='content']
        self.assertIn('Exact scope',contents);self.assertIn('Exact ToDo',contents)
        root=next(x for x in current(ticket) if x['kind']=='ticket')
        self.assertEqual(root['body']['seed_ref'],request['args']['seed_ref'])
        read=self.fx.request('record.get',{'uuid':root['uuid'],'fields':['body']});read['scope']['ticket_uuid']=root['uuid']
        self.assertEqual(self.success(read)['rows'][0]['fields']['body']['seed_ref'],request['args']['seed_ref'])
        self.assertEqual(file_hash(self.fx.home/root['body']['current_home']/'ticket.json'),file_hash(self.fx.home/next(x for x in current(plan) if x['kind']=='plan')['body']['ticket_bindings'][0]['relative_path']))
        clone=copy.deepcopy(request);clone['args']['ticket_folder']='clone';clone['idempotency_key']=uid()
        fresh=self.fx.request('ticket.create',clone['args'],clone['idempotency_key']);self.success(fresh)
        _,tickets,_=read_generation(self.fx.home);sets=[{x['uuid'] for x in current(t)} for t in tickets.values()]
        self.assertFalse(sets[0]&sets[1]);self.assertTrue(all(x['kind'] not in ('attempt','acceptance','assignment','actor') for t in tickets.values() for x in current(t)))
        self.assertFalse(any('template' in x['current_home'] for x in load(self.fx.root/'plans.json')))

    def test_identical_seed_publishes_receipt_only(self):
        create=self.fx.seed();self.success(create)
        before,tickets,_=read_generation(self.fx.home);ticket=next(iter(tickets.values()))
        business=next(x for x in current(before) if x['kind']=='plan')
        binding=copy.deepcopy(business['body']['ticket_bindings'][0])
        payload=self.fx.home/binding['relative_path'];original_bytes=payload.read_bytes()
        physical_before={str(x.relative_to(self.fx.home)) for x in payload.parent.parent.rglob('ticket.json')}
        original_business=[x for x in current(before) if x['kind']!='receipt']
        args={k:copy.deepcopy(create['args'][k]) for k in ('seed_ref','scope_items','checklist_items')}
        request=self.fx.request('ticket.seed_apply',args,uid());request['scope']['ticket_uuid']=ticket['root_uuid']
        request['expected'].update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
        result=self.success(request);after,updated,_=read_generation(self.fx.home)
        self.assertEqual(updated[ticket['root_uuid']],ticket)
        self.assertEqual([x for x in current(after) if x['kind']!='receipt'],original_business)
        self.assertEqual(next(x for x in current(after) if x['kind']=='plan')['body']['ticket_bindings'][0],binding)
        self.assertEqual(payload.read_bytes(),original_bytes)
        self.assertEqual((self.fx.home/binding['current_home']/'ticket.json').resolve(),payload)
        self.assertEqual({str(x.relative_to(self.fx.home)) for x in payload.parent.parent.rglob('ticket.json')},physical_before)
        self.assertNotEqual(after['root_revision_uuid'],before['root_revision_uuid'])
        self.assertEqual(after['commit_seq'],before['commit_seq']+1)
        receipt=next(x for x in current(after) if x['revision_uuid']==result['receipt_ref']['revision_uuid'])
        self.assertEqual(receipt['body']['old_generation'],before['root_revision_uuid'])
        self.assertEqual(receipt['body']['new_generation'],after['root_revision_uuid'])
        self.assertEqual(receipt['body']['request_sha256'],digest(request))
        self.assertEqual(result['commit_state'],'committed')
        self.assertEqual(result['changed_refs'],[]);self.assertEqual(result['changed_fields'],[])
        self.assertEqual(receipt['body']['changed_refs'],[])
        self.assertIn(result['receipt_ref'],after['idempotency_receipt_refs'])
        self.assertEqual(self.success(request),result)
        self.assertEqual(read_generation(self.fx.home)[0],after)

    def test_older_receipts_replay_original_response_without_publication(self):
        code,bootstrap=self.fx.create();self.assertEqual(code,0,bootstrap)
        first=self.fx.seed(title='First');created=self.success(first)
        _,tickets,_=read_generation(self.fx.home);ticket=next(iter(tickets.values()))
        args={k:copy.deepcopy(first['args'][k]) for k in ('seed_ref','scope_items','checklist_items')}
        noop=self.fx.request('ticket.seed_apply',args,uid());noop['scope']['ticket_uuid']=ticket['root_uuid']
        noop['expected'].update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
        unchanged=self.success(noop)
        self.success(self.fx.seed(title='Second'))
        latest=read_generation(self.fx.home)[0]
        selector=(self.fx.home/'CURRENT').readlink()
        physical={str(p.relative_to(self.fx.home)):file_hash(p) for p in self.fx.home.rglob('*') if p.is_file()}
        # Each retry runs in a new public CLI process with stale expectations.
        for original,retry in ((bootstrap,lambda:self.fx.create()),
                               (created,lambda:self.fx.run(first)),
                               (unchanged,lambda:self.fx.run(noop))):
            with self.subTest(operation=original['operation']):
                code,replayed=retry();self.assertEqual(code,0,replayed)
                self.assertEqual(replayed,original)
                retained=read_generation(self.fx.home,original['captured_plan_revision_uuid'])[0]
                self.assertEqual(replayed['high_water'],retained['commit_seq'])
                self.assertLess(replayed['high_water'],latest['commit_seq'])
                self.assertEqual((self.fx.home/'CURRENT').readlink(),selector)
                self.assertEqual(read_generation(self.fx.home)[0],latest)
                self.assertEqual({str(p.relative_to(self.fx.home)):file_hash(p) for p in self.fx.home.rglob('*') if p.is_file()},physical)

    def test_preview_has_no_publication(self):
        create=self.fx.seed();generation=read_generation(self.fx.home)[0]['root_revision_uuid']
        args=dict(source_refs=[],proposed_operations=[{k:create[k] for k in ('operation','args')}],target_expected=create['expected'],coverage_rows=[])
        result=self.success(self.fx.request('seed.edit_preview',args));self.assertEqual(result['result_kind'],'preview')
        self.assertEqual(read_generation(self.fx.home)[0]['root_revision_uuid'],generation)

    def test_rejections_do_not_publish(self):
        original=read_generation(self.fx.home)[0]['root_revision_uuid']
        requests=[]
        unsafe=self.fx.seed();unsafe['args']['ticket_folder']='../foreign';requests.append(unsafe)
        extra=self.fx.seed();extra['args']['script']='alert(1)';requests.append(extra)
        outside=self.fx.seed();source=load(self.fx.root/'.evidence'/(outside['args']['seed_ref']['revision_uuid']+'.json'))
        source['source_refs'][0]['locator']='/etc/hosts';source['source_refs'][0]['sha256']=file_hash('/etc/hosts');self.fx.save(source)
        outside['args']['seed_ref']=ref(source);outside['args']['scope_items'][0]['source']=ref(source);outside['args']['checklist_items'][0]['source']=ref(source);requests.append(outside)
        forbidden=self.fx.seed();forbidden['scope']['plan_uuid']=uid();requests.append(forbidden)
        for request in requests:
            code,result=self.fx.run(request);self.assertNotEqual(code,0,result)
            self.assertEqual(read_generation(self.fx.home)[0]['root_revision_uuid'],original)

    def test_payload_is_inert_and_duplicate_identity_rejected(self):
        payload='<a href="javascript:alert(1)">payload</a> {{SCRIPTS}} {{MODEL}} {{TITLE}}'
        request=self.fx.seed(title='{{TITLE}} {{MODEL}} {{SCRIPTS}} </script><script>globalThis.pwned=1</script>',content=payload,scope=[payload],todo=[payload])
        self.success(request);plan,tickets,folder=read_generation(self.fx.home)
        page=(folder/'plan.HTML').read_text();self.assertNotIn('</script><script>globalThis.pwned',page)
        self.assertIn('\\u003c/script',page)
        import re
        embedded=json.loads(re.search(r'<script id="rv-snapshot" type="application/json">(.*?)</script>',page,re.S)[1])
        self.assertTrue(any(x['kind']=='content' and x['body']['content']==payload for t in embedded['tickets'].values() for x in t['revisions']))
        changed=copy.deepcopy(request);changed['args']['title']='changed';code,result=self.fx.run(changed);self.assertEqual(result['code'],'IDEMPOTENCY_MISMATCH')
        duplicate=self.fx.request('ticket.create',request['args'],uid());code,result=self.fx.run(duplicate);self.assertEqual(result['code'],'REVISION_CONFLICT')
        view=self.fx.request('view.render',{'plan_revision_uuid':plan['root_revision_uuid']});self.assertEqual(self.success(view)['details']['sha256'],file_hash(folder/'plan.HTML'))

    def test_closed_schema_and_unavailable_discovery(self):
        request=self.fx.request('catalog.list',{});result=self.success(request)
        update=next(x for x in result['details'] if x['operation']=='record.update');self.assertEqual(update['availability'],'installed')
        compact=self.success(self.fx.request('catalog.list',{'category':'seed','role':'plan-seed-manager'}))
        self.assertTrue(compact['details']);self.assertTrue(all(x['operation'].startswith('seed.') for x in compact['details']))
        self.assertTrue(all('args_schema' not in x for x in compact['details']))
        self.assertLess(len(json.dumps(compact)),8000)
        malformed=self.fx.seed();malformed['args']['track_uuid']='not-uuid';code,result=self.fx.run(malformed);self.assertEqual(result['code'],'INVALID_SCHEMA')

    def test_same_key_concurrent_public_create(self):
        from concurrent.futures import ThreadPoolExecutor
        request=self.fx.seed()
        with ThreadPoolExecutor(max_workers=2) as workers:results=list(workers.map(self.fx.run,[request,request]))
        self.assertTrue(all(code==0 for code,_ in results),results)
        self.assertEqual(results[0][1]['receipt_ref'],results[1][1]['receipt_ref'])
        self.assertEqual(len(read_generation(self.fx.home)[1]),1)

    def test_seed_edit_preserves_logical_ids_and_history(self):
        create=self.fx.seed();self.success(create);plan,tickets,_=read_generation(self.fx.home);ticket=next(iter(tickets.values()))
        before={x['uuid']:(x['created_at'],x['revision_uuid']) for x in current(ticket)}
        root=next(x for x in current(ticket) if x['kind']=='ticket')
        args={k:copy.deepcopy(create['args'][k]) for k in ('seed_ref','scope_items','checklist_items')};args['scope_items'][0]['text']='Changed scope'
        request=self.fx.request('ticket.seed_apply',args,uid());request['scope']['ticket_uuid']=root['uuid'];request['expected'].update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
        self.success(request);_,tickets,_=read_generation(self.fx.home);after=tickets[root['uuid']]
        self.assertEqual(set(before),{x['uuid'] for x in current(after)})
        self.assertTrue(all(x['created_at']==before[x['uuid']][0] for x in current(after)))
        self.assertTrue(set(x[1] for x in before.values()).issubset({x['revision_uuid'] for x in after['revisions']}))
        revised=next(x for x in current(after) if x['kind']=='ticket')
        self.assertNotEqual(revised['revision_uuid'],root['revision_uuid'])
        self.assertNotEqual(revised['last_updated'],root['last_updated'])
        pinned=self.fx.request('record.get',{'uuid':root['uuid'],'revision_uuid':root['revision_uuid'],'fields':list(root)})
        pinned['scope']['ticket_uuid']=root['uuid']
        readback=self.success(pinned)['rows'][0]['fields']
        self.assertEqual(readback,root);self.assertEqual(digest(readback),digest(root))

    def test_latest_named_plan_route_preserves_foreign_snapshot(self):
        original=file_hash(self.fx.home/'plan.HTML')
        second=Fixture(self.fx.root,'second');code,result=second.create('Second named plan');self.assertEqual(code,0,result)
        self.assertEqual(file_hash(self.fx.home/'plan.HTML'),original)
        self.assertIn('Browse latest named plans',(self.fx.home/'plan.HTML').read_text())
        chooser=(self.fx.root/'plans.HTML').read_text()
        self.assertIn('work-tickets/sample/plan.HTML',chooser);self.assertIn('work-tickets/second/plan.HTML',chooser)
        self.assertIn('Second named plan',chooser)
        self.assertIn('32-record source/sample',(second.home/'plan.HTML').read_text())
        # Identical bootstrap retry repairs only a missing derived chooser.
        (self.fx.root/'plans.HTML').unlink();code,result=second.create('Second named plan');self.assertEqual(code,0,result)
        self.assertTrue((self.fx.root/'plans.HTML').is_file())

    def test_seed_category_transfer_preserves_content_identity(self):
        create=self.fx.seed();self.success(create);plan,tickets,_=read_generation(self.fx.home)
        ticket=next(iter(tickets.values()));old=next(x for x in current(ticket) if x['kind']=='content' and x['body']['title']=='Scope')
        args={k:copy.deepcopy(create['args'][k]) for k in ('seed_ref','scope_items','checklist_items')}
        args['checklist_items'].append(args['scope_items'].pop())
        request=self.fx.request('ticket.seed_apply',args,uid());request['scope']['ticket_uuid']=ticket['root_uuid']
        request['expected'].update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
        preview=self.fx.request('seed.edit_preview',dict(source_refs=[],proposed_operations=[{'operation':'ticket.seed_apply','args':args}],target_expected=request['expected'],coverage_rows=[]))
        preview['scope']['ticket_uuid']=ticket['root_uuid'];self.success(preview)
        self.assertEqual(read_generation(self.fx.home)[0]['root_revision_uuid'],plan['root_revision_uuid'])
        incomplete=copy.deepcopy(request);del incomplete['expected'][old['uuid']]
        code,result=self.fx.run(incomplete);self.assertEqual(result['code'],'REVISION_CONFLICT')
        self.assertEqual(read_generation(self.fx.home)[0]['root_revision_uuid'],plan['root_revision_uuid'])
        self.success(request)
        read=self.fx.request('record.get',{'uuid':old['uuid'],'fields':list(old)});read['scope']['ticket_uuid']=ticket['root_uuid']
        moved=self.success(read)['rows'][0]['fields'];self.assertEqual(moved['uuid'],old['uuid']);self.assertEqual(moved['created_at'],old['created_at'])
        self.assertEqual(moved['body']['title'],'ToDo');self.assertNotEqual(moved['revision_uuid'],old['revision_uuid'])
        read['args']['revision_uuid']=old['revision_uuid'];self.assertEqual(self.success(read)['rows'][0]['fields'],old)
        _,updated,_=read_generation(self.fx.home)
        self.assertEqual({x['uuid'] for x in current(ticket)},{x['uuid'] for x in current(updated[ticket['root_uuid']])})

    def test_malformed_registry_refuses_provisioning_before_publication(self):
        rows=load(self.fx.root/'plans.json');chooser_hash=file_hash(self.fx.root/'plans.HTML');original=read_generation(self.fx.home)[0]['root_revision_uuid']
        second=Fixture(self.fx.root,'second')
        invalid=[dict(uuid=uid(),title='Unsafe',current_home=value) for value in ('javascript:alert(1)//','../foreign','/tmp/foreign','work-tickets/template','work-tickets/a/../foreign')]
        invalid += [dict(uuid='not-uuid',title='Bad identity',current_home='work-tickets/other'),dict(uuid=uid(),title=[],current_home='work-tickets/other'),42]
        invalid += [dict(uuid=rows[0]['uuid'],title='Duplicate UUID',current_home='work-tickets/other'),dict(uuid=uid(),title='Duplicate home',current_home=rows[0]['current_home']),dict(uuid=17,title='Bad type',current_home='work-tickets/other')]
        link=self.fx.root/'work-tickets/linked';link.symlink_to(self.fx.sources,target_is_directory=True)
        invalid.append(dict(uuid=uid(),title='Symlink',current_home='work-tickets/linked'))
        for header in invalid:
            (self.fx.root/'plans.json').write_text(json.dumps(rows+[header]));code,result=second.create('Second')
            self.assertNotEqual(code,0,result);self.assertFalse(second.home.exists())
            self.assertEqual(file_hash(self.fx.root/'plans.HTML'),chooser_hash)
            self.assertEqual(read_generation(self.fx.home)[0]['root_revision_uuid'],original)
        (self.fx.root/'plans.json').write_text(json.dumps(rows))
        link.unlink()

    def test_chooser_preflight_refuses_new_plan_preview_and_existing_mint(self):
        chooser=self.fx.root/'plans.HTML';original=chooser.read_bytes();registry=(self.fx.root/'plans.json').read_bytes()
        generation=read_generation(self.fx.home)[0]['root_revision_uuid'];request=self.fx.seed()
        second=Fixture(self.fx.root,'second')
        preview=self.fx.request('seed.edit_preview',dict(source_refs=[],proposed_operations=[{'operation':'ticket.create','args':request['args']}],target_expected=request['expected'],coverage_rows=[]))
        with tempfile.NamedTemporaryFile() as foreign:
            foreign.write(b'Foreign file');foreign.flush()
            inside=self.fx.sources/'foreign.html';inside.write_text('Unrelated local file')
            for target in (Path(foreign.name),inside,None):
                chooser.unlink()
                if target:chooser.symlink_to(target)
                else:chooser.mkdir()
                for command in (request,preview):
                    code,result=self.fx.run(command);self.assertNotEqual(code,0,result);self.assertEqual(result['commit_state'],'nonmutation')
                code,result=second.create('Second');self.assertNotEqual(code,0,result);self.assertEqual(result['commit_state'],'nonmutation')
                self.assertFalse(second.home.exists());self.assertEqual((self.fx.root/'plans.json').read_bytes(),registry)
                self.assertEqual(read_generation(self.fx.home)[0]['root_revision_uuid'],generation)
                self.assertEqual(Path(foreign.name).read_bytes(),b'Foreign file');self.assertEqual(inside.read_text(),'Unrelated local file')
                if target:chooser.unlink()
                else:chooser.rmdir()
                chooser.write_bytes(original)

    def test_real_postcommit_chooser_failure_is_committed_unknown(self):
        import time
        from concurrent.futures import ThreadPoolExecutor
        from core.schema import named
        second=Fixture(self.fx.root,'second')
        # Real retained actor data keeps public readback active after CURRENT,
        # allowing a concurrent filesystem replacement without production hooks.
        second.actor['revision_uuid']=uid();second.actor['extensions']={'source.preserved':{'fixture_padding':'x'*8000000}}
        second.save(second.actor)
        with ThreadPoolExecutor(max_workers=1) as pool:
            result=pool.submit(second.create,'Second')
            deadline=time.monotonic()+15
            while not (second.home/'CURRENT').exists() and time.monotonic()<deadline and not result.done():time.sleep(.001)
            self.assertTrue((second.home/'CURRENT').exists())
            chooser=self.fx.root/'plans.HTML';chooser.unlink();chooser.mkdir()
            code,response=result.result(timeout=15)
        named(response,'response.schema.json')
        self.assertNotEqual(code,0,response);self.assertEqual(response['commit_state'],'committed_unknown')
        self.assertTrue((second.home/'CURRENT').exists());self.assertTrue(any(x['uuid']==second.plan_id for x in load(self.fx.root/'plans.json')))

    def test_corruption_and_link_escape_refuse_writes(self):
        self.success(self.fx.seed());plan,tickets,folder=read_generation(self.fx.home);generation=plan['root_revision_uuid']
        binding=next(x for x in current(plan) if x['kind']=='plan')['body']['ticket_bindings'][0]
        request=self.fx.seed();payload=self.fx.home/binding['relative_path'];payload.write_text('{}')
        code,result=self.fx.run(request);self.assertNotEqual(code,0,result);self.assertEqual((self.fx.home/'CURRENT').readlink().name,generation)


if __name__=='__main__':unittest.main()
