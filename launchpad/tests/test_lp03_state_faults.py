"""Literal physical before/fault/replay evidence for new A09 publication paths."""
import json
import os
import unittest
from pathlib import Path
import test_lp03_state as state_tests
from support import encode,file_hash


class StateFaultTests(unittest.TestCase):
    def capture(self,t,label):
        t.refresh();prepared=t.fx.home/'.prepared'/(t.plan['root_revision_uuid']+'.json');files=[t.folder/'plan.json',prepared]+[t.folder/k for k in json.loads(prepared.read_text())['view_hashes']]+[t.fx.home/b['relative_path'] for x in t.plan['revisions'] if x['kind']=='plan' and x['uuid']==t.plan['root_uuid'] and any(c['revision_uuid']==x['revision_uuid'] for c in t.plan['current']) for b in x['body']['ticket_bindings']]
        files += [p for home in (t.fx.root/'.evidence',t.fx.sources) for p in sorted(home.rglob('*')) if p.is_file()]
        saved=[];destination=os.environ.get('LP_A09_PHYSICAL')
        for i,p in enumerate(files):
            data=p.read_bytes();q=Path(destination)/label/(str(i)+'-'+p.name) if destination else None
            if q:q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(data)
            saved.append(dict(path=str(p),retained_path=str(q) if q else None,bytes=len(data),sha256=file_hash(p)))
        inventory=[]
        known=getattr(t,'physical_baseline',set())
        paths=[p for p in t.fx.home.rglob('*') if p.is_file() and not p.is_symlink() and any(part in ('.revisions','.prepared') for part in p.parts)]
        if label.endswith('-before'):t.physical_baseline={str(p) for p in paths};known=t.physical_baseline
        for p in paths:
            inventory.append(dict(path=str(p),bytes=p.stat().st_size,sha256=file_hash(p)))
            if str(p) not in known and destination:
                q=Path(destination)/'new-physical-bytes'/file_hash(p);q.parent.mkdir(parents=True,exist_ok=True)
                if not q.exists():q.write_bytes(p.read_bytes())
                inventory[-1]['retained_path']=str(q)
        return dict(generation=t.plan['root_revision_uuid'],selector=os.readlink(t.fx.home/'CURRENT'),files=saved,physical_inventory=inventory)

    def identity(self,value):return {k:v for k,v in {**value,'files':[{k:v for k,v in x.items() if k!='retained_path'} for x in value['files']]}.items() if k!='physical_inventory'}

    def exercise(self,kind):
        t=state_tests.StateTests();t.setUp();proof=[]
        try:
            actor=t.fx.actor
            def make():
                if kind=='state':return t.check(actor)
                main,child,assignment,target,report,args=t.support_packet()
                if kind=='support-submit':return t.request('support.report_submit',args,child)
                t.ok(t.call(t.request('support.report_submit',args,child)));_,gate,raw,integrate=t.reviewed(main,assignment,target,report,args)
                return t.request('support.integrate',integrate,main)
            request=make();trace=t.fx.root/'trace.jsonl';t.ok(t.call(request,extra={'LP_TX_TRACE':str(trace)}));events=[json.loads(x) for x in trace.read_text().splitlines()]
            stages=[('write_bytes','plan.json'),('selector',None),('readback',None),('reply',None)]
            if kind=='support-integrate':stages.insert(0,('write_bytes','ticket.json'))
            for index,(stage,name) in enumerate(stages):
                request=make();boundary=next(x for x in events if x['stage']==stage and (name is None or x['path'].endswith(name)))
                before=self.capture(t,kind+'-'+str(index)+'-before');code,value=t.call(request,extra={'LP_TX_FAIL':str(boundary['index'])});self.assertEqual(code,3,value);fault=self.capture(t,kind+'-'+str(index)+'-fault');committed=stage in ('readback','reply');self.assertEqual(value['commit_state'],'committed_unknown' if committed else 'nonmutation');self.assertEqual(before['generation']==fault['generation'],not committed)
                receipt=t.ok(t.call(request));replay=self.capture(t,kind+'-'+str(index)+'-replay');again=t.ok(t.call(request));self.assertEqual(again,receipt);final=self.capture(t,kind+'-'+str(index)+'-repeat');self.assertEqual(self.identity(replay),self.identity(final))
                if not committed:self.assertEqual(self.identity(before),self.identity(fault))
                proof.append(dict(boundary=boundary,original_response=value,replay_response=receipt,before=before,fault=fault,replay=replay,repeat=final))
            destination=os.environ.get('LP_A09_PHYSICAL')
            if destination:
                p=Path(destination)/(kind+'-physical.json');p.write_bytes(encode(dict(kind=kind,trace=events,cases=proof,raw=t.raw,limits='Local POSIX public-process injected failures; not hardware power loss')))
        finally:t.tearDown()

    def test_state_check_real_public_faults(self):self.exercise('state')
    def test_support_submit_real_public_faults(self):self.exercise('support-submit')
    def test_support_integrate_real_public_faults(self):self.exercise('support-integrate')

if __name__=='__main__':unittest.main()
