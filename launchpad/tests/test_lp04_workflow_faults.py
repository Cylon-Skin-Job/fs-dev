"""A12 workflow/checklist publication fsync/rename/reply faults, recovery and replay."""
import json
import os
import unittest
from pathlib import Path
import test_lp04_workflow as harness
from support import encode, file_hash, current, ref, uid
from core.store import digest


def build_request(t,kind):
    if kind=='apply':
        node=t.node('Shape');op=t.move_op(node,description='physical fault seam')
        preview=t.ok(t.call(t.preview([op])))
        return t.apply(preview['preview_digest'],[op])
    spec=t.approve_spec()
    checklist_cat=next(c['uuid'] for c in t.items if c['kind']=='category' and c['body']['category_key']=='checklist')
    content=next(x for x in t.items if x['kind']=='content' and x['body']['category_uuid']==checklist_cat)
    body=dict(target_kind='plan_entry',locator=spec['uuid'],source_checkout=None,source_ref=None,
              used_revision=spec['revision_uuid'],used_sha256=digest(spec),used_stamp=spec['last_updated'],supported_scope=[content['uuid']])
    op=dict(operation='record.create',args=dict(kind='reference',body=body,source_refs=[]))
    pin=dict(kind='owner_decision',locator=spec['uuid'],revision=spec['revision_uuid'],sha256=digest(spec),recorded_at=spec['last_updated'],native_ref=None)
    preview=t.ok(t.call(t.checklist_preview([op],[pin])))
    return t.request('checklist.reconcile_apply',dict(preview_digest=preview['preview_digest'],operations=[op],coverage_rows=[],authority_refs=[ref(t.fx.authority)]),key=uid())


class WorkflowFaultTests(unittest.TestCase):
    for _name in ('setUp','tearDown','call','ok','refresh','request','saved','publish','bind','runtime','dispatch',
                  'claim_request','claim','start_request','attempt','refuse','ready','expected_map','op_pins','preview',
                  'apply','node','move_op','checklist_preview','approve_spec','return_run','returned','scope',
                  'accept_request','two_gates'):
        locals()[_name]=getattr(harness.WorkflowTests,_name)

    def capture(self,t,label):
        t.refresh();prepared=t.fx.home/'.prepared'/(t.plan['root_revision_uuid']+'.json')
        value=json.loads(prepared.read_text());paths=[t.folder/'plan.json',prepared]+[t.folder/k for k in value['view_hashes']]
        root=next(x for x in current(t.plan) if x['kind']=='plan');paths += [t.fx.home/x['relative_path'] for x in root['body']['ticket_bindings']]
        rows=[dict(path=str(p),sha256=file_hash(p),bytes=p.stat().st_size) for p in paths]
        return dict(label=label,generation=t.plan['root_revision_uuid'],selector=os.readlink(t.fx.home/'CURRENT'),files=rows)

    def identity(self,cap):
        return cap['generation'],cap['selector'],[(x['path'],x['sha256']) for x in cap['files']]

    def exercise(self,kind):
        probe=harness.WorkflowTests();probe.setUp()
        try:
            req=build_request(probe,kind);trace=probe.fx.root/'trace.jsonl'
            probe.ok(probe.call(req,extra={'LP_TX_TRACE':str(trace)}));events=[json.loads(x) for x in trace.read_text().splitlines()]
        finally:probe.tearDown()
        selected=[('write_bytes','ticket.json'),('flush','plan.json'),('fsync_file','ticket.json'),('fsync_dir',None),
                  ('selector',None),('readback',None),('reply',None)]
        cases=[]
        for stage,suffix in selected:
            boundary=next(x for x in events if x['stage']==stage and (not suffix or x['path'].endswith(suffix)))
            t=harness.WorkflowTests();t.setUp()
            try:
                req=build_request(t,kind);before=self.capture(t,kind+'-'+stage+'-before')
                failed=t.fx.root/'fault-trace.jsonl'
                code,value=t.call(req,extra={'LP_TX_FAIL':str(boundary['index']),'LP_TX_TRACE':str(failed)})
                self.assertEqual(code,3,value)
                actual=next(x for x in map(json.loads,failed.read_text().splitlines()) if x['index']==boundary['index']);self.assertEqual(actual['stage'],stage)
                fault=self.capture(t,kind+'-'+stage+'-fault');committed=stage in ('readback','reply')
                self.assertEqual(value['commit_state'],'committed_unknown' if committed else 'nonmutation')
                if not committed:self.assertEqual(self.identity(before),self.identity(fault))
                else:self.assertNotEqual(before['generation'],fault['generation'])
                scope={'plan_uuid':t.plan['root_uuid'],'ticket_uuid':t.ticket['root_uuid'],'include_history':False}
                recovery=t.ok(t.call(t.request('recovery.inspect',dict(record_refs=[],checks=['publication inventory'],scope=scope))))
                t.refresh();self.assertEqual(t.plan['root_revision_uuid'],fault['generation'])
                response=t.ok(t.call(req));replay=self.capture(t,kind+'-'+stage+'-replay');again=t.ok(t.call(req));self.assertEqual(response,again)
                repeat=self.capture(t,kind+'-'+stage+'-repeat');self.assertEqual(self.identity(replay),self.identity(repeat))
                cases.append(dict(boundary=actual,before=before,fault=fault,recovery=recovery,response=value,replay=replay,replay_response=response,repeat=repeat,raw=t.raw))
            finally:t.tearDown()
        destination=os.environ.get('LP_A12_PHYSICAL')
        if destination:
            p=Path(destination)/(kind+'-faults.json');p.parent.mkdir(parents=True,exist_ok=True)
            p.write_bytes(encode(dict(kind=kind,trace=events,cases=cases,
                limits='Real local POSIX boundaries and public subprocesses; simulated IO failure is not hardware power loss or native runtime failure.')))

    def test_workflow_edit_physical_fault_recovery_and_replay(self):self.exercise('apply')
    def test_checklist_reconcile_physical_fault_recovery_and_replay(self):self.exercise('reconcile')


if __name__=='__main__':unittest.main()
