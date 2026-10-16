/* Current lifecycle exclusion and retained-pin restoration from real envelope shapes. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const c=vm.createContext({});for(const file of ['model.js','view-state.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../assets',file),'utf8'),c);
const samples=JSON.parse(fs.readFileSync(path.join(__dirname,'../../assets/schema/conformance.samples.json'))).shape_cases;
const original=samples.find(x=>x.name==='WA003-live-original').value,deleted=samples.find(x=>x.name==='WA003-same-kind-deleted-tombstone').value;
const ticket='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',category=original.body.category_uuid;
const categoryRecord={...original,uuid:category,revision_uuid:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',kind:'category',body:{title:'Capture',parent_uuid:null}};
const root={...original,uuid:ticket,revision_uuid:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',kind:'ticket',body:{number:1}};
const snapshot={current:[root,categoryRecord,deleted].map(x=>({entry_uuid:x.uuid,revision_uuid:x.revision_uuid})),revisions:[root,categoryRecord,deleted,original]};
const data={tickets:{[ticket]:snapshot},records:[],ticket_uuid:ticket,view_kind:'ticket'};
test('deleted current hides from tree while exact retained pin remains restorable',()=>{const model=c.LPModel.project(data),state=c.LPViewState.defaults(ticket);assert.equal(model.tickets[0].records.some(x=>x.uuid===original.uuid),false);
 state.section_uuid=category;state.selection_path=[original.uuid,category];state.modal={ticket_uuid:ticket,target_uuid:original.uuid,mode:'content',selector:'pinned',revision_uuid:original.revision_uuid,return_focus:null};
 const pinned=c.LPViewState.reconcile(state,model);assert.equal(pinned.modal.revision_uuid,original.revision_uuid);assert.equal(pinned.section_uuid,category);
 state.modal.selector='current';state.modal.revision_uuid=null;const current=c.LPViewState.reconcile(state,model);assert.equal(current.modal,null);assert.equal(current.focus.target_uuid,category);
});
