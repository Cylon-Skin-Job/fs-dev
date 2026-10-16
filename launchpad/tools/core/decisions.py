"""Own pending interpretations and exact evidenced presented approvals."""
import copy
from .schema import fail, current, validate, schema, record
from .store import ref, digest, envelope, uid, now
from . import authorization, seed

OPERATIONS={'decision.record','decision.present_batch','decision.approve_batch'}


def requires_presentation(item,items,history=None,scope=None):
    """Exact interpretation lineage survives supported scoped transformations."""
    if item['kind']!='content':return False
    retained=(history or [])+items
    categories={x['uuid'] for x in retained if x['kind']=='category' and x['body']['category_key']=='decisions'}
    protected={x['uuid']:None for x in retained if x['kind']=='content' and x['body']['authority'] in ('proposal','implementation_choice') and x['body']['category_uuid'] in categories}
    edges=[x['body'] for x in retained if x['kind']=='edge' and x['body']['edge_kind'] in ('derived_from','supersedes')]
    changed=True
    while changed:
        changed=False
        for edge in edges:
            child,parent=(edge['from_uuid'],edge['to_uuid']) if edge['edge_kind']=='derived_from' else (edge['to_uuid'],edge['from_uuid'])
            if parent not in protected:continue
            inherited=protected[parent];declared=set(edge['scope_item_uuids'])
            carried=declared if inherited is None and declared else inherited if not declared else inherited & declared
            if carried==set():continue
            if child not in protected:protected[child]=carried;changed=True
            elif protected[child] is not None:
                combined=None if carried is None else protected[child]|carried
                if combined!=protected[child]:protected[child]=combined;changed=True
    return item['uuid'] in protected and (protected[item['uuid']] is None or not scope or bool(protected[item['uuid']] & set(scope)))



def presented_provenance(acceptance,items,history=None):
    """Only the protected named batch producer can confer interpretation approval."""
    retained=(history or [])+items
    for batch in retained:
        if batch['kind']!='presented_batch' or batch['body']['state']!='accepted':continue
        pin=batch['body']['acceptance_ref']
        original=next((x for x in retained if x['kind']=='acceptance' and ref(x)==pin),None)
        if not original or original['uuid']!=acceptance['uuid'] or original['body']['subject_refs']!=acceptance['body']['subject_refs'] or original['body']['original_instruction_ref']!=acceptance['body']['original_instruction_ref']:continue
        accepted={x['entry_uuid'] for x in original['body']['subject_refs']}
        if [x for x in batch['body']['entry_refs'] if x['entry_uuid'] in accepted]==original['body']['subject_refs']:return True
    return False


def subjects(root,plan,tickets,pins,expected,items):
    if not pins or len({x['entry_uuid'] for x in pins})!=len(pins):fail('Exact nonempty unique presented subject scope required','MISSING_EVIDENCE')
    selected={x['uuid']:x for x in items};out=[]
    for pin in pins:
        bare={**pin,'scope_item_uuids':[]};item=authorization.dependency(root,plan,tickets,bare,expected)
        if item['uuid'] not in selected or item['kind']!='content' or ref(selected[item['uuid']])!=bare:fail('Presented subject must be current selected content','REVISION_CONFLICT')
        scope=pin['scope_item_uuids']
        if len(scope)!=len(set(scope)) or set(scope)-set(item['body']['item_uuids']):fail('Invalid presented item scope')
        out.append(item)
    return out


def gate(root,plan,tickets,pins,subject_refs,subject_digest,expected,actor,entries):
    if not pins:fail('Independent current-byte review required','MISSING_EVIDENCE')
    for pin in pins:
        review=authorization.dependency(root,plan,tickets,pin,expected);b=review['body']
        if review['kind']!='review' or b['verdict']!='pass' or b['finding_refs'] or b['subject_refs']!=subject_refs or b['subject_digest']!=subject_digest:fail('Review must cover exact presented accepted revisions','MISSING_EVIDENCE')
        if b['reviewer_actor_uuid'] in {actor['uuid']}|{x['writer']['actor_uuid'] for x in entries} or review['writer']['actor_uuid']!=b['reviewer_actor_uuid']:fail('Review must be independent of producer and recorder','FORBIDDEN')
        if not b['evidence_refs']:fail('Review evidence required','MISSING_EVIDENCE')
        for evidence in b['evidence_refs']+[b['report_ref']]:authorization.dependency(root,plan,tickets,evidence,expected)


def apply(root,op,args,actor,assignment,plan,tickets,items,expected):
    from .records import sources
    w=seed.writer(actor)
    if op=='decision.record':
        body=copy.deepcopy(args['body']);validate(body,schema('record.schema.json')['$defs']['content'])
        if body['item_uuids']!=args['item_uuids']:fail('Decision items differ from explicit body')
        # Supporting Wiki/source evidence never confers owner direction.
        if body['authority']=='owner_decision':
            authorization.authority(root,plan,tickets,assignment['body']['authority_ref'],assignment,expected)
            original=[]
            for pin in args['source_refs']:
                if pin['kind']!='owner_decision':continue
                from pathlib import Path
                from .store import load, evidence
                path=Path(pin['locator'])
                if path!=Path(root)/'.evidence'/(str(pin['revision'])+'.json'):fail('Original instruction must use exact saved evidence locator','SOURCE_UNVERIFIED')
                instruction=load(path);record(instruction)
                instruction=evidence(root,dict(entry_uuid=instruction['uuid'],revision_uuid=pin['revision'],sha256=pin['sha256'],scope_item_uuids=[]))
                authorization.dependency(root,plan,tickets,ref(instruction),expected)
                if instruction['kind']=='content' and instruction['body']['authority']=='owner_decision' and instruction['body']['state']=='active' and instruction['body']['content']==body['content'] and instruction['body']['item_uuids']==body['item_uuids']:original.append(instruction)
            if body['state']!='active' or len(original)!=1:fail('Direct decision must retain exact original owned instruction content/items','FORBIDDEN')
        elif body['authority'] not in ('proposal','implementation_choice') or body['state']!='pending':fail('Interpretation remains pending until scoped owner approval','FORBIDDEN')
        category=next((x for x in items if x['uuid']==body['category_uuid'] and x['kind']=='category'),None)
        if not category or category['body']['category_key']!='decisions':fail('Interpretation belongs in Decisions category','FORBIDDEN')
        sources(root,assignment,args['source_refs'])
        item=envelope('content',body,w,args['source_refs']);items.append(item);return item
    authority=authorization.authority(root,plan,tickets,assignment['body']['authority_ref'],assignment,expected)
    if op=='decision.present_batch':
        if args['authority_ref']!=ref(authority):fail('Assigned presentation authority required','FORBIDDEN')
        body=copy.deepcopy(args['body'])
        if body['state']!='pending' or body['acceptance_ref'] is not None:fail('Presentation cannot confer acceptance','FORBIDDEN')
        subjects(root,plan,tickets,body['entry_refs'],expected,items)
        if body['batch_digest']!=digest(body['entry_refs']):fail('Ordered presented batch digest differs','SOURCE_UNVERIFIED')
        proof=authorization.dependency(root,plan,tickets,body['presentation_evidence_ref'],expected)
        if proof['kind']!='content' or proof['body']['content']!=dict(entry_refs=body['entry_refs'],batch_digest=body['batch_digest']):fail('Presentation evidence must save exact reviewed display scope','MISSING_EVIDENCE')
        item=envelope('presented_batch',body,w);items.append(item);return item
    batch=authorization.dependency(root,plan,tickets,args['presented_batch_ref'],expected)
    local=next((x for x in items if x['uuid']==batch['uuid']),None)
    if batch['kind']!='presented_batch' or batch!=local or batch['body']['state']!='pending':fail('Current pending presented batch required','INVALID_TRANSITION')
    scope=args['accepted_scope'];pins=[x for x in batch['body']['entry_refs'] if x['entry_uuid'] in scope]
    if not scope or len(scope)!=len(set(scope)) or set(scope)!={x['entry_uuid'] for x in pins}:fail('Approval scope must be explicit subset of presented entries','FORBIDDEN')
    entries=subjects(root,plan,tickets,pins,expected,items)
    instruction=authorization.dependency(root,plan,tickets,args['original_instruction_ref'],expected)
    ib=instruction['body'];proof=ib.get('content')
    if instruction['kind']!='content' or ib['authority']!='owner_decision' or ib['state']!='active' or not isinstance(proof,dict) or set(proof)!={'kind','presented_batch_ref','accepted_scope','gate_refs'} or proof['kind']!='approve_presented_batch' or proof['presented_batch_ref']!=args['presented_batch_ref'] or proof['accepted_scope']!=scope:fail('Original owner instruction must name exact batch and accepted scope','FORBIDDEN')
    validate(proof['gate_refs'],{'type':'array','minItems':1,'items':{'$ref':'record.schema.json#/$defs/ref'}})
    for pin in proof['gate_refs']:validate(pin,schema('record.schema.json')['$defs']['ref'])
    gate(root,plan,tickets,proof['gate_refs'],pins,digest(pins),expected,actor,entries)
    acceptance=envelope('acceptance',dict(subject_refs=pins,subject_digest=digest(pins),accepting_actor_uuid=actor['uuid'],authority_ref=ref(authority),gate_refs=proof['gate_refs'],original_instruction_ref=ref(instruction),state='active',invalidation_reason=None),w)
    items.append(acceptance)
    result=copy.deepcopy(batch);result.update(revision_uuid=uid(),last_updated=now(),writer=w)
    result['body'].update(state='accepted',acceptance_ref=ref(acceptance));record(result);items[items.index(local)]=result
    return result


def projection(items,history=None):
    """Retain only exact unchanged scoped approvals, never revive a whole gate."""
    from .relations import replacement
    receipts=[x for x in items if x['kind']=='acceptance' and (x['body']['state']=='active' or x['body']['invalidation_reason']=='Subject revision changed')]
    by_id={x['uuid']:x for x in items};accepted={}
    for acceptance in receipts:
        for pin in acceptance['body']['subject_refs']:
            item=by_id.get(pin['entry_uuid'])
            if item and requires_presentation(item,items,history,pin['scope_item_uuids']) and not presented_provenance(acceptance,items,history):continue
            if not item or item['lifecycle']!='live' or ref(item)!={**pin,'scope_item_uuids':[]}:continue
            links=replacement(items,item['uuid'])
            if links['fully_superseded']:continue
            applicable=[key for key in (pin['scope_item_uuids'] or item['body'].get('item_uuids',[])) if key in links['residual_item_uuids']]
            if item['body'].get('item_uuids') and not applicable:continue
            prior=accepted.get(item['uuid'],{});granted=sorted(set(prior.get('applicable_item_uuids',[]))|set(applicable))
            uncovered=[key for key in links['residual_item_uuids'] if key not in granted]
            accepted[item['uuid']]=dict(state='partially_accepted' if uncovered else 'accepted',acceptance_ref=ref(acceptance),receipt_state=acceptance['body']['state'],subject_ref=pin,subject_refs=prior.get('subject_refs',[])+[pin],acceptance_refs=prior.get('acceptance_refs',[])+[ref(acceptance)],applicable_item_uuids=granted,uncovered_item_uuids=uncovered,scope_applicability='Exact unchanged accepted revision/scope; whole invalidated receipt is not revived')
    categories={x['uuid']:x['body'].get('category_key') for x in items if x['kind']=='category'}
    result={x['uuid']:accepted.get(x['uuid'],dict(state='pending',applicable_item_uuids=[],uncovered_item_uuids=replacement(items,x['uuid'])['residual_item_uuids'])) for x in items if x['kind']=='content' and (x['body']['authority']=='proposal' or requires_presentation(x,items,history))}
    for x in items:
        if x['kind']!='content' or categories.get(x['body']['category_uuid'])!='issues':continue
        links=replacement(items,x['uuid']);resolved=links['fully_superseded']
        for link in links['superseded_by']:
            approval=accepted.get(link['replacement_uuid']);needed=set(link['scope_item_uuids'] or x['body']['item_uuids'])
            if not approval or needed-set(approval['applicable_item_uuids']) or not needed and approval['state']!='accepted':resolved=False
        result[x['uuid']]={**result.get(x['uuid'],{}),'issue_state':'resolved' if resolved else 'pending','resolution_links':links['superseded_by']}
    return result
