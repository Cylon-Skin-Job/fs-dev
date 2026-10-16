/* A12 card/prompt disclosures stay captured read-only presentation data. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});for(const file of ['model.js','view-state.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../assets',file),'utf8'),context);
const id=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
function fixture(){
 const root={uuid:id(1),revision_uuid:id(11),kind:'ticket',lifecycle:'live',body:{state:'seed',current_workflow_node_uuid:id(2)}};
 const top={uuid:id(2),revision_uuid:id(12),kind:'workflow_node',lifecycle:'live',body:{title:'Intake Capture',node_kind:'conversation',parent_uuid:null,order:0}};
 const child={uuid:id(3),revision_uuid:id(13),kind:'workflow_node',lifecycle:'live',body:{title:'Closing Checkpoint',node_kind:'checkpoint',parent_uuid:id(2),order:1}};
 const revision=[root,top,child],snapshot={root_uuid:id(1),current:revision.map(x=>({entry_uuid:x.uuid,revision_uuid:x.revision_uuid})),revisions:revision};
 return context.LPModel.project({framework_uuid:id(10),plan_uuid:id(10),view_kind:'ticket',ticket_uuid:id(1),records:[],tickets:{[id(1)]:snapshot},
  workflow_disclosures:{[id(1)]:{card:{node_uuid:id(2),node_kind:'conversation',icon:'chat_display',color:'neutral',title:'Intake Capture',source:'explicit current top-level workflow node'},top_level:[id(2)],node_count:2}},
  prompt_disclosures:{[id(1)]:{[id(2)]:{template:{kind:'template',inert:true,executed:false},supplied:null,acknowledged:null,provider_label:{unknown_provider:true}}}}});}
test('model retains captured workflow card and prompt disclosures without deriving child icons',()=>{const model=fixture(),ticket=model.tickets[0];
 assert.equal(ticket.workflow.card.icon,'chat_display');assert.equal(ticket.workflow.card.node_kind,'conversation');
 assert.equal(ticket.prompts[id(2)].template.inert,true);assert.equal(ticket.prompts[id(2)].provider_label.unknown_provider,true);
 assert.equal(ticket.records.filter(x=>x.kind==='workflow_node').length,2);});
test('view state round-trips a prompt-modal pin/current selection',()=>{const model=fixture(),state=context.LPViewState.defaults(id(1));
 state.modal={ticket_uuid:id(1),target_uuid:id(2),mode:'definition',selector:'current',revision_uuid:null,return_focus:null};
 assert.equal(context.LPViewState.valid(state),true);assert.equal(context.LPViewState.reconcile(state,model).modal.mode,'definition');
 state.modal.selector='pinned';state.modal.revision_uuid=id(12);assert.equal(context.LPViewState.reconcile(state,model).modal.revision_uuid,id(12));});
