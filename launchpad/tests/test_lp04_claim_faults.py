"""Actual A10 publication fsync/rename/reply failures, recovery and exact replay."""
import json
import os
import unittest
from pathlib import Path
import test_lp04_claims as claims
from support import ref, encode, file_hash, current
from core.store import read_generation


class ClaimFaultTests(unittest.TestCase):
    def prepare(self,t,kind):
        job,_=t.publish();actor,binding=t.bind(job);t.dispatch(job,actor)
        if kind=='claim':return t.claim_request(job,actor,binding)
        attempt,_,_=t.claim(job,actor,binding)
        if kind=='start':return t.start_request(job,actor,attempt)
        if kind=='handoff':
            new,_=t.bind(job);t.dispatch(job,new)
            proof=t.runtime('inactive',job,actor,attempt,manager_uuid=t.fx.actor['uuid'],inactive=True)
            return t.request('assignment.handoff',dict(assignment_ref=ref(job),actor_uuid=new['uuid'],inactive_or_interrupt_ack_ref=ref(proof),predecessor_attempt_ref=ref(attempt)))
        t.ok(t.call(t.start_request(job,actor,attempt)));attempt=t.attempt(attempt['uuid'])
        report=t.saved({'frozen':'report'});checks=dict(commands=['test'],results=['pass'],warnings=[],skips=[],deviations=[])
        path=Path(job['body']['report_path']);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(encode(report))
        proof=t.runtime('return',job,actor,attempt,report_file_sha256=file_hash(path),recipient_actor_uuid=t.fx.actor['uuid'],deliverable_refs=[ref(report)],return_checks=checks,report_path=job['body']['report_path'])
        return t.request('run.return_record',dict(assignment_uuid=job['uuid'],attempt_uuid=attempt['uuid'],evidence_refs=[ref(proof)],summary='Return public fault proof',deliverable_refs=[ref(report)],return_checks=checks),actor)

    def capture(self,t,label):
        t.refresh();prepared=t.fx.home/'.prepared'/(t.plan['root_revision_uuid']+'.json')
        value=json.loads(prepared.read_text());paths=[t.folder/'plan.json',prepared]+[t.folder/k for k in value['view_hashes']]
        root=next(x for x in current(t.plan) if x['kind']=='plan');paths += [t.fx.home/x['relative_path'] for x in root['body']['ticket_bindings']]
        rows=[];destination=os.environ.get('LP_A10_PHYSICAL')
        for p in paths:
            data=p.read_bytes();saved=None
            if destination:
                q=Path(destination)/'physical-bytes'/file_hash(p);q.parent.mkdir(parents=True,exist_ok=True)
                if not q.exists():q.write_bytes(data)
                saved=str(q)
            rows.append(dict(path=str(p),sha256=file_hash(p),bytes=len(data),retained_path=saved))
        inventory=[]
        for p in t.fx.home.rglob('*'):
            if p.is_file() and not p.is_symlink() and any(x in ('.revisions','.prepared') for x in p.parts):
                inventory.append(dict(path=str(p),sha256=file_hash(p),bytes=p.stat().st_size))
                if destination:
                    q=Path(destination)/'physical-bytes'/file_hash(p)
                    if not q.exists():q.write_bytes(p.read_bytes())
        return dict(label=label,generation=t.plan['root_revision_uuid'],selector=os.readlink(t.fx.home/'CURRENT'),files=rows,inventory=inventory)

    def identity(self,cap):return cap['generation'],cap['selector'],[(x['path'],x['sha256']) for x in cap['files']]

    def exercise(self,kind):
        probe=claims.ClaimsTests();probe.setUp()
        try:
            req=self.prepare(probe,kind);trace=probe.fx.root/'trace.jsonl';probe.ok(probe.call(req,extra={'LP_TX_TRACE':str(trace)}));events=[json.loads(x) for x in trace.read_text().splitlines()]
        finally:probe.tearDown()
        selected=[('write_bytes','ticket.json'),('flush','plan.json'),('fsync_file','ticket.json'),('fsync_dir',None),('selector',None),('readback',None),('reply',None)]
        cases=[]
        for stage,suffix in selected:
            boundary=next(x for x in events if x['stage']==stage and (not suffix or x['path'].endswith(suffix)))
            t=claims.ClaimsTests();t.setUp()
            try:
                req=self.prepare(t,kind);before=self.capture(t,kind+'-'+stage+'-before')
                failed_trace=t.fx.root/'fault-trace.jsonl';code,value=t.call(req,extra={'LP_TX_FAIL':str(boundary['index']),'LP_TX_TRACE':str(failed_trace)})
                self.assertEqual(code,3,value);actual=next(x for x in map(json.loads,failed_trace.read_text().splitlines()) if x['index']==boundary['index']);self.assertEqual(actual['stage'],stage)
                fault=self.capture(t,kind+'-'+stage+'-fault');committed=stage in ('readback','reply')
                self.assertEqual(value['commit_state'],'committed_unknown' if committed else 'nonmutation')
                if not committed:self.assertEqual(self.identity(before),self.identity(fault))
                else:self.assertNotEqual(before['generation'],fault['generation'])
                # Inspect the actual public retained recovery inventory; it may
                # not execute or steal any dispatch/claim while reconciling.
                scope={'plan_uuid':t.plan['root_uuid'],'ticket_uuid':t.ticket['root_uuid'],'include_history':False}
                recovery=t.ok(t.call(t.request('recovery.inspect',dict(record_refs=[],checks=['publication inventory'],scope=scope))))
                t.refresh();self.assertEqual(t.plan['root_revision_uuid'],fault['generation'])
                response=t.ok(t.call(req));replay=self.capture(t,kind+'-'+stage+'-replay');again=t.ok(t.call(req));self.assertEqual(response,again);repeat=self.capture(t,kind+'-'+stage+'-repeat');self.assertEqual(self.identity(replay),self.identity(repeat))
                cases.append(dict(boundary=actual,before=before,fault=fault,recovery=recovery,response=value,replay=replay,replay_response=response,repeat=repeat,raw=t.raw))
            finally:t.tearDown()
        destination=os.environ.get('LP_A10_PHYSICAL')
        if destination:
            p=Path(destination)/(kind+'-faults.json');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(encode(dict(kind=kind,trace=events,cases=cases,limits='Real local POSIX boundaries and public subprocesses; simulated IO failure is not hardware power loss or native runtime failure.')))

    def test_claim_physical_fault_recovery_and_replay(self):self.exercise('claim')
    def test_start_physical_fault_recovery_and_replay(self):self.exercise('start')
    def test_handoff_physical_fault_recovery_and_replay(self):self.exercise('handoff')
    def test_return_save_physical_fault_recovery_and_replay(self):self.exercise('return')


if __name__=='__main__':unittest.main()
