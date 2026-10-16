"""Register nonexclusive discussions and derive their saved phase landscape."""
from .schema import fail, current
from .store import envelope, ref, uid, now
from . import seed, authorization

OPERATIONS={'discussion.register','discussion.summary_record'}


def expect(item, expected):
    if expected.get(item['uuid'])!=item['revision_uuid']:
        fail('Exact discussion/phase expectation required','REVISION_CONFLICT')


def revise(item, actor):
    item.update(revision_uuid=uid(),last_updated=now(),writer=seed.writer(actor))


def register(root,args,actor,assignment,plan,tickets,ticket,items,expected):
    if args['actor_uuid']!=actor['uuid'] or actor['body']['parent_actor_uuid'] is not None:
        fail('Only the actual fronting actor registers a phase','FORBIDDEN')
    if assignment['body']['ticket_uuid'] in tickets and assignment['body']['ticket_uuid']!=ticket['root_uuid']:
        fail('Discussion outside assigned ticket','FORBIDDEN')
    phase=next((x for x in items if x['uuid']==args['phase_node_uuid']),None)
    if not phase or phase['kind']!='workflow_node' or phase['body']['node_kind']!='conversation':
        fail('Selected phase must be a conversation node','INVALID_TRANSITION')
    expect(phase,expected)
    if args.get('native_locator'):authorization.native_locator(root,actor,args['native_locator'])
    # Re-entry to the same still-open actor/phase retains the discussion. A
    # genuinely later discussion is minted after its predecessor closes.
    peers=[x for x in items if x['kind']=='discussion' and x['body']['actor_uuid']==actor['uuid'] and x['body']['phase_node_uuid']==phase['uuid'] and x['body']['state']=='open']
    if peers:return peers[0],False
    item=envelope('discussion',dict(ticket_uuid=ticket['root_uuid'],phase_node_uuid=phase['uuid'],actor_uuid=actor['uuid'],state='open',
                  opened_seq=plan['commit_seq']+1,latest_direct_entry_ref=None,accepted_checkpoint_ref=None),seed.writer(actor))
    items.append(item)
    return item,True


def projection(items,initial_phase=None):
    """One canonical projection reused by entry and both generated views."""
    by_id={x['uuid']:x for x in items};rows=[];contenders=[];phases={}
    for discussion in (x for x in items if x['kind']=='discussion'):
        body=discussion['body'];entries=sorted((x for x in items if x['kind']=='journal_entry' and x['body']['discussion_uuid']==discussion['uuid']),key=lambda x:(x['body']['commit_seq'],x['body']['event_ordinal']))
        direct=[x for x in entries if x['writer']['actor_uuid']==body['actor_uuid'] and x['writer']['parent_actor_uuid'] is None]
        latest=entries[-1] if entries else None
        pointer=body['latest_direct_entry_ref'];front=by_id.get(pointer['entry_uuid']) if pointer else None
        if front and ref(front)!=pointer:fail('Discussion journal pointer is not exact','UNSUPPORTED_STORE')
        if body['state']=='open' and front and front in direct:contenders.append((front['body']['commit_seq'],front['body']['event_ordinal'],body['phase_node_uuid']))
        closed=body['state']=='closed' and body['accepted_checkpoint_ref'] is not None
        phases.setdefault(body['phase_node_uuid'],[]).append(closed)
        rows.append(dict(discussion_uuid=discussion['uuid'],phase_node_uuid=body['phase_node_uuid'],actor_uuid=body['actor_uuid'],state=body['state'],
                         checked=closed,focus=latest['body']['focus'] if latest else 'No saved focus yet',latest_entry_ref=ref(latest) if latest else None,
                         latest_direct_entry_ref=pointer,accepted_checkpoint_ref=body['accepted_checkpoint_ref'],entries=entries))
    return dict(current_phase_node_uuid=max(contenders)[2] if contenders else initial_phase,discussions=rows,
                phase_checks={phase:bool(flags) and all(flags) for phase,flags in phases.items()})
