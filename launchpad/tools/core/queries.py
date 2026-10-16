"""Bound explicit reads to a retained generation and closed field projection."""
import base64
import json
from .schema import current, schema, fail, ContractError
from .store import digest, encode, read_generation
from . import relations, sources, coverage, decisions

OPERATIONS={'query.filter','query.search','query.project','query.page','query.explain','query.count','query.group_count','query.distinct','query.exists','record.get','record.head','record.exists','record.history','record.diff','record.related'}
BUDGET=16384
DEFAULT=['uuid','revision_uuid','kind','title','state','last_updated','writer','lifecycle']


def fields(kind):
    return set(schema('record.schema.json')['properties'])|set(schema('record.schema.json')['$defs'][kind]['properties'])|{'body.'+k for k in schema('record.schema.json')['$defs'][kind]['properties']}


def value(item,key):
    if key not in fields(item['kind']):fail('Unregistered projected/filter/sort field: '+key)
    return item.get(key,item['body'].get(key.removeprefix('body.')))


def row(item,projection=None,budget=BUDGET-1500):
    selected=projection if projection is not None else [k for k in DEFAULT if k in fields(item['kind'])]
    selected=list(dict.fromkeys(selected+['lifecycle']))
    result=dict(uuid=item['uuid'],revision_uuid=item['revision_uuid'],kind=item['kind'],fields={k:value(item,k) for k in selected},omitted_fields=sorted(set(item)-set(selected)))
    # Oversize explicit detail stays visible as an omission, never silently cuts text.
    for key in sorted(result['fields'],key=lambda k:len(encode(result['fields'][k])),reverse=True):
        if len(encode(result))<=budget:break
        if key in ('uuid','revision_uuid','kind','lifecycle'):continue
        result['fields'].pop(key);result['omitted_fields'].append(key)
    return result


def owned(plan,tickets,scope,history=False):
    selected=scope.get('ticket_uuid')
    if selected:
        if selected not in tickets:fail('Exact selected ticket missing','MISSING_EVIDENCE')
        snapshots=[tickets[selected]]
    else:snapshots=[plan]+list(tickets.values())
    return [item for snap in snapshots for item in (snap['revisions'] if history else current(snap))]


def filtered(items,args):
    kind=args.get('collection');items=[x for x in items if not kind or x['kind']==kind]
    # Validate even empty collections, not only fields encountered in rows.
    if kind:
        requested=args.get('fields',[])+[x['field'] for x in args.get('where',[])]+([args['sort']['field']] if 'sort' in args else [])+([args['group_field']] if 'group_field' in args else [])
        if set(requested)-fields(kind):fail('Unknown collection field')
    def matches(item):
        for term in args.get('where',[]):
            found=value(item,term['field']);wanted=term['value'];op=term['operator']
            if op=='eq' and found!=wanted:return False
            if op=='in' and (not isinstance(wanted,list) or found not in wanted):return False
            if op=='contains-text' and str(wanted).casefold() not in str(found).casefold():return False
        return 'text' not in args or args['text'].casefold() in json.dumps(item['body'],ensure_ascii=False).casefold()
    return [x for x in items if matches(x)]


def response(request,plan,details=None):
    return dict(interface_version=1,operation=request['operation'],captured_plan_revision_uuid=plan['root_revision_uuid'],high_water=plan['commit_seq'],scope=request['scope'],gaps=[],continuation=None,result_kind='read',rows=[],details=details,remaining=0)


def fingerprint(request):
    return digest(dict(operation=request['operation'],scope=request['scope'],args={k:v for k,v in request['args'].items() if k!='cursor'}))


def token(payload):return base64.urlsafe_b64encode(encode(dict(payload=payload,sha256=digest(payload)))).decode()


def cursor(request,home,plan,tickets):
    raw=request['args'].get('cursor')
    if not raw:return plan,tickets,0,None
    try:
        saved=json.loads(base64.urlsafe_b64decode(raw));p=saved['payload']
        if set(p)!={'generation','fingerprint','offset','last'} or saved['sha256']!=digest(p) or p['fingerprint']!=fingerprint(request) or not isinstance(p['offset'],int) or isinstance(p['offset'],bool) or p['offset']<1:raise ValueError()
        plan,tickets,_=read_generation(home,p['generation'])
        return plan,tickets,p['offset'],p['last']
    except ContractError as error:
        if error.code=='MISSING_REVISION':raise
        fail('Retained cursor generation unavailable','MISSING_REVISION')
    except (ValueError,TypeError,KeyError):fail('Cursor does not match exact query/scope','CURSOR_INVALID')


def page(request,plan,items,offset=0,last=None,details=None):
    result=response(request,plan,details);args=request['args'];sort=args.get('sort',dict(field='uuid',direction='asc'))
    def ordered(v):
        if v is None:return (0,'')
        if isinstance(v,bool):return (1,int(v))
        if isinstance(v,(int,float)):return (2,v)
        if isinstance(v,str):return (3,v)
        return (4,encode(v))
    items=sorted(items,key=lambda x:(ordered(value(x,sort['field'])),x['uuid'],x['revision_uuid']),reverse=sort['direction']=='desc')
    if offset>len(items) or offset and digest(items[offset-1])!=last:fail('Cursor position changed','CURSOR_INVALID')
    end=offset
    def candidate(projected,next_offset,item):
        trial={**result,'rows':result['rows']+[projected],'gaps':list(result['gaps']),'remaining':len(items)-next_offset}
        if args.get('fields') and set(args['fields'])-set(projected['fields']):trial['gaps'].append('Oversize fields omitted for '+item['uuid']+'; retained exact canonical revision available')
        trial['continuation']=token(dict(generation=plan['root_revision_uuid'],fingerprint=fingerprint(request),offset=next_offset,last=digest(item))) if trial['remaining'] else None
        return trial
    for item in items[offset:offset+args.get('limit',20)]:
        projected=row(item,args.get('fields'));trial=candidate(projected,end+1,item)
        if len(encode(trial))>BUDGET:
            if result['rows']:break
            # An otherwise valid single row must advance even when its explicit detail
            # plus cursor/gap overhead exceeds the complete public response budget.
            projected=row(item,args.get('fields'),BUDGET//2);trial=candidate(projected,end+1,item)
            if len(encode(trial))>BUDGET:fail('Projected identity exceeds public response bound')
        result=trial;end+=1
    return result


def bound_details(details):
    if len(encode(details))<=BUDGET//3:return details
    omissions=[]
    def lists(value):
        if not isinstance(value,dict):return
        for key in list(value):
            values=value[key]
            if isinstance(values,list):
                value[key+'_count']=len(values)
                while values and len(encode(details))>BUDGET//3:values.pop();omissions.append(key)
            elif isinstance(values,dict):lists(values)
    lists(details)
    if len(encode(details))>BUDGET//3:details={key:value for key,value in details.items() if key in ('selector','direction','depth')};omissions.append('oversize source/lineage details')
    details['disclosure_gap']='Derived disclosure bounded: '+', '.join(sorted(set(omissions)))+'; inspect exact reference/consumer or retained canonical generation'
    return details


def read(home,request,plan,tickets,assignment=None):
    plan,tickets,offset,last=cursor(request,home,plan,tickets);op=request['operation'];args=request['args'];history=args.get('include_history',request['scope'].get('include_history',False))
    all_items=owned(plan,tickets,request['scope'],history)
    if op.startswith('query.'):
        items=all_items if history else [x for x in all_items if x['lifecycle']=='live']
        if not history:
            hidden={x['uuid'] for x in all_items if relations.replacement(all_items,x['uuid'])['fully_superseded']}
            items=[x for x in items if x['uuid'] not in hidden]
        items=filtered(items,args)
        if op in {'query.count','query.exists'}:return response(request,plan,dict(count=len(items),exists=bool(items),selected_scope=request['scope']))
        if op in {'query.group_count','query.distinct'}:
            groups={}
            for item in items:
                val=value(item,args['group_field']);key=encode(val).decode();groups.setdefault(key,dict(value=val,count=0))['count']+=1
            values=list(groups.values());result=response(request,plan,dict(groups=[],count=len(items),selected_scope=request['scope']))
            for group in values:
                if len(encode(result))+len(encode(group))>BUDGET-1000 or len(result['details']['groups'])>=100:break
                result['details']['groups'].append(group if op=='query.group_count' else group['value'])
            result['remaining']=len(values)-len(result['details']['groups'])
            if result['remaining']:result['gaps'].append('Aggregate groups exceed public bound; narrow where explicitly')
            return result
        return page(request,plan,items,offset,last,dict(default_limit=20,max_limit=100,budget_bytes=BUDGET,include_history=history) if op=='query.explain' else None)
    exact=owned(plan,tickets,request['scope'],True);matches=[x for x in exact if x['uuid']==args['uuid']]
    live=[x for x in owned(plan,tickets,request['scope']) if x['uuid']==args['uuid']]
    if op=='record.related':
        if not live:fail('Related subject not in selected scope','MISSING_EVIDENCE')
        edges=[x for x in owned(plan,tickets,request['scope']) if x['kind']=='edge' and x['lifecycle']=='live' and x['body']['edge_kind'] in args.get('edge_kinds',['references','derived_from','supersedes','dependency','repair_of','coverage_destination'])]
        inverse=args.get('direction','forward')=='inverse';source='to_uuid' if inverse else 'from_uuid';dest='from_uuid' if inverse else 'to_uuid';front={args['uuid']};seen=set(front);related=[]
        for _ in range(args.get('depth',1)):
            target={x['body'][dest] for x in edges if x['body'][source] in front}-seen;seen|=target;front=target
            related.extend(x for x in owned(plan,tickets,request['scope']) if x['uuid'] in target)
        lineages=[dict(subject_uuid=x['uuid'],**relations.replacement(owned(plan,tickets,request['scope']),x['uuid'])) for x in related]
        result=page(request,plan,related,details=bound_details(dict(direction='inverse' if inverse else 'forward',depth=args.get('depth',1),related_lineage=lineages)))
        if result['remaining']:
            result['continuation']=None;result['gaps'].append('Related bound reached; narrow subject/edge kinds or raise limit explicitly up to100')
        return result
    if args.get('revision_uuid'):matches=[x for x in matches if x['revision_uuid']==args['revision_uuid']]
    elif op!='record.history':matches=live
    if op=='record.exists':return response(request,plan,dict(exists=bool(matches) and (bool(args.get('revision_uuid')) or matches[-1]['lifecycle']!='deleted'),lifecycle=matches[-1]['lifecycle'] if matches else None))
    if not matches:fail('Record missing from exact selected scope','MISSING_REVISION' if args.get('revision_uuid') else 'MISSING_EVIDENCE')
    if op=='record.diff':
        other=next((x for x in exact if x['uuid']==args['uuid'] and x['revision_uuid']==args['compare_revision_uuid']),None)
        if not other:fail('Comparison revision missing','MISSING_REVISION')
        # The closed diff interface has no cursor. Return both exact comparison
        # identities in one bounded response, explicitly omitting oversize details.
        result=response(request,plan,bound_details(dict(changed_fields=[k for k in matches[0] if matches[0][k]!=other[k]],lineage=relations.replacement(owned(plan,tickets,request['scope']),args['uuid']))))
        for item in (matches[0],other):
            projected=row(item,args.get('fields'),max(1024,(BUDGET-len(encode({**result,'rows':[]}))-1200)//2));result['rows'].append(projected)
            if args.get('fields') and set(args['fields'])-set(projected['fields']):result['gaps'].append('Oversize comparison fields omitted for '+item['revision_uuid']+'; inspect this exact pin through record.get or narrow fields')
        return result
    details=None
    if op in ('record.get','record.head','record.history'):
        # History rows retain every version; its singular disclosure follows the
        # captured current binding unless the caller selects an exact revision.
        current_items=owned(plan,tickets,request['scope']);item=matches[0] if args.get('revision_uuid') else live[0]
        details=dict(selector='pinned' if args.get('revision_uuid') else 'current',lineage=relations.replacement(current_items,item['uuid']))
        if item['kind']=='reference' and assignment:details.update(sources.details(item,plan,tickets,assignment,current_items))
        if item['kind']=='ticket':
            details['source_ledger']=coverage.ledger(home.parents[1],plan,tickets,current_items)
            details['ledger_ticket_revision_uuid']=next(x for x in current_items if x['kind']=='ticket')['revision_uuid']
            details['ledger_scope']='Current captured Ticket only; not a retained pinned Ticket ledger'
        if item['kind']=='source_item':details['source_ledger']={**coverage.ledger(home.parents[1],plan,tickets,current_items),'entries':[x for x in coverage.ledger(home.parents[1],plan,tickets,current_items)['entries'] if x['source_item_uuid']==item['uuid']]}
        if item['kind']=='content':
            state=decisions.projection(current_items,exact).get(item['uuid'])
            if state:details['current_approval']={'current_revision_uuid':next(x for x in current_items if x['uuid']==item['uuid'])['revision_uuid'],**state}
        details=bound_details(details)
    return page(request,plan,matches,offset,last,details)
