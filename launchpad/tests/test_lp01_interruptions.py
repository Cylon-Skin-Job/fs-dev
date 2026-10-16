"""Kill/fail before every actual filesystem boundary, then restart publicly."""
import copy
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from support import Fixture, CHECKOUT, CLI, encode, current, read_generation, file_hash, ref, envelope, uid
from test_lp01_transaction import GRANTS


class InterruptionTests(unittest.TestCase):
    def command(self,fx,request,env=None):
        path=fx.root/'fault-request.json';path.write_bytes(encode(request))
        result=subprocess.Popen([sys.executable,str(CLI),'--framework',str(fx.root),'--request',str(path)],cwd=CHECKOUT,
                              env={**os.environ,**(env or {})},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        result.stdout,result.stderr=result.communicate()
        return result,json.loads(result.stdout) if result.stdout else None

    def update(self,fx):
        plan,tickets,_=read_generation(fx.home);ticket=next(iter(tickets.values()))
        item=next(x for x in current(ticket) if x['kind']=='content' and x['body']['title']=='Initial Capture')
        body=copy.deepcopy(item['body']);body['content']='Atomic fault-matrix update'
        req=fx.request('record.get',{});req.update(tool='db.mutate',operation='record.update',args=dict(uuid=item['uuid'],body=body,source_refs=item['source_refs']),idempotency_key=uid(),
            expected_plan_revision_uuid=plan['root_revision_uuid'],expected={x['uuid']:x['revision_uuid'] for x in current(plan)+current(ticket)})
        req['scope']['ticket_uuid']=ticket['root_uuid'];return req

    def verify_physical(self,fx,request,registered=True):
        plan,tickets,folder=read_generation(fx.home)
        self.assertEqual(json.loads((fx.home/'CURRENT/plan.json').read_text()),plan)
        pages=[folder/'plan.HTML'];payloads=[]
        for ticket in tickets.values():
            root=next(x for x in current(ticket) if x['kind']=='ticket');child=fx.home/root['body']['current_home']
            self.assertEqual(json.loads((child/'ticket.json').read_text()),ticket)
            payloads.append(dict(owner=str(child),sha256=file_hash(child/'ticket.json'),revision=ticket['root_revision_uuid']))
            pages += [child/'ticket.html',folder/'tickets'/(ticket['root_uuid']+'.html')]
        for page in pages:
            model=json.loads(re.search(r'<script id="rv-snapshot" type="application/json">(.*?)</script>',page.read_text(),re.S)[1])
            self.assertEqual(model['generation'],plan['root_revision_uuid'])
        read=fx.request('record.get',dict(uuid=plan['root_uuid'],fields=['body']));proc,response=self.command(fx,read)
        if registered:
            self.assertEqual(proc.returncode,0,response);self.assertEqual(response['captured_plan_revision_uuid'],plan['root_revision_uuid'])
        else:self.assertEqual(response['code'],'BINDING_AMBIGUOUS')
        return dict(generation=plan['root_revision_uuid'],plan_sha256=file_hash(folder/'plan.json'),view_hashes={str(p.relative_to(fx.home)):file_hash(p) for p in pages},payloads=payloads,public_read=response)

    def test_every_actual_update_and_provision_boundary_kill_and_failure(self):
        matrix=[]
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp)
            for mode in ['update','ticket','provision']:
                fx=Fixture(base/mode);fx.actor['body']['granted_operations']+=GRANTS;fx.save(fx.actor)
                if mode=='update':
                    self.assertEqual(fx.create()[0],0);self.assertEqual(fx.run(fx.seed())[0],0);request=self.update(fx)
                    old=read_generation(fx.home)[0]['root_revision_uuid']
                elif mode=='ticket':
                    self.assertEqual(fx.create()[0],0);request=fx.seed();old=read_generation(fx.home)[0]['root_revision_uuid']
                else:
                    request=fx.request('plan.create',dict(title='Atomic provisioning',plan_folder=fx.plan_folder,tracks=fx.tracks,bootstrap_evidence_refs=[ref(fx.assignment),ref(fx.authority),ref(fx.binding)]),'plan')
                    old=None
                backup=base/(mode+'-backup');shutil.copytree(fx.root,backup,symlinks=True)
                trace=base/(mode+'-trace.jsonl');proc,response=self.command(fx,request,{'LP_TX_TRACE':str(trace)})
                self.assertEqual(proc.returncode,0,response);stages=[json.loads(line) for line in trace.read_text().splitlines()]
                self.assertIn('selector',[x['stage'] for x in stages]);self.assertIn('reply',[x['stage'] for x in stages])
                if mode=='provision':self.assertIn('chooser',[x['stage'] for x in stages]);self.assertTrue(any(x['stage']=='replace' and x['path'].endswith('plans.json') for x in stages))
                for fault in ['LP_TX_STOP','LP_TX_FAIL']:
                    for stage in stages:
                        with self.subTest(mode=mode,fault=fault,stage=stage):
                            shutil.rmtree(fx.root);shutil.copytree(backup,fx.root,symlinks=True)
                            proc,error=self.command(fx,request,{fault:str(stage['index'])})
                            if fault=='LP_TX_STOP':self.assertEqual(proc.returncode,-9)
                            else:self.assertNotEqual(proc.returncode,0,error)
                            selected=(fx.home/'CURRENT').is_symlink()
                            if selected:
                                physical=self.verify_physical(fx,request,registered=(fx.root/'plans.json').is_file())
                                if mode=='update':
                                    plan,tickets,_=read_generation(fx.home);item=next(x for x in current(next(iter(tickets.values()))) if x['kind']=='content' and x['body']['title']=='Initial Capture')
                                    self.assertEqual(item['body']['content'],'Atomic fault-matrix update' if plan['root_revision_uuid']!=old else 'Initial owner scope')
                                    # Public inspect enumerates partial child/generation payloads in a fresh process.
                                    inspect=fx.request('record.get',{});inspect.update(tool='db.validate',operation='recovery.inspect',args=dict(record_refs=[],checks=['publication inventory'],scope=inspect['scope']))
                                    inspect_proc,inventory=self.command(fx,inspect);self.assertEqual(inspect_proc.returncode,0,inventory)
                                    physical['inventory']=inventory
                            else:
                                physical=dict(generation=None,registry_exists=(fx.root/'plans.json').exists())
                                self.assertFalse((fx.root/'plans.json').exists())
                            restart,committed=self.command(fx,request);self.assertEqual(restart.returncode,0,committed)
                            final=self.verify_physical(fx,request)
                            replay,again=self.command(fx,request);self.assertEqual(replay.returncode,0,again);self.assertEqual(committed,again)
                            self.assertEqual(final['generation'],read_generation(fx.home)[0]['root_revision_uuid'])
                            matrix.append(dict(mode=mode,fault=fault,stage=stage,exit=proc.returncode,error=error,before_retry=physical,after_retry=final,original_receipt=committed,replay_receipt=again))
            report=os.environ.get('LP_MATRIX_REPORT')
            if report:Path(report).write_text(json.dumps(dict(result='PASS',cases=matrix),indent=2)+'\n')
            print('Actual per-file interruption boundaries:',len(matrix),'kill/failure cases')

    def test_exact_recovery_preview_apply_and_inactive_writer_refusal(self):
        with tempfile.TemporaryDirectory() as tmp:
            fx=Fixture(tmp);fx.actor['body']['granted_operations']+=GRANTS;fx.save(fx.actor)
            self.assertEqual(fx.create()[0],0);self.assertEqual(fx.run(fx.seed())[0],0);request=self.update(fx)
            trace=Path(tmp)/'trace';proc,response=self.command(fx,request,{'LP_TX_TRACE':str(trace)});self.assertEqual(proc.returncode,0,response)
            # Create an unselected complete prepared generation by killing immediately before selector.
            request=self.update(fx);request['args']['body']['content']='unselected prepared'
            stage=next(json.loads(x)['index'] for x in trace.read_text().splitlines() if json.loads(x)['stage']=='selector')
            proc,_=self.command(fx,request,{'LP_TX_STOP':str(stage)});self.assertEqual(proc.returncode,-9)
            killed_writer_pid=proc.pid
            plan,tickets,_=read_generation(fx.home);selected=plan['root_revision_uuid']
            from core.recovery import inventory
            row=next(x for x in inventory(fx.home)['generations'] if x['status']=='prepared' and x['generation']!=selected and x['generation'] not in [r['body']['new_generation'] for r in current(plan) if r['kind']=='receipt'])
            receipt=next(x for x in row['receipt_refs'] if x not in plan['idempotency_receipt_refs'])
            preview=fx.request('record.get',{});preview.update(tool='db.context',operation='recovery.plan',args=dict(prepared_receipt_ref=receipt,current_generation=selected,scope=preview['scope']))
            proc,proposal=self.command(fx,preview);self.assertEqual(proc.returncode,0,proposal)
            proof=fx.save(envelope('content',dict(title='Exited real subprocess',category_uuid=uid(),format='json',content=dict(state='inactive',assignment_uuid=fx.assignment['uuid'],pid=killed_writer_pid),authority='active_code_constraint',state='active',item_uuids=[]),fx.writer))
            args=proposal['proposed_operations'][0]['args'];args['inactive_writer_refs']=[ref(proof)]
            apply=fx.request('record.get',{});expected={x['uuid']:x['revision_uuid'] for x in current(plan)}
            expected.update({proof['uuid']:proof['revision_uuid'],fx.authority['uuid']:fx.authority['revision_uuid']})
            args['current_expected']=expected
            apply.update(tool='db.mutate',operation='recovery.apply',args=args,idempotency_key=uid(),expected=expected,expected_plan_revision_uuid=selected)
            proc,response=self.command(fx,apply);self.assertEqual(proc.returncode,0,response)
            self.assertEqual(next(iter(read_generation(fx.home)[1].values())),next(iter(tickets.values())))
            self.assertTrue((fx.home/'.revisions'/row['generation']).exists());self.assertTrue((fx.home/'.recovery'/('action-'+receipt['revision_uuid']+'.json')).is_file())
            self.assertEqual(self.command(fx,apply)[1],response)
            # A selected older receipt is acknowledged without reapplying or rolling back newer content.
            prior_receipt=read_generation(fx.home,selected)[0]['idempotency_receipt_refs'][-1]
            latest,tickets,_=read_generation(fx.home)
            preview['args'].update(prepared_receipt_ref=prior_receipt,current_generation=latest['root_revision_uuid'])
            proc,proposal=self.command(fx,preview);self.assertEqual(proc.returncode,0,proposal)
            args=proposal['proposed_operations'][0]['args'];args['inactive_writer_refs']=[ref(proof)]
            expected={x['uuid']:x['revision_uuid'] for x in current(latest)};expected.update({proof['uuid']:proof['revision_uuid'],fx.authority['uuid']:fx.authority['revision_uuid']});args['current_expected']=expected
            apply.update(args=args,idempotency_key=uid(),expected=expected,expected_plan_revision_uuid=latest['root_revision_uuid'])
            proc,ack=self.command(fx,apply);self.assertEqual(proc.returncode,0,ack)
            self.assertEqual(read_generation(fx.home)[1],tickets)
            # An explicitly alive writer is never stolen, even with an otherwise exact schema/grant.
            plan,_,_=read_generation(fx.home);proof['revision_uuid']=uid();proof['body']['content']['pid']=os.getpid();fx.save(proof)
            preview['args']['current_generation']=plan['root_revision_uuid'];proc,proposal=self.command(fx,preview)
            args=proposal['proposed_operations'][0]['args'];args['inactive_writer_refs']=[ref(proof)]
            expected={x['uuid']:x['revision_uuid'] for x in current(plan)};expected.update({proof['uuid']:proof['revision_uuid'],fx.authority['uuid']:fx.authority['revision_uuid']});args['current_expected']=expected
            apply.update(args=args,idempotency_key=uid(),expected=expected,expected_plan_revision_uuid=plan['root_revision_uuid'])
            self.assertEqual(self.command(fx,apply)[1]['code'],'FORBIDDEN')
