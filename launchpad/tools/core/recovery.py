"""Inspect retained publication inventory without rolling back selected facts."""
import os
from pathlib import Path
from .schema import fail, current, ContractError, snapshot
from .store import load, confined, read_generation, ref, digest, file_hash, find_ref, uid
from . import authorization


def inventory(home):
    home=Path(home);rows=[]
    for folder in sorted(confined(home,home/'.revisions').glob('*')):
        confined(home,folder)
        row=dict(generation=folder.name,status='partial',files=[])
        if folder.is_dir():
            row['files']=[dict(path=str(p.relative_to(home)),sha256=file_hash(p)) for p in sorted(folder.rglob('*')) if p.is_file() and not p.is_symlink()]
        try:
            staged=load(confined(home,folder/'plan.json'));snapshot(staged)
            row['receipt_refs']=[ref(x) for x in current(staged) if x['kind']=='receipt' and x['body']['new_generation']==folder.name]
        except (ContractError,OSError,KeyError):pass
        prepared=confined(home,home/'.prepared'/(folder.name+'.json'))
        if prepared.is_file():
            try:
                proof=load(prepared)
                plan,_,captured=read_generation(home,folder.name)
            except (ContractError,OSError,KeyError) as error:
                if (home/'CURRENT').is_symlink() and os.readlink(home/'CURRENT')=='.revisions/'+folder.name:raise
                row.update(status='partial-prepared',error=str(error),prepared_sha256=file_hash(prepared))
                rows.append(row);continue
            if file_hash(captured/'plan.json')!=proof['plan_sha256'] or any(file_hash(captured/k)!=v for k,v in proof['view_hashes'].items()):
                fail('Prepared generation hash mismatch','UNSUPPORTED_STORE')
            row.update(status='prepared',prepared_sha256=file_hash(prepared))
        rows.append(row)
    # Child payloads can precede plan files/prepared receipt; retain their exact paths/hashes.
    children=[]
    for folder in sorted(home.iterdir()):
        if folder.is_dir() and not folder.is_symlink() and not folder.name.startswith('.'):
            confined(home,folder)
            for path in sorted((folder/'.revisions').glob('*/ticket.json')):
                confined(home,path);children.append(dict(path=str(path.relative_to(home)),sha256=file_hash(path)))
    return dict(generations=rows,child_payloads=children)


def scope(request):
    if request['args'].get('scope')!=request['scope']:fail('Recovery scope cannot expand outer binding','FORBIDDEN')


def bookkeeping(home):
    """Partial derived files are inventory, never fabricated canonical receipts."""
    rows=[]
    for path in sorted((Path(home)/'.recovery').rglob('*')):
        confined(home,path)
        if not path.is_file():continue
        row=dict(path=str(path.relative_to(home)),sha256=file_hash(path),status='staging')
        try:
            value=load(path)
            if path.name.startswith('action-') and isinstance(value,dict) and set(value)=={'prepared_receipt_ref','current_generation','action','inventory'}:
                row.update(status='complete-action',value=value)
            elif path.parent.name=='intents' and not path.name.startswith('.') and isinstance(value,dict) and set(value)=={'request_sha256','assignment_uuid','value','publication_generations'}:
                row.update(status='complete-intent',request_sha256=value['request_sha256'])
        except ContractError:pass
        rows.append(row)
    return rows


def selected_receipt(home,reference):
    found=[]
    for path in confined(home,Path(home)/'.revisions').glob('*/plan.json'):
        try:
            plan=load(confined(home,path));snapshot(plan)
            item=find_ref(plan,{},reference)
        except (ContractError,OSError,KeyError):continue
        if item['kind']=='receipt' and item['body']['new_generation']==path.parent.name:found.append(item)
    if len(found)!=1:fail('Exact prepared receipt missing/ambiguous','MISSING_EVIDENCE')
    return found[0]


def proposal(home,plan,reference):
    receipt=selected_receipt(home,reference)
    committed=any(r==reference for r in plan['idempotency_receipt_refs'])
    value=dict(prepared_receipt_ref=reference,current_generation=plan['root_revision_uuid'],
               action='acknowledge' if committed else 'abandon',inventory=inventory(home))
    return value,receipt


def read(root,home,request,plan,tickets,actor,assignment):
    scope(request)
    from .commands import base
    args=request['args']
    if request['operation']=='recovery.inspect':
        for pin in args['record_refs']:find_ref(plan,tickets,pin)
        details=inventory(home)
        details['recovery_bookkeeping']=bookkeeping(home)
        return {**base(request,plan),'result_kind':'validation','verdict':'incomplete' if args.get('require_adoption') else 'pass',
                'checked_refs':args['record_refs'],'findings':[__import__('json').dumps(details,sort_keys=True)],
                'uncovered_scope':['Native/consumer adoption is outside A02'] if args.get('require_adoption') else []}
    if 'recovery.plan' not in actor['body']['granted_operations']:fail('Recovery planning grant absent','FORBIDDEN')
    if args['current_generation']!=plan['root_revision_uuid']:fail('Recovery generation changed','REVISION_CONFLICT')
    value,_=proposal(home,plan,args['prepared_receipt_ref'])
    expected={plan['root_uuid']:next(x for x in current(plan) if x['kind']=='plan')['revision_uuid']}
    return {**base(request,plan),'result_kind':'preview','preview_digest':digest(value),
            'proposed_operations':[dict(operation='recovery.apply',args=dict(recovery_preview_digest=digest(value),inactive_writer_refs=[],current_expected=expected,authority_ref=assignment['body']['authority_ref']))],
            'expected':expected,'coverage_rows':[],'authority_impacts':[value['action']+' retained generation '+value['prepared_receipt_ref']['revision_uuid']],
            'recovery_prerequisites':['Exact current expectations, assigned owner authority and verified inactive writer evidence; no claims or dispatch are changed']}


def apply(root,home,request,plan,tickets,assignment):
    args=request['args'];expected=request['expected']
    if args['current_expected']!=expected:fail('Recovery expected map must match request')
    authorization.authority(root,plan,tickets,args['authority_ref'],assignment,expected)
    if not args['inactive_writer_refs']:fail('Inactive writer evidence required','MISSING_EVIDENCE')
    inactive_assignments=set()
    for pin in args['inactive_writer_refs']:
        item=authorization.dependency(root,plan,tickets,pin,expected);body=item['body']
        proof=body.get('content')
        if item['kind']!='content' or body['authority']!='active_code_constraint' or not isinstance(proof,dict) or proof.get('state')!='inactive' or not proof.get('assignment_uuid') or type(proof.get('pid')) is not int or proof['pid']<=0:
            fail('Actual assigned inactive writer evidence required','MISSING_EVIDENCE')
        inactive_assignments.add(proof['assignment_uuid'])
        try:os.kill(proof['pid'],0)
        except ProcessLookupError:pass
        else:fail('Recovery writer is still alive','FORBIDDEN')
    captured=inventory(home)
    intent=confined(home,Path(home)/'.recovery'/'intents'/(digest(request)+'.json'))
    if intent.is_file():
        saved=load(intent)
        if not isinstance(saved,dict) or set(saved)!={'request_sha256','assignment_uuid','value','publication_generations'} or saved['request_sha256']!=digest(request) or saved['assignment_uuid']!=assignment['uuid']:
            fail('Recovery intent owner/hash mismatch','UNSUPPORTED_STORE')
        owned=saved['publication_generations']
        import re
        if not isinstance(owned,list) or any(not isinstance(x,str) or not re.fullmatch(r'[a-f0-9-]{36}',x) for x in owned) or len(set(owned))!=len(owned):
            fail('Recovery publication ownership malformed','UNSUPPORTED_STORE')
        value=saved['value']
        if digest(value)!=args['recovery_preview_digest'] or value['current_generation']!=plan['root_revision_uuid']:
            fail('Recovery intent/current preview mismatch','REVISION_CONFLICT')
        receipt=selected_receipt(home,value['prepared_receipt_ref'])
        original=value['inventory'];old_rows={x['generation']:x for x in original['generations']}
        new_rows={x['generation']:x for x in captured['generations']}
        if original['child_payloads']!=captured['child_payloads'] or any(new_rows.get(k)!=v for k,v in old_rows.items()) or set(new_rows)-set(old_rows)-set(owned):
            fail('Recovery inventory changed outside this exact request','REVISION_CONFLICT')
        for generation in set(new_rows)-set(old_rows):
            for pin in new_rows[generation].get('receipt_refs',[]):
                staged=selected_receipt(home,pin)
                if staged['body']['request_sha256']!=digest(request) or staged['body']['assignment_uuid']!=assignment['uuid']:
                    fail('Recovery publication receipt owner mismatch','REVISION_CONFLICT')
        action='acknowledge' if value['prepared_receipt_ref'] in plan['idempotency_receipt_refs'] else 'abandon'
        if value['action']!=action:fail('Recovery selected receipt facts changed','REVISION_CONFLICT')
    else:
        matches=[]
        for row in captured['generations']:
            for pin in row.get('receipt_refs',[]):
                if pin['revision_uuid'] not in {r['revision_uuid'] for _,r in matches}:
                    try:value,receipt=proposal(home,plan,pin)
                    except ContractError:continue
                    if digest(value)==args['recovery_preview_digest']:matches.append((value,receipt))
        if len(matches)!=1:fail('Recovery preview changed/missing','REVISION_CONFLICT')
        value,receipt=matches[0]
    if receipt['body']['assignment_uuid'] not in inactive_assignments:fail('Inactive evidence must identify the staged writer assignment','MISSING_EVIDENCE')
    from .transaction import replace_json
    generation=uid()
    owned=saved['publication_generations'] if intent.is_file() else []
    replace_json(intent,dict(request_sha256=digest(request),assignment_uuid=assignment['uuid'],value=value,publication_generations=owned+[generation]))
    path=confined(home,Path(home)/'.recovery'/('action-'+value['prepared_receipt_ref']['revision_uuid']+'.json'))
    # The immutable request intent retains each original action. This complete
    # marker is its derived latest projection; temporary partial writes remain.
    if not path.exists() or load(path)!=value:replace_json(path,value)
    # Preserve all payloads, prepared receipts and selected history. Never replace CURRENT here.
    return generation
