"""Describe the closed registry without advertising unavailable operations."""
from .schema import schema,fail

REGISTRY={x['operation']:x for x in schema('operations.json')['operations']}


def describe(request,actor,installed):
    args=request['args'];op=request['operation']
    if op=='catalog.list':
        rows=list(REGISTRY.values())
        if args.get('category'):rows=[x for x in rows if x['operation'].split('.')[0]==args['category']]
        if args.get('role'):
            if args['role']!=actor['body']['role']:fail('Role outside bound actor','FORBIDDEN')
            rows=[x for x in rows if x['grant']=='read' or x['operation'] in actor['body']['granted_operations']]
        return [dict(operation=x['operation'],name=x['operation'],purpose=x['result'],tool=x['tool'],grant=x['grant'],version=x['version'],arguments=x['args_schema']['required'],failures=x['errors'],availability='installed' if x['operation'] in installed else 'unavailable') for x in rows]
    name=args['name']
    if name in REGISTRY:return {**REGISTRY[name],'availability':'installed' if name in installed else 'unavailable'}
    if name in ('record.schema.json','request.schema.json','response.schema.json','snapshot.schema.json','extensions.json'):return schema(name)
    fail('Unknown schema/operation','UNSUPPORTED_OPERATION')
