/* Pure projection from immutable envelopes; no native, storage or DOM access. */
globalThis.LPModel = (() => {
  function records(snapshot) {
    const byRevision = new Map(snapshot.revisions.map(x => [x.revision_uuid, x]));
    return snapshot.current.map(x => byRevision.get(x.revision_uuid));
  }
  function lineage(all, uuid) {
    const subject=all.find(x=>x.uuid===uuid), edges=all.filter(x=>x.kind==='edge'&&x.lifecycle==='live'&&x.body.edge_kind==='supersedes');
    const outgoing=edges.filter(x=>x.body.from_uuid===uuid),incoming=edges.filter(x=>x.body.to_uuid===uuid),ids=subject?.body.item_uuids||[];
    const covered=new Set(outgoing.flatMap(x=>x.body.scope_item_uuids)),full=outgoing.length>0&&(outgoing.some(x=>!x.body.scope_item_uuids.length)||(ids.length>0&&ids.every(x=>covered.has(x))));
    return {fully_superseded:full,residual_item_uuids:full?[]:ids.filter(x=>!covered.has(x)),superseded_by:outgoing.map(x=>({replacement_uuid:x.body.to_uuid,scope_item_uuids:x.body.scope_item_uuids})),supersedes:incoming.map(x=>({source_uuid:x.body.from_uuid,scope_item_uuids:x.body.scope_item_uuids}))};
  }
  function ticket(snapshot, sources={}, coverage={}, approvals={}, discussions={}, runs={}, gates={}, workflow={}, prompts={}, finalization={}) {
    const all = records(snapshot);
    const lineageById=Object.fromEntries(all.map(x=>[x.uuid,lineage(all,x.uuid)]));
    return {root: all.find(x => x.kind === 'ticket'), records: all.filter(x => x.lifecycle === 'live'&&!lineageById[x.uuid].fully_superseded), snapshot, sources, coverage, approvals, discussions, runs, gates, workflow, prompts, finalization, lineage:lineageById};
  }
  function project(data) {
    const tickets = Object.values(data.tickets).map(x=>ticket(x,data.source_disclosures?.[x.root_uuid]||{},data.coverage_disclosures?.[x.root_uuid]||{},data.approval_disclosures?.[x.root_uuid]||{},data.discussion_disclosures?.[x.root_uuid]||{},data.run_disclosures?.[x.root_uuid]||{},data.gate_disclosures?.[x.root_uuid]||{},data.workflow_disclosures?.[x.root_uuid]||{},data.prompt_disclosures?.[x.root_uuid]||{},data.finalization_disclosures?.[x.root_uuid]||{})).sort((a,b) => a.root.body.number - b.root.body.number);
    const placements = data.records.filter(x => x.kind === 'content' && x.body.title === 'Ticket placement').map(x => x.body.content);
    return {...data, tickets, placements};
  }
  function sourceInspection(record,ticket,selector) {
    const status=ticket?.sources?.[record.uuid],current=records(ticket.snapshot).find(x=>x.uuid===record.uuid);
    if(selector==='pinned'&&current?.revision_uuid!==record.revision_uuid)return {record,pinned_source_status:{freshness:'unverified',reason:'Freshness for this exact retained reference was not captured in this view. Its source-used version is retained below.'},current_reference_status:{reference_revision_uuid:current?.revision_uuid||null,...status},observation_scope:'Current-reference status belongs to the separately named current revision; it does not certify the pinned binding.'};
    return {record,source_status:status,observation_scope:'Captured at view generation; manual refresh requires a newly published view to update external metadata'};
  }
  return {records, ticket, project, sourceInspection};
})();
