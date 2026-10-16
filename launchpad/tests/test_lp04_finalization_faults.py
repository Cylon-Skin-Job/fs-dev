"""A13 integration/finalize/release writes through actual physical fault seams."""
import json
import os
import unittest
from pathlib import Path
import test_lp04_claim_faults as prior
import test_lp04_finalization as final_tests
from support import ref, encode, file_hash, uid


class FinalizationFaultTests(unittest.TestCase):
    identity=prior.ClaimFaultTests.identity

    def capture(self,t,label):
        previous=os.environ.get('LP_A10_PHYSICAL');destination=os.environ.get('LP_A13_PHYSICAL')
        if destination:os.environ['LP_A10_PHYSICAL']=destination
        try:value=prior.ClaimFaultTests.capture(self,t,label)
        finally:
            if previous is None:os.environ.pop('LP_A10_PHYSICAL',None)
            else:os.environ['LP_A10_PHYSICAL']=previous
        value['evidence']=[]
        for p in (t.fx.root/'.evidence').glob('*.json'):
            row=dict(path=str(p),sha256=file_hash(p),bytes=p.stat().st_size)
            if destination:
                q=Path(destination)/'physical-bytes'/file_hash(p);q.parent.mkdir(parents=True,exist_ok=True)
                if not q.exists():q.write_bytes(p.read_bytes())
                row['retained_path']=str(q)
            value['evidence'].append(row)
        value['source_files']=[]
        paths=list(t.fx.sources.rglob('*'))+[Path(x['body']['report_path']) for x in t.items if x['kind']=='assignment']
        for p in paths:
            if not p.is_file() or p.is_symlink():continue
            row=dict(path=str(p),sha256=file_hash(p),bytes=p.stat().st_size)
            if destination:
                q=Path(destination)/'physical-bytes'/file_hash(p)
                if not q.exists():q.write_bytes(p.read_bytes())
                row['retained_path']=str(q)
            value['source_files'].append(row)
        return value

    def prepare(self,t,kind):
        candidate,_=t.accepted_candidate()
        if kind=='integration':return t.request('integration.record',t.integration_args(candidate),key=uid())
        record,_=t.run_integration(candidate)
        if kind=='finalize':return t.finalize_request(record,candidate)
        t.ok(t.call(t.finalize_request(record,candidate)))
        return t.request('track.release_check',dict(integration_ref=ref(record)),key=uid())

    def exercise(self,kind):
        probe=final_tests.FinalizationTests();probe.setUp()
        try:
            request=self.prepare(probe,kind);trace=probe.fx.root/'trace.jsonl';probe.ok(probe.call(request,extra={'LP_TX_TRACE':str(trace)}));events=[json.loads(x) for x in trace.read_text().splitlines()]
        finally:probe.tearDown()
        cases=[]
        for stage,suffix in [('write_bytes','ticket.json'),('flush','plan.json'),('fsync_file','ticket.json'),('fsync_dir',None),('selector',None),('readback',None),('reply',None)]:
            boundary=next(x for x in events if x['stage']==stage and (not suffix or x['path'].endswith(suffix)))
            t=final_tests.FinalizationTests();t.setUp()
            try:
                request=self.prepare(t,kind);before=self.capture(t,kind+'-'+stage+'-before');trace=t.fx.root/'fault-trace.jsonl'
                code,response=t.call(request,extra={'LP_TX_FAIL':str(boundary['index']),'LP_TX_TRACE':str(trace)});self.assertEqual(code,3,response)
                actual=next(x for x in map(json.loads,trace.read_text().splitlines()) if x['index']==boundary['index']);self.assertEqual(actual['stage'],stage)
                fault=self.capture(t,kind+'-'+stage+'-fault');committed=stage in ('readback','reply')
                self.assertEqual(response['commit_state'],'committed_unknown' if committed else 'nonmutation')
                if committed:self.assertNotEqual(before['generation'],fault['generation'])
                else:self.assertEqual(self.identity(before),self.identity(fault))
                scope={'plan_uuid':t.plan['root_uuid'],'ticket_uuid':t.ticket['root_uuid'],'include_history':False}
                recovery=t.ok(t.call(t.request('recovery.inspect',dict(record_refs=[],checks=['publication inventory'],scope=scope))));t.refresh();self.assertEqual(t.plan['root_revision_uuid'],fault['generation'])
                replay=t.ok(t.call(request));after=self.capture(t,kind+'-'+stage+'-replay');repeat=t.ok(t.call(request));self.assertEqual(replay,repeat);final=self.capture(t,kind+'-'+stage+'-repeat');self.assertEqual(self.identity(after),self.identity(final))
                cases.append(dict(boundary=actual,before=before,fault=fault,response=response,recovery=recovery,replay=after,replay_response=replay,repeat=final,raw=t.raw))
            finally:t.tearDown()
        destination=os.environ.get('LP_A13_PHYSICAL')
        if destination:
            p=Path(destination)/(kind+'-faults.json');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(encode(dict(kind=kind,trace=events,cases=cases,limits='Real public subprocesses/local POSIX bytes and injected IO boundaries; saved fixture identities/authorization/ancestry facts do not prove a real remote Git operation.')))

    def test_integration_record_physical_recovery_replay(self):self.exercise('integration')
    def test_ticket_finalize_physical_recovery_replay(self):self.exercise('finalize')
    def test_release_check_physical_recovery_replay(self):self.exercise('release')


if __name__=='__main__':unittest.main()
