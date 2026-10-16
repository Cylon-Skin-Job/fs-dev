"""A11 release/invalidation/result writes through actual physical fault seams."""
import json
import os
import unittest
from pathlib import Path
import test_lp04_claim_faults as prior
import test_lp04_acceptance as acceptance_tests
from support import ref,encode,file_hash
from core.store import digest


class AcceptanceFaultTests(unittest.TestCase):
    identity=prior.ClaimFaultTests.identity

    def capture(self,t,label):
        # Reuse physical ownership/readback, extending retained literal external
        # source envelopes so no proof disappears with the disposable test root.
        previous=os.environ.get('LP_A10_PHYSICAL');destination=os.environ.get('LP_A11_PHYSICAL')
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
        job,actor,attempt,outputs=t.returned();pins=t.scope(attempt)
        if kind=='review':return t.prepare_evaluation(pins,'builder',1)[0]
        gates=t.two_gates(pins)
        if kind=='acceptance':return t.accept_request(pins,gates)
        t.ok(t.call(t.accept_request(pins,gates)));output=outputs[0]
        return t.request('record.update',dict(uuid=output['uuid'],body={**output['body'],'content':{'normative':'changed subject'}},source_refs=output['source_refs']))

    def exercise(self,kind):
        probe=acceptance_tests.AcceptanceTests();probe.setUp()
        try:
            request=self.prepare(probe,kind);trace=probe.fx.root/'trace.jsonl';probe.ok(probe.call(request,extra={'LP_TX_TRACE':str(trace)}));events=[json.loads(x) for x in trace.read_text().splitlines()]
        finally:probe.tearDown()
        cases=[]
        for stage,suffix in [('write_bytes','ticket.json'),('flush','plan.json'),('fsync_file','ticket.json'),('fsync_dir',None),('selector',None),('readback',None),('reply',None)]:
            boundary=next(x for x in events if x['stage']==stage and (not suffix or x['path'].endswith(suffix)))
            t=acceptance_tests.AcceptanceTests();t.setUp()
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
        destination=os.environ.get('LP_A11_PHYSICAL')
        if destination:
            p=Path(destination)/(kind+'-faults.json');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(encode(dict(kind=kind,trace=events,cases=cases,limits='Real public subprocesses/local POSIX bytes and injected IO boundaries; saved fixture gates/identities do not prove native lifecycle or hardware power loss.')))

    def test_acceptance_release_physical_recovery_replay(self):self.exercise('acceptance')
    def test_normative_invalidation_physical_recovery_replay(self):self.exercise('invalidation')
    def test_independent_review_result_physical_recovery_replay(self):self.exercise('review')


if __name__=='__main__':unittest.main()
