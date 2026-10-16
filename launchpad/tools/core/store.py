"""Read immutable generations and verified record references."""
import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from .schema import ContractError, fail, snapshot, current, record

NIL = '00000000-0000-0000-0000-000000000000'


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(encode(value)).hexdigest()


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def ref(item):
    return dict(entry_uuid=item['uuid'], revision_uuid=item['revision_uuid'],
                sha256=digest(item), scope_item_uuids=[])


def envelope(kind, body, writer, sources=None, entry=None):
    stamp = now()
    return dict(schema_version='launchpad-core/1', uuid=entry or uid(), revision_uuid=uid(),
                kind=kind, created_at=stamp, last_updated=stamp, writer=writer,
                source_refs=sources or [], body=body, extensions={}, lifecycle='live',
                lifecycle_evidence=dict(previous_live_revision_uuid=None, reason=None,
                                        authority_ref=None, changed_at=None))


def container(kind, root, records, generation=None, seq=0, receipts=None):
    value = dict(schema_version='launchpad-core/1', entity_kind=kind, root_uuid=root,
                 root_revision_uuid=generation or uid(), commit_seq=seq,
                 current=[dict(entry_uuid=x['uuid'], revision_uuid=x['revision_uuid']) for x in records],
                 revisions=records, idempotency_receipt_refs=receipts or [])
    # Prospective containers acquire retained history before publication preflight.
    snapshot(value,check_lifecycle=False)
    return value


def safe_name(value):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', value) or value == 'template':
        fail('Unsafe or inert folder name')
    return value


def confined(root, path):
    root, path = Path(root).resolve(), Path(path)
    resolved = path.resolve()
    if not resolved.is_relative_to(root):
        fail('Path leaves assigned root', 'FORBIDDEN')
    relative = path.absolute().relative_to(root)
    probe = root
    for part in relative.parts:
        probe /= part
        if probe.is_symlink():
            fail('Owned write path traverses symlink', 'FORBIDDEN')
    return path


def load(path):
    try:
        def pairs(entries):
            result={}
            for key,value in entries:
                if key in result:raise ValueError('Duplicate stored JSON key')
                result[key]=value
            return result
        return json.loads(Path(path).read_text(),object_pairs_hook=pairs,parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite stored JSON')))
    except (ValueError, OSError) as error:
        raise ContractError('UNSUPPORTED_STORE', 'Missing/corrupt JSON: ' + str(path)) from error


def registry(root):
    path = confined(root,Path(root) / 'plans.json')
    rows = load(path) if path.exists() else []
    if not isinstance(rows, list) or any(not isinstance(x,dict) or set(x) != {'uuid', 'title', 'current_home'} for x in rows):
        fail('Malformed routing registry', 'UNSUPPORTED_STORE')
    for row in rows:
        if any(not isinstance(row[key],str) or not row[key] for key in ('uuid','title','current_home')):
            fail('Malformed routing header values','UNSUPPORTED_STORE')
        try:
            if str(uuid.UUID(row['uuid']))!=row['uuid']:raise ValueError()
        except ValueError:
            fail('Noncanonical routing UUID','UNSUPPORTED_STORE')
        if not re.fullmatch(r'work-tickets/[A-Za-z0-9][A-Za-z0-9_-]*',row['current_home']) or row['current_home']=='work-tickets/template':
            fail('Unsafe routing home','UNSUPPORTED_STORE')
        confined(root,Path(root)/row['current_home'])
    if len({x['uuid'] for x in rows}) != len(rows) or len({x['current_home'] for x in rows}) != len(rows):
        fail('Ambiguous plan registry', 'BINDING_AMBIGUOUS')
    return rows


def routing_destination(root):
    path=confined(root,Path(root)/'plans.HTML')
    if path.exists() and not path.is_file():
        fail('Routing chooser must be an ordinary file','UNSUPPORTED_STORE')
    return path


def resolve_plan(root, plan_uuid):
    rows = [x for x in registry(root) if x['uuid'] == plan_uuid]
    if len(rows) != 1:
        fail('Selected plan unavailable or ambiguous', 'BINDING_AMBIGUOUS')
    home = confined(root, Path(root) / rows[0]['current_home'])
    if home.parent != Path(root) / 'work-tickets':
        fail('Plan home is outside selected owner', 'FORBIDDEN')
    return home


def read_generation(home, generation=None):
    home = Path(home)
    confined(home,home/'.revisions')
    if generation:
        folder = home / '.revisions' / generation
    else:
        try:
            target = os.readlink(home / 'CURRENT')
        except OSError as error:
            raise ContractError('UNSUPPORTED_STORE', 'CURRENT must be a relative selector') from error
        if not re.fullmatch(r'\.revisions/[a-f0-9-]{36}', target):
            fail('Invalid CURRENT selector', 'UNSUPPORTED_STORE')
        folder = home / target
    if folder.resolve().parent != (home / '.revisions').resolve() or folder.is_symlink():
        fail('Generation leaves plan owner', 'UNSUPPORTED_STORE')
    plan = load(folder / 'plan.json')
    snapshot(plan)
    if folder.name != plan['root_revision_uuid']:
        fail('Generation identity mismatch', 'UNSUPPORTED_STORE')
    root = next(x for x in current(plan) if x['uuid'] == plan['root_uuid'])
    tickets = {}
    prepared=confined(home,home/'.prepared'/(plan['root_revision_uuid']+'.json'))
    if not prepared.is_file():fail('Missing prepared publication hashes','UNSUPPORTED_STORE')
    if prepared.exists():
        proof=load(prepared)
        if not isinstance(proof,dict) or set(proof)!={'old_generation','new_generation','request_sha256','plan_sha256','view_hashes'} or not isinstance(proof['view_hashes'],dict):
            fail('Malformed prepared publication evidence','UNSUPPORTED_STORE')
        for key in ('new_generation','old_generation'):
            value=proof[key]
            if key=='old_generation' and value is None:continue
            if not isinstance(value,str) or not re.fullmatch(r'[a-f0-9-]{36}',value):
                fail('Malformed prepared generation identity','UNSUPPORTED_STORE')
            try:
                if str(uuid.UUID(value))!=value:raise ValueError()
            except ValueError:
                fail('Malformed prepared generation identity','UNSUPPORTED_STORE')
        if any(not isinstance(proof[key],str) or not re.fullmatch(r'[a-f0-9]{64}',proof[key]) for key in ('request_sha256','plan_sha256')):
            fail('Malformed prepared publication digest','UNSUPPORTED_STORE')
        expected_views={'plan.HTML'}|{'tickets/'+x['ticket_uuid']+'.html' for x in root['body']['ticket_bindings']}
        if set(proof['view_hashes'])!=expected_views:
            fail('Incomplete or foreign prepared view inventory','UNSUPPORTED_STORE')
        if any(not isinstance(k,str) or not re.fullmatch(r'(plan\.HTML|tickets/[a-f0-9-]{36}\.html)',k) or not isinstance(v,str) or not re.fullmatch(r'[a-f0-9]{64}',v) for k,v in proof['view_hashes'].items()):
            fail('Malformed prepared view paths/hashes','UNSUPPORTED_STORE')
        if proof['plan_sha256']!=file_hash(folder/'plan.json') or proof['new_generation']!=plan['root_revision_uuid']:
            fail('Selected plan hash mismatch','UNSUPPORTED_STORE')
        receipts=[x for x in current(plan) if x['kind']=='receipt' and x['body']['new_generation']==plan['root_revision_uuid']]
        if len(receipts)!=1 or any(proof[key]!=receipts[0]['body'][key] for key in ('old_generation','new_generation','request_sha256')):
            fail('Prepared lineage disagrees with canonical receipt','UNSUPPORTED_STORE')
        for name,expected in proof['view_hashes'].items():
            if file_hash(confined(folder,folder/name))!=expected:
                fail('Generated view hash mismatch','UNSUPPORTED_STORE')
    for binding in root['body']['ticket_bindings']:
        expected_path=binding['current_home']+'/.revisions/'+binding['ticket_revision_uuid']+'/ticket.json'
        safe_name(binding['current_home'])
        if binding['relative_path']!=expected_path:fail('Canonical child owner path mismatch','UNSUPPORTED_STORE')
        payload = home / binding['relative_path']
        confined(home,payload)
        if not payload.resolve().is_relative_to(home.resolve()) or payload.is_symlink():
            fail('Canonical payload leaves plan', 'UNSUPPORTED_STORE')
        if file_hash(payload) != binding['sha256']:
            fail('Canonical ticket hash mismatch', 'UNSUPPORTED_STORE')
        alias=folder/'tickets'/(binding['ticket_uuid']+'.json')
        confined(folder,alias.parent)
        try:
            if os.readlink(alias)!=os.path.relpath(payload,alias.parent) or file_hash(alias)!=binding['sha256']:
                fail('Generation payload alias disagrees with canonical binding','UNSUPPORTED_STORE')
        except OSError as error:
            raise ContractError('UNSUPPORTED_STORE','Missing/corrupt generation payload alias') from error
        ticket = load(payload)
        snapshot(ticket)
        if ticket['root_uuid'] in tickets or ticket['root_uuid'] != binding['ticket_uuid'] or ticket['root_revision_uuid'] != binding['ticket_revision_uuid']:
            fail('Duplicate/mismatched ticket identity', 'UNSUPPORTED_STORE')
        ticket_root=next(x for x in current(ticket) if x['kind']=='ticket')
        if ticket_root['body']['plan_uuid']!=plan['root_uuid'] or ticket_root['body']['current_home']!=binding['current_home']:
            fail('Ticket root owner mismatch','UNSUPPORTED_STORE')
        tickets[ticket['root_uuid']] = ticket
    if {p.name for p in (folder/'tickets').glob('*.json')}!={x['ticket_uuid']+'.json' for x in root['body']['ticket_bindings']}:
        fail('Foreign generation payload alias inventory','UNSUPPORTED_STORE')
    revisions=plan['revisions']+[x for t in tickets.values() for x in t['revisions']]
    identities=[x['uuid'] for x in current(plan)]+[x['uuid'] for t in tickets.values() for x in current(t)]
    if len(identities)!=len(set(identities)):fail('Duplicate cross-owner identity','UNSUPPORTED_STORE')
    by_revision={x['revision_uuid']:x for x in revisions}
    if len(by_revision)!=len(revisions):fail('Duplicate cross-owner revision','UNSUPPORTED_STORE')
    for value in [plan]+list(tickets.values()):
        for item in current(value):
            pins=item['body'].get('record_refs',[])+item['body'].get('category_refs',[])+item['body'].get('layout_refs',[])
            for pin in pins:
                target=by_revision.get(pin['revision_uuid'])
                if not target or ref(target)!=pin:fail('Canonical reference hash mismatch','UNSUPPORTED_STORE')
        for pin in value['idempotency_receipt_refs']:
            target=by_revision.get(pin['revision_uuid'])
            if not target or target['kind']!='receipt' or ref(target)!=pin:fail('Receipt index hash mismatch','UNSUPPORTED_STORE')
    return plan, tickets, folder


def evidence(root, reference):
    item = load(confined(root, Path(root) / '.evidence' / (reference['revision_uuid'] + '.json')))
    record(item)
    if ref(item) != reference:
        fail('External evidence hash or identity mismatch', 'SOURCE_UNVERIFIED')
    return item


def find_ref(plan, tickets, reference):
    items = plan['revisions'] + [x for t in tickets.values() for x in t['revisions']]
    matches = [x for x in items if x['revision_uuid'] == reference['revision_uuid'] and x['uuid'] == reference['entry_uuid']]
    if len(matches) != 1 or ref(matches[0]) != reference:
        fail('Reference missing or hash-invalid', 'SOURCE_UNVERIFIED')
    return matches[0]
