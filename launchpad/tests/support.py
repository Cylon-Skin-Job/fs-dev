"""Real-filesystem, public-subprocess LP-01 fixtures."""
import json
import subprocess
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from core.store import uid, now, envelope, ref, encode, file_hash, load, current, read_generation, NIL
from core.seed import TEMPLATE

CHECKOUT=Path(__file__).resolve().parents[2]
CLI=CHECKOUT/'launchpad/tools/ticket_cli.py'


class Fixture:
    def __init__(self,root,plan_folder='sample'):
        self.root=Path(root).resolve();self.root.mkdir(exist_ok=True)
        self.sources=self.root/'sources';self.sources.mkdir(exist_ok=True)
        self.plan_id=uid();self.actor_id=uid();self.plan_folder=plan_folder;self.home=self.root/'work-tickets'/plan_folder
        self.writer=dict(actor_uuid=self.actor_id,runtime_kind='ephemeral',runtime_id=None,parent_actor_uuid=None)
        self.authority=self.save(envelope('content',dict(title='Owner test assignment',category_uuid=uid(),format='plain',content='Explicit disposable LP-01 fixture',authority='owner_decision',state='active',item_uuids=[]),self.writer))
        self.binding=self.save(envelope('content',dict(title='Actual host evidence',category_uuid=uid(),format='json',content={'actual_cwd':str(CHECKOUT),'permissions':'danger-full-access','runtime_kind':'ephemeral'},authority='active_code_constraint',state='active',item_uuids=[]),self.writer))
        assignment=envelope('assignment',dict(ticket_uuid=uid(),node_uuid=uid(),work_kind='slice',manager_uuid=self.actor_id,
            role='plan-seed-manager',eligible_actor_uuid=self.actor_id,write_paths=[str(self.home)],report_path=str(self.root/'report'),
            source_refs=[],procedure_path=str(CLI),procedure_sha256=file_hash(CLI),interface_version=1,source_checkout=str(self.sources),
            source_branch='disposable',source_head='fixture',prerequisite_refs=[],return_criteria=['A01'],authority_ref=ref(self.authority)),self.writer)
        self.assignment=self.save(assignment)
        actor=envelope('actor',dict(role='plan-seed-manager',runtime_kind='ephemeral',runtime_id=None,host_id=None,parent_actor_uuid=None,
            actual_cwd=str(CHECKOUT),binding_evidence_ref=ref(self.binding),assignment_refs=[ref(assignment)],
            granted_operations=['plan.create','ticket.create','ticket.seed_apply','seed.edit_preview'],state='active'),self.writer,entry=self.actor_id)
        self.actor=self.save(actor)
        self.tracks=[dict(uuid=uid(),title='Branch '+str(i+1),order=i) for i in range(4)]

    def save(self,item):
        path=self.root/'.evidence'/(item['revision_uuid']+'.json');path.parent.mkdir(exist_ok=True)
        path.write_bytes(encode(item));return item

    def request(self,op,args,key='request'):
        tool='db.mutate' if op in ('plan.create','ticket.create','ticket.seed_apply') else 'db.context' if op=='seed.edit_preview' else 'db.catalog' if op=='catalog.list' else 'db.describe' if op.endswith('describe') else 'db.get'
        value=dict(interface_version=1,tool=tool,operation=op,args=args,scope={'plan_uuid':self.plan_id,'include_history':False},actor_binding_ref=ref(self.actor))
        if tool=='db.mutate':
            if op=='plan.create':generation=NIL;expected={}
            else:
                plan,_,_=read_generation(self.home);generation=plan['root_revision_uuid'];expected={self.plan_id:next(x for x in current(plan) if x['kind']=='plan')['revision_uuid']}
            value.update(idempotency_key=key,expected=expected,expected_plan_revision_uuid=generation)
        return value

    def run(self,request):
        path=self.root/('request-'+uid()+'.json');path.write_text(json.dumps(request))
        result=subprocess.run([sys.executable,str(CLI),'--framework',str(self.root),'--request',str(path)],cwd=CHECKOUT,capture_output=True,text=True)
        if not result.stdout:raise AssertionError(result.stderr)
        return result.returncode,json.loads(result.stdout)

    def create(self,title='32-record source/sample'):
        req=self.request('plan.create',dict(title=title,plan_folder=self.plan_folder,tracks=self.tracks,
                         bootstrap_evidence_refs=[ref(self.assignment),ref(self.authority),ref(self.binding)]),'plan')
        return self.run(req)

    def seed(self,title='Example',content='Initial owner scope',scope=None,todo=None,track=0):
        path=self.sources/(uid()+'.txt');path.write_text(content)
        pin=dict(kind='source_of_truth_contract',locator=str(path),revision='source/1',sha256=file_hash(path),recorded_at=now(),native_ref=None)
        source=self.save(envelope('content',dict(title=title,category_uuid=uid(),format='plain',content=content,
                    authority='source_of_truth_contract',state='active',item_uuids=[]),self.writer,[pin]))
        args=dict(template_revision=file_hash(TEMPLATE),seed_ref=ref(source),title=title,ticket_folder='ticket-'+uid(),track_uuid=self.tracks[track]['uuid'],
                  scope_items=[dict(source=ref(source),text=x,source_alias='scope-'+str(i)) for i,x in enumerate(scope or ['Retain initial scope'])],
                  checklist_items=[dict(source=ref(source),text=x,source_alias='todo-'+str(i)) for i,x in enumerate(todo or ['Discuss readiness'])])
        return self.request('ticket.create',args,uid())
