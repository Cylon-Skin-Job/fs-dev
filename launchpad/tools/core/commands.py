"""Route the installed LP-01 public operations with truthful discovery."""
import copy
from pathlib import Path
from .schema import fail, named, schema, current, validate
from .store import NIL, resolve_plan, read_generation, digest, evidence, ref
from . import authorization, seed, transaction, queries, records, catalog, relations, sources, decisions, coverage, entry, discussions, checkpoints, state_check, support, assignments, attempts, reviews, acceptance, rework, workflow, checklist, prompts, integration

INSTALLED={'plan.create','ticket.create','ticket.seed_apply','seed.edit_preview','catalog.list',
           'operation.describe','schema.describe','record.get','record.head','plan.list','plan.resolve','view.render','record.update','record.create','issue.create','acceptance.record','transaction.apply',
           'recovery.inspect','recovery.plan','recovery.apply'}
INSTALLED |= queries.OPERATIONS | records.OPERATIONS | relations.OPERATIONS | decisions.OPERATIONS | {'record.merge','intake.route_preview','intake.route','validation.record'}
INSTALLED |= reviews.OPERATIONS | rework.OPERATIONS | assignments.OPERATIONS | attempts.OPERATIONS | {'assignment.prompt_get','assignment.permissions','assignment.entries'}
INSTALLED |= checkpoints.OPERATIONS | state_check.OPERATIONS | support.OPERATIONS
INSTALLED |= {'session.entry','actor.bind'} | entry.CONTEXT | discussions.OPERATIONS
INSTALLED |= workflow.OPERATIONS | checklist.OPERATIONS | prompts.OPERATIONS
INSTALLED |= integration.OPERATIONS
REGISTRY=catalog.REGISTRY


def base(request, plan):
    return dict(interface_version=1,operation=request['operation'],captured_plan_revision_uuid=plan['root_revision_uuid'],
                high_water=plan['commit_seq'],scope=request['scope'],gaps=[],continuation=None)


def read_response(request,plan,details,rows=None):
    return {**base(request,plan),'result_kind':'read','rows':rows or [],'details':details,'remaining':0}


def dispatch(root,request):
    named(request,'request.schema.json')
    op=request['operation']
    if op not in INSTALLED:
        fail('Operation unavailable in installed slice','UNSUPPORTED_OPERATION')
    if op=='session.entry':
        return entry.discover(root,request)
    if op=='plan.create':
        return transaction.create_plan(root,request)
    home=resolve_plan(root,request['scope']['plan_uuid'])
    if request['tool'] in ('db.mutate','db.transaction'):
        return transaction.mutate(root,home,request)
    if op in ('recovery.inspect','recovery.plan'):
        from . import recovery
        with transaction.lock(home/'.write.lock'):
            plan,tickets,_=read_generation(home)
            if plan['root_uuid']!=request['scope']['plan_uuid']:fail('Registry selected another plan','UNSUPPORTED_STORE')
            actor,assignment=authorization.bound(root,request,plan,tickets)
            return recovery.read(root,home,request,plan,tickets,actor,assignment)
    plan,tickets,folder=read_generation(home)
    if plan['root_uuid']!=request['scope']['plan_uuid']:fail('Registry selected another plan','UNSUPPORTED_STORE')
    actor,assignment=authorization.bound(root,request,plan,tickets)
    args=request['args']
    if op in ('assignment.prompt_get','assignment.permissions','assignment.entries'):
        selected=request['scope'].get('ticket_uuid')
        if selected not in tickets:fail('Exact ticket job scope required','MISSING_EVIDENCE')
        items=current(tickets[selected]);history=tickets[selected]['revisions'];job=next((x for x in history if x['uuid']==args['uuid'] and x['kind']=='assignment' and (x['revision_uuid']==args['revision_uuid'] if args.get('revision_uuid') else x in items)),None)
        if not job:fail('Exact stored job missing','MISSING_EVIDENCE')
        details=dict(selector='pinned' if args.get('revision_uuid') else 'current',assignment_ref=ref(job),stored_briefing=job['body'])
        if op=='assignment.entries':details['lifecycle']=attempts.projection(root,plan,tickets,items).get(job['uuid'])
        if op=='assignment.permissions':details['write_paths']=job['body']['write_paths']
        return read_response(request,plan,details)
    if op in entry.CONTEXT:
        return entry.resume(request,plan,tickets,actor,assignment)
    if op in workflow.PREVIEW:
        return workflow.preview(root,request,actor,assignment,plan,tickets)
    if op in checklist.PREVIEW:
        return checklist.preview(root,request,actor,assignment,plan,tickets)
    if op=='seed.edit_preview':
        from .store import routing_destination
        routing_destination(root)
        if op not in actor['body']['granted_operations']:
            fail('Preview grant absent','FORBIDDEN')
        proposed=args['proposed_operations']
        transaction.expectations({**request,'expected':args['target_expected'],'expected_plan_revision_uuid':plan['root_revision_uuid']},plan,
                                 [tickets[request['scope']['ticket_uuid']]] if request['scope'].get('ticket_uuid') in tickets else [],root)
        for sub in proposed:
            if sub['operation'] not in {'ticket.create','ticket.seed_apply'}:
                fail('Preview operation outside seed scope','UNSUPPORTED_OPERATION')
            trial={**request,'tool':'db.mutate','operation':sub['operation'],'args':sub['args']}
            if sub['operation'] not in actor['body']['granted_operations']:
                fail('Previewed operation grant absent','FORBIDDEN')
            validate(sub['args'],REGISTRY[sub['operation']]['args_schema'])
            if sub['operation']=='ticket.create':
                seed.mint(root,trial,actor,assignment,plan,tickets)
            else:
                selected=request['scope'].get('ticket_uuid')
                if selected not in tickets:fail('Preview ticket missing','MISSING_EVIDENCE')
                prospective=seed.apply_seed(root,trial,actor,assignment,tickets[selected],args['coverage_rows'])
                transaction.seed_expectations({'expected':args['target_expected']},tickets[selected],prospective)
        if args['coverage_rows']:
            if any(sub['operation']!='ticket.seed_apply' for sub in proposed):fail('New seed identities cannot carry guessed coverage refs','FORBIDDEN')
            full_trial={**request,'operation':'transaction.apply','args':{'operations':proposed,'expected':args['target_expected']},'expected':args['target_expected']}
            from .edits import prepare
            prepare(root,full_trial,actor,assignment,plan,tickets,args['target_expected'],args['coverage_rows'])
        for pin in args['source_refs']:
            path=Path(pin['locator'])
            from .store import file_hash
            if not path.resolve().is_relative_to(Path(assignment['body']['source_checkout']).resolve()) or not path.is_file() or file_hash(path)!=pin['sha256']:
                fail('Preview source outside pin/root','SOURCE_UNVERIFIED')
        if any(next((x['revision_uuid'] for x in current(plan)+[y for t in tickets.values() for y in current(t)] if x['uuid']==k),None)!=v for k,v in args['target_expected'].items()):
            fail('Preview expectation changed','REVISION_CONFLICT')
        return {**base(request,plan),'result_kind':'preview','preview_digest':digest(args),'proposed_operations':proposed,
                'expected':args['target_expected'],'coverage_rows':args['coverage_rows'],'authority_impacts':['Seed only; no native grant, claim or approval'],
                'recovery_prerequisites':['Exact generation/object expectations and current assigned sources on apply']}
    if op in ('catalog.list','schema.describe','operation.describe'):
        return read_response(request,plan,catalog.describe(request,actor,INSTALLED))
    if op in queries.OPERATIONS:
        return queries.read(home,request,plan,tickets,assignment)
    if op=='validation.record':
        from .store import find_ref,evidence
        from .schema import record
        if args['scope']!=request['scope']:fail('Validation scope differs','FORBIDDEN')
        uncovered=[x for x in args['checks'] if x not in ('shape','registered extensions','metadata','closed kind','source freshness','registered reconciliation','item coverage')]
        if args.get('require_adoption'):uncovered.append('Adoption is not installed in S1')
        for pin in args['record_refs']:
            if any(x['uuid']==pin['entry_uuid'] for x in queries.owned(plan,tickets,request['scope'],True)):
                item=find_ref(plan,tickets,pin)
            elif any(x['uuid']==pin['entry_uuid'] for x in queries.owned(plan,tickets,{'plan_uuid':plan['root_uuid']},True)):
                fail('Validation outside selected scope','FORBIDDEN')
            else:item=evidence(root,pin)
            record(item)
            if item['kind']=='reference' and any(x in args['checks'] for x in ('source freshness','registered reconciliation')):
                status=sources.details(item,plan,tickets,assignment,queries.owned(plan,tickets,request['scope']))
                if status['source']['freshness']!='current':uncovered.append('Source '+item['uuid']+': '+status['source']['freshness'])
                if status['reconciliation']['unreconciled_count']:uncovered.append('Registered entries need reconciliation for '+item['uuid']+': '+str(status['reconciliation']['unreconciled_count']))
        if 'item coverage' in args['checks']:
            selected=request['scope'].get('ticket_uuid')
            if selected not in tickets:fail('Item coverage needs exact ticket','MISSING_EVIDENCE')
            uncovered += [x['source_item_uuid']+': '+x['reason'] for x in coverage.ledger(root,plan,tickets,current(tickets[selected]))['holds']]
        return {**base(request,plan),'result_kind':'validation','verdict':'incomplete' if uncovered else 'pass','checked_refs':args['record_refs'],'findings':[],'uncovered_scope':uncovered}
    if op=='intake.route_preview':
        return records.preview(root,request,actor,assignment,plan,tickets)
    if op=='plan.list':
        from .store import registry
        details=registry(root)
        result=read_response(request,plan,details[:args.get('limit',20)])
        result['remaining']=max(0,len(details)-args.get('limit',20))
        for header in details:
            try:read_generation(resolve_plan(root,header['uuid']))
            except Exception:result['gaps'].append('Unverified plan '+header['uuid'])
        if result['remaining']:result['gaps'].append('Plan list limit reached; expand limit explicitly')
        return result
    if op=='plan.resolve':
        if args['uuid']!=plan['root_uuid']:fail('Read scope cannot expand plan','FORBIDDEN')
        return read_response(request,plan,dict(uuid=plan['root_uuid'],current_home=str(home)))
    if op=='view.render':
        selected,args_generation=args.get('ticket_uuid'),args['plan_revision_uuid']
        captured,ts,f=read_generation(home,args_generation)
        path=f/'tickets'/f'{selected}.html' if selected else f/'plan.HTML'
        from .store import file_hash
        if selected and selected not in ts:fail('View ticket missing','MISSING_EVIDENCE')
        return read_response(request,captured,dict(path=str(path),sha256=file_hash(path),generation=captured['root_revision_uuid']))
    if op in workflow.READS:
        return workflow.read(root,request,plan,tickets,actor,assignment)
    if op in checklist.READS:
        return checklist.read(root,request,plan,tickets,actor,assignment)
    if op in prompts.READS:
        return prompts.read(root,request,plan,tickets,actor,assignment)
    selected=request['scope'].get('ticket_uuid')
    if selected and selected not in tickets:fail('Selected ticket missing','MISSING_EVIDENCE')
    owned=current(tickets[selected]) if selected else current(plan)
    if args.get('revision_uuid'):
        owned=tickets[selected]['revisions'] if selected else plan['revisions']
    matches=[x for x in owned if x['uuid']==args['uuid'] and (not args.get('revision_uuid') or x['revision_uuid']==args['revision_uuid'])]
    if not matches:fail('Record missing from exact selected scope','MISSING_EVIDENCE')
    item=matches[-1]
    fields=args.get('fields') or ['uuid','revision_uuid','kind','last_updated','writer']
    if set(fields)-item.keys():fail('Unknown projected field')
    row=dict(uuid=item['uuid'],revision_uuid=item['revision_uuid'],kind=item['kind'],fields={k:item[k] for k in fields},omitted_fields=sorted(set(item)-set(fields)))
    return read_response(request,plan,None,[row])
