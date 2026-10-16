"""Validate trusted local actor bindings against exact assigned roots."""
from pathlib import Path
from .store import evidence, find_ref, ref
from .schema import fail, current


def bootstrap(root, request):
    actor = evidence(root, request['actor_binding_ref'])
    if actor['kind'] != 'actor' or actor['body']['state'] != 'active':
        fail('Active bootstrap actor required', 'FORBIDDEN')
    assignments = [evidence(root, x) for x in actor['body']['assignment_refs']]
    target = str((Path(root) / 'work-tickets' / request['args']['plan_folder']).resolve())
    matching = [x for x in assignments if x['kind'] == 'assignment' and target in x['body']['write_paths']]
    if len(matching) != 1 or request['operation'] not in actor['body']['granted_operations']:
        fail('Exact provisioning assignment missing/ambiguous', 'FORBIDDEN')
    assignment = matching[0]
    validate_assignment(actor,assignment)
    refs = request['args']['bootstrap_evidence_refs']
    if ref(assignment) not in refs or actor['body']['binding_evidence_ref'] not in refs or assignment['body']['authority_ref'] not in refs:
        fail('Bootstrap assignment/identity/owner evidence incomplete', 'MISSING_EVIDENCE')
    for reference in refs:
        evidence(root, reference)
    validate_runtime(actor)
    return actor, assignment


def validate_runtime(actor):
    body = actor['body']
    if Path(body['actual_cwd']).resolve() != Path.cwd().resolve():
        fail('Actual process CWD differs from verified actor binding', 'SOURCE_UNVERIFIED')
    if body['runtime_kind'] == 'ephemeral' and body['runtime_id'] is not None:
        fail('Unknown native actor cannot fabricate identity', 'SOURCE_UNVERIFIED')


def validate_assignment(actor,assignment):
    if assignment['body']['eligible_actor_uuid'] not in (None,actor['uuid']) or assignment['body']['role']!=actor['body']['role']:
        fail('Actor does not match exact assignment role/identity','FORBIDDEN')


def bound(root, request, plan, tickets, write=False):
    pinned = find_ref(plan,tickets,request['actor_binding_ref'])
    actor=next((x for x in current(plan) if x['uuid']==pinned['uuid']),None)
    if actor is None:fail('Binding no longer registered','FORBIDDEN')
    if actor['kind'] != 'actor' or actor['body']['state'] != 'active':
        fail('Binding inactive', 'FORBIDDEN')
    validate_runtime(actor)
    host_evidence(root,actor['body'])
    from .runtime_binding import resolve
    assignments = [resolve(root,plan,tickets,x) for x in actor['body']['assignment_refs']]
    home = str(Path(root).joinpath(next(x for x in current(plan) if x['kind'] == 'plan')['body']['current_home']).resolve())
    assignments = [x for x in assignments if home in x['body']['write_paths']]
    if len(assignments) != 1:
        fail('Selected plan not uniquely assigned', 'FORBIDDEN')
    validate_assignment(actor,assignments[0])
    selected=request['scope'].get('ticket_uuid')
    if assignments[0]['body']['ticket_uuid'] in tickets and selected and selected!=assignments[0]['body']['ticket_uuid']:
        fail('Selected ticket differs from exact actor assignment','FORBIDDEN')
    if write and request['operation'] not in actor['body']['granted_operations']:
        fail('Operation grant missing', 'FORBIDDEN')
    return actor, assignments[0]


def dependency(root, plan, tickets, reference, expected):
    """Resolve exact current local or explicitly saved external evidence."""
    owned = current(plan)+[x for t in tickets.values() for x in current(t)]
    if any(x['uuid']==reference['entry_uuid'] for x in owned):
        item=find_ref(plan,tickets,reference)
        if item not in owned:
            fail('Required dependency is not current','REVISION_CONFLICT')
    else:
        item=evidence(root,reference)
    if expected.get(item['uuid'])!=item['revision_uuid']:
        fail('Exact dependency/gate expectation required','REVISION_CONFLICT')
    if item['lifecycle']!='live':
        fail('Dependency is not live','INVALID_TRANSITION')
    return item


def authority(root, plan, tickets, reference, assignment, expected):
    item=dependency(root,plan,tickets,reference,expected)
    if reference!=assignment['body']['authority_ref'] or item['kind']!='content' or item['body']['authority']!='owner_decision' or item['body']['state']!='active':
        fail('Original assigned owner authority required','FORBIDDEN')
    return item


def host_evidence(root,body):
    """Validate saved local evidence; this is not native host attestation."""
    item=evidence(root,body['binding_evidence_ref']);proof=item['body'].get('content')
    if item['kind']!='content' or item['body']['authority']!='active_code_constraint' or item['body']['state']!='active' or not isinstance(proof,dict):
        fail('Saved actual host evidence required','SOURCE_UNVERIFIED')
    if not Path(body['actual_cwd']).is_absolute() or not Path(body['actual_cwd']).is_dir():fail('Actor CWD must be an actual absolute directory','SOURCE_UNVERIFIED')
    if proof.get('actual_cwd')!=body['actual_cwd'] or proof.get('runtime_kind')!=body['runtime_kind'] or proof.get('permissions')!='danger-full-access':
        fail('Actor body differs from saved CWD/runtime/permission evidence','SOURCE_UNVERIFIED')
    for key in ('runtime_id','host_id','parent_actor_uuid'):
        if body[key] is not None and proof.get(key)!=body[key]:fail('Actual identity/parent evidence missing or differs','SOURCE_UNVERIFIED')
    if body['runtime_kind']=='ephemeral' and any(body[k] is not None for k in ('runtime_id','host_id','parent_actor_uuid')):
        fail('Unknown native identity must remain null','SOURCE_UNVERIFIED')
    if body['runtime_kind']=='child' and (not body['runtime_id'] or not body['parent_actor_uuid']):
        fail('Actual child identity and parent evidence required','SOURCE_UNVERIFIED')
    if body['runtime_kind']=='thread' and (not body['runtime_id'] or not body['host_id']):
        fail('Actual persistent identity evidence required','SOURCE_UNVERIFIED')
    return proof


def native_locator(root,actor,locator):
    proof=host_evidence(root,actor['body'])
    if actor['body']['runtime_kind']=='ephemeral' or locator not in proof.get('native_locators',[]):
        fail('Native locator unavailable in exact saved binding evidence','SOURCE_UNVERIFIED')
    return locator


def bind_actor(root,args,manager,assignment,plan,tickets,records,expected):
    """Responsible manager registers one subordinate within its own grants."""
    from .store import envelope
    from . import seed
    from .entry import assignment_proof
    body=args['body']
    authority(root,plan,tickets,args['authority_ref'],assignment,expected)
    if body['binding_evidence_ref']!=args['binding_evidence_ref'] or body['state']!='active' or len(body['assignment_refs'])!=1:
        fail('Exact active subordinate binding/evidence required','FORBIDDEN')
    proof=dependency(root,plan,tickets,args['binding_evidence_ref'],expected);host_evidence(root,body)
    from .runtime_binding import resolve, procedure
    subordinate=resolve(root,plan,tickets,body['assignment_refs'][0]);dependency(root,plan,tickets,body['assignment_refs'][0],expected)
    if subordinate['kind']!='assignment':fail('Exact subordinate assignment required','FORBIDDEN')
    procedure(subordinate)
    b=subordinate['body'];home=str(Path(root).joinpath(next(x for x in current(plan) if x['kind']=='plan')['body']['current_home']).resolve())
    if b['manager_uuid']!=manager['uuid'] or b['authority_ref']!=assignment['body']['authority_ref'] or b['role']!=body['role'] or b['ticket_uuid'] not in tickets:
        fail('Subordinate assignment does not match responsible manager/ticket/role','FORBIDDEN')
    if not Path(b['source_checkout']).resolve().is_relative_to(Path(assignment['body']['source_checkout']).resolve()):
        fail('Subordinate source scope exceeds manager assignment','FORBIDDEN')
    for pin in b['source_refs']+b['prerequisite_refs']:dependency(root,plan,tickets,pin,expected)
    if any(not Path(path).is_absolute() for path in b['write_paths']+[b['report_path'],b['source_checkout']]):fail('Assignment paths must be absolute','SOURCE_UNVERIFIED')
    if not any(Path(home).resolve().is_relative_to(Path(path).resolve()) for path in b['write_paths']) or any(not any(Path(path).resolve().is_relative_to(Path(base).resolve()) for base in assignment['body']['write_paths']) for path in b['write_paths']+[b['report_path']]):
        fail('Subordinate writable/report scope exceeds manager assignment','FORBIDDEN')
    if assignment['body']['ticket_uuid'] in tickets and b['ticket_uuid']!=assignment['body']['ticket_uuid']:
        fail('Subordinate ticket scope exceeds manager assignment','FORBIDDEN')
    if set(body['granted_operations'])-set(manager['body']['granted_operations']):fail('Subordinate grants exceed manager grants','FORBIDDEN')
    if body['runtime_kind']=='child':
        from .runtime_binding import ATTEMPT_GRANTS, EVALUATION_GRANTS
        autonomous=any(x['uuid']==subordinate['uuid'] and x==subordinate for t in tickets.values() for x in current(t))
        grants=EVALUATION_GRANTS if autonomous and b['work_kind'] in ('evaluation','standards') else ATTEMPT_GRANTS if autonomous else {'discussion.summary_record','support.report_submit','state.check','transaction.apply'}
        if body['parent_actor_uuid']!=manager['uuid'] or set(body['granted_operations'])-grants:
            fail('Inline child retains actual parent and report/journal-only grants','FORBIDDEN')
    elif body['parent_actor_uuid'] is not None:fail('Fronting actor cannot borrow parent identity','FORBIDDEN')
    identity=b['eligible_actor_uuid']
    if identity and any(x['uuid']==identity for x in records+[y for t in tickets.values() for y in current(t)]):
        fail('Actor identity already registered','INVALID_TRANSITION')
    item=envelope('actor',body,seed.writer(manager),entry=identity)
    records.append(item)
    return item
