"""Actual recovery and unpublished-child retry interruptions through public CLI."""
import fcntl
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from support import Fixture, CHECKOUT, CLI, encode, current, read_generation, ref, envelope, uid
from test_lp01_transaction import GRANTS
import test_lp01_interruptions as interruptions


class RecoveryBoundaryTests(unittest.TestCase):
    command=interruptions.InterruptionTests.command
    update=interruptions.InterruptionTests.update
    verify_physical=interruptions.InterruptionTests.verify_physical

    def fixture(self,path):
        fx=Fixture(path);fx.actor['body']['granted_operations']+=GRANTS;fx.save(fx.actor)
        self.assertEqual(fx.create()[0],0);return fx

    def interrupted(self,fx,request,base):
        backup=base/'initial';shutil.copytree(fx.root,backup,symlinks=True)
        trace=base/'initial-trace';proc,value=self.command(fx,request,{'LP_TX_TRACE':str(trace)});self.assertEqual(proc.returncode,0,value)
        selector=next(json.loads(x)['index'] for x in trace.read_text().splitlines() if json.loads(x)['stage']=='selector')
        shutil.rmtree(fx.root);shutil.copytree(backup,fx.root,symlinks=True)
        killed,_=self.command(fx,request,{'LP_TX_STOP':str(selector)});self.assertEqual(killed.returncode,-9)
        return killed.pid

    def recovery_request(self,fx,pid):
        plan,_,_=read_generation(fx.home)
        inspect=fx.request('record.get',{});inspect.update(tool='db.validate',operation='recovery.inspect',args=dict(record_refs=[],checks=['retained inventory'],scope=inspect['scope']))
        proc,result=self.command(fx,inspect);self.assertEqual(proc.returncode,0,result)
        inventory=json.loads(result['findings'][0])
        reference=next(pin for row in inventory['generations'] for pin in row.get('receipt_refs',[]) if pin not in plan['idempotency_receipt_refs'])
        preview=fx.request('record.get',{});preview.update(tool='db.context',operation='recovery.plan',args=dict(prepared_receipt_ref=reference,current_generation=plan['root_revision_uuid'],scope=preview['scope']))
        proc,result=self.command(fx,preview);self.assertEqual(proc.returncode,0,result)
        proof=fx.save(envelope('content',dict(title='Original killed writer',category_uuid=uid(),format='json',content=dict(state='inactive',assignment_uuid=fx.assignment['uuid'],pid=pid),authority='active_code_constraint',state='active',item_uuids=[]),fx.writer))
        args=result['proposed_operations'][0]['args'];expected={x['uuid']:x['revision_uuid'] for x in current(plan)}
        expected.update({proof['uuid']:proof['revision_uuid'],fx.authority['uuid']:fx.authority['revision_uuid']})
        args.update(inactive_writer_refs=[ref(proof)],current_expected=expected)
        request=fx.request('record.get',{});request.update(tool='db.mutate',operation='recovery.apply',args=args,idempotency_key=uid(),expected=expected,expected_plan_revision_uuid=plan['root_revision_uuid'])
        return request,inspect,preview

    def test_every_actual_recovery_and_retry_boundary_kill_and_failure(self):
        matrix=[];planned=0
        with tempfile.TemporaryDirectory() as tmp:
            for mode in ('recovery','ticket-retry'):
                base=Path(tmp)/mode;base.mkdir();fx=self.fixture(base/'framework')
                if mode=='recovery':
                    self.assertEqual(fx.run(fx.seed())[0],0)
                    pid=self.interrupted(fx,self.update(fx),base)
                    request,inspect,_=self.recovery_request(fx,pid)
                else:
                    request=fx.seed();self.interrupted(fx,request,base);inspect=None
                old_plan,old_tickets,_=read_generation(fx.home)
                backup=base/'backup';shutil.copytree(fx.root,backup,symlinks=True)
                trace=base/'trace';proc,result=self.command(fx,request,{'LP_TX_TRACE':str(trace)});self.assertEqual(proc.returncode,0,result)
                stages=[json.loads(x) for x in trace.read_text().splitlines()]
                planned+=2*len(stages)
                if mode=='ticket-retry':
                    self.assertIn('alias_link',[x['stage'] for x in stages]);self.assertIn('alias_replace',[x['stage'] for x in stages])
                else:
                    self.assertTrue(any('/.recovery/' in x['path'] and x['stage']=='write_bytes' for x in stages))
                for fault in ('LP_TX_STOP','LP_TX_FAIL'):
                    for stage in stages:
                        with self.subTest(mode=mode,fault=fault,stage=stage):
                            shutil.rmtree(fx.root);shutil.copytree(backup,fx.root,symlinks=True)
                            proc,error=self.command(fx,request,{fault:str(stage['index'])})
                            self.assertEqual(proc.returncode,-9) if fault=='LP_TX_STOP' else self.assertNotEqual(proc.returncode,0,error)
                            physical=self.verify_physical(fx,request)
                            if inspect:
                                check,inventory=self.command(fx,inspect);self.assertEqual(check.returncode,0,inventory)
                                physical['inventory']=inventory
                                self.assertEqual(read_generation(fx.home)[1],old_tickets)
                            retry,committed=self.command(fx,request);self.assertEqual(retry.returncode,0,committed)
                            final=self.verify_physical(fx,request)
                            replay,again=self.command(fx,request);self.assertEqual(replay.returncode,0,again);self.assertEqual(committed,again)
                            if inspect:
                                self.assertEqual(committed['changed_refs'],[]);self.assertEqual(read_generation(fx.home)[1],old_tickets)
                                check,inventory=self.command(fx,inspect);self.assertEqual(check.returncode,0,inventory);final['inventory']=inventory
                            matrix.append(dict(mode=mode,fault=fault,stage=stage,exit=proc.returncode,error=error,before_retry=physical,after_retry=final,original_receipt=committed,replay_receipt=again,old_generation=old_plan['root_revision_uuid']))
            if os.environ.get('LP_RECOVERY_MATRIX_REPORT'):Path(os.environ['LP_RECOVERY_MATRIX_REPORT']).write_text(json.dumps(dict(result='PASS' if len(matrix)==planned else 'FAIL',planned_cases=planned,cases=matrix),indent=2)+'\n')
            print('Actual recovery/retry interruption boundaries:',len(matrix),'kill/failure cases')

    def test_recovery_reads_wait_for_real_exclusive_lock(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);fx=self.fixture(base/'framework');self.assertEqual(fx.run(fx.seed())[0],0)
            pid=self.interrupted(fx,self.update(fx),base);_,inspect,preview=self.recovery_request(fx,pid)
            for request in (inspect,preview):
                path=fx.root/'held-lock-request.json';path.write_bytes(encode(request))
                with (fx.home/'.write.lock').open('a+') as handle:
                    fcntl.flock(handle,fcntl.LOCK_EX)
                    proc=subprocess.Popen([sys.executable,str(CLI),'--framework',str(fx.root),'--request',str(path)],cwd=CHECKOUT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                    time.sleep(.3);self.assertIsNone(proc.poll(),'Recovery read escaped actual exclusive lock')
                    fcntl.flock(handle,fcntl.LOCK_UN)
                    out,err=proc.communicate(timeout=5);self.assertEqual(proc.returncode,0,(out,err))

    def test_recovery_exact_retry_refuses_foreign_stage_and_changed_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);fx=self.fixture(base/'framework');self.assertEqual(fx.run(fx.seed())[0],0)
            pid=self.interrupted(fx,self.update(fx),base);request,inspect,_=self.recovery_request(fx,pid)
            proc,value=self.command(fx,inspect);self.assertEqual(proc.returncode,0,value)
            committed=read_generation(fx.home)[0]['idempotency_receipt_refs']
            target=next(x['generation'] for x in json.loads(value['findings'][0])['generations'] if any(r not in committed for r in x.get('receipt_refs',[])))
            backup=base/'pre-recovery';shutil.copytree(fx.root,backup,symlinks=True)
            trace=base/'recovery-trace';proc,value=self.command(fx,request,{'LP_TX_TRACE':str(trace)});self.assertEqual(proc.returncode,0,value)
            stage=next(json.loads(x)['index'] for x in trace.read_text().splitlines() if json.loads(x)['stage']=='selector')
            shutil.rmtree(fx.root);shutil.copytree(backup,fx.root,symlinks=True)
            killed,_=self.command(fx,request,{'LP_TX_STOP':str(stage)});self.assertEqual(killed.returncode,-9)
            retained=base/'retained';shutil.copytree(fx.root,retained,symlinks=True)
            for mutation in ('foreign','target'):
                shutil.rmtree(fx.root);shutil.copytree(retained,fx.root,symlinks=True)
                if mutation=='foreign':(fx.home/'.revisions'/uid()).mkdir()
                else:
                    (fx.home/'.revisions'/target/'additional-evidence').write_text('Changed original staged target')
                proc,error=self.command(fx,request);self.assertEqual(error['code'],'REVISION_CONFLICT')


if __name__=='__main__':unittest.main()
