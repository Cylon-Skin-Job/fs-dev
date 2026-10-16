"""Append attributable saved turn summaries with exact committed mutation facts."""
from .schema import fail, current
from .store import envelope, ref
from . import seed, authorization, discussions


def append(root,args,actor,assignment,plan,tickets,ticket,items,expected):
    discussion=next((x for x in items if x['uuid']==args['discussion_uuid']),None)
    if not discussion or discussion['kind']!='discussion' or discussion['body']['state']!='open':
        fail('An open selected discussion is required','INVALID_TRANSITION')
    discussions.expect(discussion,expected)
    parent=actor['body']['parent_actor_uuid'];front=discussion['body']['actor_uuid']
    if actor['uuid']!=front and (parent!=front or actor['body']['runtime_kind']!='child'):
        fail('Only its actual fronting writer or registered inline child may append','FORBIDDEN')
    if assignment['body']['ticket_uuid'] in tickets and assignment['body']['ticket_uuid']!=ticket['root_uuid']:
        fail('Journal outside assigned ticket','FORBIDDEN')
    for pin in args['recorded_item_refs']:
        receipt=authorization.dependency(root,plan,tickets,pin,expected)
        if receipt['kind']!='receipt' or receipt['body']['result']!='committed':
            fail('Recorded mutation items must pin exact committed receipts','MISSING_EVIDENCE')
        # A receipt is a fact for this selected ticket or selected plan, never
        # a license to import a different ticket's unseen mutation details.
        allowed={x['uuid'] for x in items}|{x['uuid'] for x in current(plan)}
        if any(p['entry_uuid'] not in allowed for p in receipt['body']['changed_refs']):
            fail('Recorded receipt belongs outside selected ticket','FORBIDDEN')
    native=args.get('native_locator')
    if native:authorization.native_locator(root,actor,native)
    gaps=list(args['gaps'])
    if native is None and 'Native history unavailable; saved journal summaries only' not in gaps:
        gaps.append('Native history unavailable; saved journal summaries only')
    seq=plan['commit_seq']+1
    ordinal=1+max((x['body']['event_ordinal'] for x in items if x['kind'] in ('journal_entry','event') and x['body']['commit_seq']==seq),default=-1)
    body=dict(discussion_uuid=discussion['uuid'],focus=args['focus'],summary=args['summary'],recorded_items=args['recorded_item_refs'],
              capture_only_items=args['capture_only_items'],open_threads=args['open_threads'],source_native_locator=native,gaps=gaps,commit_seq=seq,event_ordinal=ordinal)
    item=envelope('journal_entry',body,seed.writer(actor));items.append(item)
    if actor['uuid']==front and parent is None:
        discussion['body']['latest_direct_entry_ref']=ref(item);discussions.revise(discussion,actor)
    return item


def readout(discussion,items,plan_records):
    """Saved log and receipt payloads; no native transcript reconstruction."""
    body=discussion['body'];entries=sorted((x for x in items if x['kind']=='journal_entry' and x['body']['discussion_uuid']==discussion['uuid']),key=lambda x:(x['body']['commit_seq'],x['body']['event_ordinal']))
    receipts={x['revision_uuid']:x for x in plan_records if x['kind']=='receipt'}
    logs=[]
    for entry in entries:
        b=entry['body'];recorded=[]
        for pin in b['recorded_items']:
            receipt=receipts.get(pin['revision_uuid'])
            recorded.append(dict(receipt_ref=pin,receipt=receipt if receipt and ref(receipt)==pin else None,gap=None if receipt and ref(receipt)==pin else 'Exact receipt unavailable in captured view'))
        logs.append(dict(entry_ref=ref(entry),writer=entry['writer'],Focus=b['focus'],Summary=b['summary'],Recorded=recorded,
                         capture_only_items=b['capture_only_items'],Threads=b['open_threads'],source_native_locator=b['source_native_locator'],gaps=b['gaps'],commit_seq=b['commit_seq'],event_ordinal=b['event_ordinal']))
    checkpoint=next((x for x in items if body['accepted_checkpoint_ref'] and ref(x)==body['accepted_checkpoint_ref']),None)
    covered=checkpoint['body']['coverage_refs'] if checkpoint else []
    tail=[ref(x) for x in entries if ref(x) not in covered]
    return dict(checkpoint=checkpoint,uncovered_entry_refs=tail,discussion_ref=ref(discussion),state=body['state'],accepted_checkpoint_ref=body['accepted_checkpoint_ref'],logs=logs,
                coverage='Saved journal entries only; native transcript and history cursor are separate')
