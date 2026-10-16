/* A13 finalization disclosures stay captured read-only presentation data. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});for(const file of ['model.js','view-state.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../assets',file),'utf8'),context);
const id=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
function fixture(){
 const root={uuid:id(1),revision_uuid:id(11),kind:'ticket',lifecycle:'live',body:{state:'finalized',current_workflow_node_uuid:id(2),finalization_ref:{entry_uuid:id(4),revision_uuid:id(14),sha256:'a'.repeat(64),scope_item_uuids:[]}}};
 const top={uuid:id(2),revision_uuid:id(12),kind:'workflow_node',lifecycle:'live',body:{title:'Commit',node_kind:'owner_gate',parent_uuid:null,order:16}};
 const integ={uuid:id(4),revision_uuid:id(14),kind:'integration',lifecycle:'live',body:{commit_sha:'a'.repeat(40),consumer_ref:'refs/heads/codex/build-workflow-and-tickets'}};
 const revision=[root,top,integ],snapshot={root_uuid:id(1),current:revision.map(x=>({entry_uuid:x.uuid,revision_uuid:x.revision_uuid})),revisions:revision};
 return context.LPModel.project({framework_uuid:id(10),plan_uuid:id(10),view_kind:'ticket',ticket_uuid:id(1),records:[],tickets:{[id(1)]:snapshot},
  workflow_disclosures:{[id(1)]:{card:{node_uuid:id(2),node_kind:'owner_gate',icon:'back_hand',color:'owner',title:'Commit',source:'explicit current top-level workflow node'},top_level:[id(2)],node_count:2}},
  finalization_disclosures:{[id(1)]:{state:'completed',completed:true,locked:false,unlocked:false,next_mode:null,commit_sha:'a'.repeat(40),consumer_ref:'refs/heads/codex/build-workflow-and-tickets'}}});}
test('model retains captured finalization state without inventing a next mode',()=>{const model=fixture(),ticket=model.tickets[0];
 assert.equal(ticket.finalization.state,'completed');assert.equal(ticket.finalization.completed,true);assert.equal(ticket.finalization.next_mode,null);
 assert.equal(ticket.workflow.card.icon,'back_hand');assert.equal(ticket.root.body.state,'finalized');});
test('view state round-trips while the ticket remains finalized',()=>{const model=fixture(),state=context.LPViewState.defaults(id(1));
 assert.equal(context.LPViewState.valid(state),true);assert.equal(context.LPViewState.reconcile(state,model).ticket_uuid,id(1));});
