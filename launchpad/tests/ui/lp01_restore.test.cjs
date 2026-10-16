const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../assets/view-state.js'),'utf8'),sandbox);const S=sandbox.LPViewState;
const id=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){const records=[{uuid:id(2),kind:'ticket',body:{}},{uuid:id(3),kind:'category',body:{}},{uuid:id(4),revision_uuid:id(14),kind:'content',body:{category_uuid:id(3)}}];
 return {framework_uuid:id(1),plan_uuid:id(1),view_kind:'plan',ticket_uuid:null,tickets:[{root:records[0],records,snapshot:{revisions:records}}]};}
test('strict presentation shape retains false/true, pins, independent offsets and focus',()=>{
 const state=clone(S.defaults(id(2)));state.expanded[id(3)]=false;state.expanded[id(4)]=true;state.scroll.containers['workflow:'+id(2)]={x:3,y:90};state.scroll.main={x:4,y:80};
 state.modal={ticket_uuid:id(2),target_uuid:id(4),mode:'content',selector:'pinned',revision_uuid:id(14),return_focus:null};state.focus={ticket_uuid:id(2),target_uuid:id(4),role:'content'};
 assert.equal(S.valid(state),true);const key=S.open(fixture(),()=>({getItem:()=>JSON.stringify(state)}),()=>{});assert.deepEqual(clone(key.get()),state);
 for(const mutate of [x=>x.version=2,x=>x.canonical='forbidden',x=>x.expanded[id(3)]='false',x=>x.scroll.main.y=-1,x=>x.focus.target_uuid='not-uuid',x=>x.modal.revision_uuid=null]){const invalid=clone(state);mutate(invalid);assert.equal(S.valid(invalid),false);}
});
test('latest model removes missing targets but retains historical pin and containing section',()=>{
 const model=fixture(),state=clone(S.defaults(id(2)));state.section_uuid=id(3);state.selection_path=[id(4),id(3)];state.expanded[id(3)]=false;state.expanded[id(4)]=true;
 state.focus={ticket_uuid:id(2),target_uuid:id(4),role:'content'};state.modal={ticket_uuid:id(2),target_uuid:id(4),mode:'content',selector:'pinned',revision_uuid:id(14),return_focus:null};
 model.tickets[0].records=model.tickets[0].records.filter(x=>x.uuid!==id(4));model.tickets[0].records.push({uuid:id(5),kind:'workflow_node',body:{parent_uuid:null}});
 const current=clone(S.reconcile(state,model));assert.equal(current.modal.revision_uuid,id(14));assert.equal(current.focus.target_uuid,id(3));assert.equal(current.focus.role,'name');assert.equal(current.expanded[id(3)],false);assert.equal(Object.hasOwn(current.expanded,id(5)),false);
 state.modal.selector='current';state.modal.revision_uuid=null;assert.equal(S.reconcile(state,model).modal,null);
 model.tickets=[];assert.equal(S.reconcile(state,model).ticket_uuid,null);
});
test('denied, corrupt, schema-invalid and quota storage preserve ordinary defaults with one notice',()=>{
 for(const value of ['{broken',JSON.stringify({version:1}),null]){const notices=[];const storage={getItem(){if(value===null)throw Error('denied');return value;},setItem(){throw Error('quota');}};
 const controller=S.open(fixture(),()=>storage,x=>notices.push(x));assert.equal(controller.get().ticket_uuid,null);controller.set(controller.get());assert.equal(notices.length,1);assert.match(notices[0],/Read-only content remains available/);}
 const notices=[],controller=S.open(fixture(),()=>({getItem:()=>null,setItem(){throw Error('quota');}}),x=>notices.push(x));controller.set(controller.get());controller.set(controller.get());assert.equal(notices.length,1);assert.match(notices[0],/quota/);
});
test('identity includes framework plan view and version; fresh defaults use supplied ticket alias',()=>{
 const model=fixture();model.view_kind='ticket';model.ticket_uuid=id(2);const controller=S.open(model,()=>({getItem:()=>null}),()=>{});
 assert.deepEqual(JSON.parse(controller.key),{framework_uuid:id(1),plan_uuid:id(1),view_kind:'ticket',version:1});assert.equal(controller.get().ticket_uuid,id(2));
 assert.deepEqual(clone(S.path(model.tickets[0],id(4))),[id(4),id(3)]);
});
test('child aliases bind their embedded ticket while plan views retain selected ticket',()=>{
 const model=fixture(),state=clone(S.defaults(id(2)));model.tickets.push({root:{uuid:id(6)},records:[{uuid:id(6),kind:'ticket',body:{}}],snapshot:{revisions:[]}});
 state.section_uuid=id(3);state.selection_path=[id(4),id(3)];state.scroll.main={x:4,y:90};state.expanded[id(3)]=false;
 state.modal={ticket_uuid:id(2),target_uuid:id(4),mode:'content',selector:'current',revision_uuid:null,return_focus:null};state.focus={ticket_uuid:id(2),target_uuid:id(4),role:'content'};
 assert.equal(S.reconcile(state,model).ticket_uuid,id(2));model.view_kind='ticket';model.ticket_uuid=id(6);
 const bound=clone(S.reconcile(state,model));assert.equal(bound.ticket_uuid,id(6));assert.equal(bound.section_uuid,null);assert.deepEqual(bound.selection_path,[]);assert.equal(bound.modal,null);assert.equal(bound.focus,null);assert.deepEqual(bound.scroll.main,{x:0,y:0});assert.equal(bound.expanded[id(3)],false);
 state.ticket_uuid=id(6);assert.equal(S.reconcile(state,model).modal,null);assert.equal(S.reconcile(state,model).focus,null);
});
