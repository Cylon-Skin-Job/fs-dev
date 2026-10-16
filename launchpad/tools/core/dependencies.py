"""Re-evaluate plan dependency release conditions over every ticket.

This is a projection owner. It never dispatches, publishes an assignment, or
executes Git. It reads immutable current facts (finalization receipts, workflow
prerequisites, explicit holds) and reports completed/locked/unlocked states and
the four recomputed track paths. The Plan Manager seed surface uses the same
release graph so a seed-only edit recomputes all track paths, while authored
blocked-SPEC and mid-build content edits stay refused.
"""
from .schema import fail, current
from .store import ref

# Record kinds that represent a released release-condition fact when active.
RELEASE_KINDS = {'acceptance', 'review', 'content', 'integration', 'ticket'}


def resolve(root, plan, tickets, pin):
    """Resolve an exact ref against current owners or explicitly saved evidence.

    Unlike authorization.dependency this is a read-only projection helper with no
    expectation map; a missing or mismatched pin resolves to None (unmet), never
    an exception that would fabricate release.
    """
    owned = plan['revisions'] + [x for t in tickets.values() for x in t['revisions']]
    for item in owned:
        if item['uuid'] == pin['entry_uuid'] and item['revision_uuid'] == pin['revision_uuid']:
            if ref(item) == pin:
                return item
    try:
        from .store import evidence
        return evidence(root, pin)
    except Exception:
        return None


def released(item):
    """True when an exact resolved condition fact is a released receipt."""
    if item is None:
        return False
    body = item['body']
    if item['kind'] == 'acceptance':
        return body['state'] == 'active'
    if item['kind'] == 'review':
        return body['verdict'] == 'pass' and not body['finding_refs']
    if item['kind'] == 'content':
        return body['state'] == 'active'
    if item['kind'] == 'integration':
        return True
    if item['kind'] == 'ticket':
        return body['state'] == 'finalized' and body['finalization_ref'] is not None
    return False


def _pins(items):
    """Every explicit release condition declared by this ticket's workflow nodes."""
    rows = []
    for node in (x for x in items if x['kind'] == 'workflow_node'):
        for pin in node['body']['prerequisite_refs']:
            rows.append((node['uuid'], pin))
    return rows


def ticket_release(root, plan, tickets, ticket):
    """Completed/locked/unlocked for one ticket plus per-condition disclosure."""
    items = current(ticket)
    target = next(x for x in items if x['kind'] == 'ticket')
    finalized = target['body']['state'] == 'finalized' and target['body']['finalization_ref'] is not None
    conditions = []
    unmet = []
    for node_uuid, pin in _pins(items):
        item = resolve(root, plan, tickets, pin)
        ok = released(item)
        conditions.append(dict(node_uuid=node_uuid, condition_ref=pin, satisfied=ok,
                               reason=None if ok else 'Prerequisite release receipt is not current and active'))
        if not ok:
            unmet.append(node_uuid)
    if finalized:
        state = 'completed'
    elif unmet:
        state = 'locked'
    else:
        state = 'unlocked'
    return dict(ticket_uuid=ticket['root_uuid'], state=state, finalized=finalized,
                finalization_ref=target['body']['finalization_ref'],
                conditions=conditions, unmet_node_uuids=sorted(set(unmet)),
                disclosure='Eligibility only; an unlocked successor is never dispatched or assigned here')


def release(root, plan, tickets):
    """Re-evaluate ALL plan dependency release conditions across every ticket."""
    rows = {key: ticket_release(root, plan, tickets, value) for key, value in tickets.items()}
    unlocked = sorted(key for key, row in rows.items() if row['state'] == 'unlocked')
    return dict(
        tickets=rows,
        completed=sorted(key for key, row in rows.items() if row['state'] == 'completed'),
        locked=sorted(key for key, row in rows.items() if row['state'] == 'locked'),
        unlocked=unlocked,
        disclosure='Full plan re-evaluation; unlock is eligibility, not job creation or dispatch',
    )


def successors(root, plan, tickets, integration):
    """Successors whose release conditions the exact integration now satisfies.

    A successor is eligible when its remaining conditions are met and at least
    one condition named this integration. No assignment, attempt or event is
    created; only the eligible identity set is returned.
    """
    named = []
    for key, ticket in tickets.items():
        items = current(ticket)
        hits = [pin for node_uuid, pin in _pins(items) if pin['entry_uuid'] == integration['uuid']]
        if not hits:
            continue
        row = ticket_release(root, plan, tickets, ticket)
        if row['state'] == 'unlocked':
            named.append(dict(ticket_uuid=key, integration_ref=ref(integration), conditions=row['conditions']))
    return named


# --- Plan Manager seed surface -------------------------------------------------

SPEC_AUTHORITY = ('spec_contract',)
BLOCKED_MARKERS = ('blocked', 'blocked_spec', 'authored_blocked_spec')


def seed_guard(tickets, operations=None):
    """Refuse mid-build content edits and authored blocked-SPEC seed content.

    Plan Manager seed edits are seed-scoped: the target ticket must still be a
    seed with no build activity, and may not author a blocked SPEC. This reuses
    the existing seed edit engine; it adds no parallel publisher.
    """
    for ticket in tickets:
        items = current(ticket)
        target = next((x for x in items if x['kind'] == 'ticket'), None)
        if target and target['body']['state'] != 'seed':
            fail('Plan Manager seed edit requires a seed ticket; mid-build/terminal content is refused', 'INVALID_TRANSITION')
    for sub in operations or []:
        body = sub.get('args', {}).get('body', {}) if 'args' in sub else {}
        kind = sub.get('args', {}).get('kind') if 'args' in sub else sub.get('kind')
        if kind == 'content' and isinstance(body, dict):
            if body.get('authority') in SPEC_AUTHORITY:
                fail('Plan Manager seed edit cannot author an approved/blocked SPEC', 'FORBIDDEN')
            marker = str(body.get('state', '')) + ' ' + str(body.get('title', '')).lower()
            if any(token in marker for token in BLOCKED_MARKERS):
                fail('Plan Manager seed edit cannot author a blocked SPEC', 'FORBIDDEN')


def layout(plan, tickets):
    """Recompute the four track paths from current layout placements.

    The result is a pure projection over the plan's ordered tracks and each
    ticket's placement content; it changes no stored bytes.
    """
    root = next(x for x in current(plan) if x['kind'] == 'plan')
    tracks = sorted(root['body']['tracks'], key=lambda x: x['order'])
    paths = {track['uuid']: dict(uuid=track['uuid'], title=track['title'], order=track['order'],
                                 opening=[], track=[], convergence=[]) for track in tracks}
    for key, ticket in tickets.items():
        placement = next((x for x in current(ticket) if x['kind'] == 'content'
                          and x['body']['title'] == 'Ticket placement'), None)
        if not placement:
            continue
        content = placement['body']['content']
        bucket = paths.get(content['track_uuid'])
        if not bucket:
            continue
        position = content.get('position', 'track')
        if position not in bucket:
            position = 'track'
        bucket[position].append(dict(ticket_uuid=key, slot=content.get('slot', 0)))
    for bucket in paths.values():
        for lane in ('opening', 'track', 'convergence'):
            bucket[lane].sort(key=lambda x: (x['slot'], x['ticket_uuid']))
    return dict(tracks=[paths[track['uuid']] for track in tracks], track_count=len(tracks),
                disclosure='Four-track layout recomputed from seed placement; presentation only')
