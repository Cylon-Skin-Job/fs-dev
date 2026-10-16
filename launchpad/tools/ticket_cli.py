#!/usr/bin/env python3
"""Public local JSON entry; emits one closed response and a stable exit status."""
import argparse
import json
import sys
from pathlib import Path
from core.commands import dispatch, REGISTRY
from core.schema import ContractError, named, validate



def migration_input(request):
    if not isinstance(request,dict):return False
    op=request.get('operation')
    if not isinstance(op,str):return False
    if op.startswith(('record.','intake.')):return True
    # Workflow/checklist definition imports are inert data; rejected unknown
    # extension namespaces retain the original input verbatim, never dropped.
    if op in ('workflow.edit_apply','checklist.reconcile_apply','workflow.edit_preview','checklist.reconcile_preview'):return True
    if op!='transaction.apply' or not isinstance(request.get('args'),dict):return False
    operations=request['args'].get('operations')
    if not isinstance(operations,list):return False
    relevant=False
    for operation in operations:
        if not isinstance(operation,dict) or not isinstance(operation.get('operation'),str):return False
        name=operation['operation'];is_record=name.startswith(('record.','intake.'));relevant|=is_record
        try:validate(operation.get('args'),REGISTRY[name]['args_schema'])
        except (ContractError,KeyError):return is_record
    return relevant


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--framework',required=True)
    parser.add_argument('--request',required=True)
    args=parser.parse_args()
    request={};published=False
    try:
        def pairs(items):
            value={}
            for key,item in items:
                if key in value:raise ContractError('INVALID_SCHEMA','Duplicate JSON key')
                value[key]=item
            return value
        content=sys.stdin.read() if args.request=='-' else Path(args.request).read_text()
        request=json.loads(content,object_pairs_hook=pairs,parse_constant=lambda x: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))
        root=Path(args.framework)
        if not root.is_absolute() or not root.is_dir() or root.is_symlink():
            raise ContractError('UNSUPPORTED_STORE','Framework must be an existing absolute local directory')
        result=dispatch(root.resolve(),request)
        published=result.get('result_kind')=='state_check' or result.get('result_kind')=='mutation' and result.get('commit_state')=='committed'
        named(result,'response.schema.json')
        code=0
    except (ContractError,ValueError,OSError,KeyError) as error:
        if not isinstance(error,ContractError):error=ContractError('INVALID_SCHEMA' if isinstance(error,(ValueError,KeyError)) else 'UNSUPPORTED_STORE',str(error))
        result=dict(interface_version=1,operation=request.get('operation','invalid') if isinstance(request,dict) else 'invalid',code=error.code,
                    commit_state='committed_unknown' if published else error.commit_state,message=error.message,affected_uuids=error.affected_uuids,actual_revisions=error.actual,
                    changed_fields=error.changed_fields,event_refs=error.event_refs,continuation=None,reconciliation='Inspect current generation and reconcile exact request/evidence.')
        code=3 if error.code=='UNSUPPORTED_STORE' else 2
        # Rejected migration/routing input is retained only for a verified granted writer.
        if error.code=='INVALID_SCHEMA' and migration_input(request):
            try:
                from core.store import resolve_plan,read_generation,digest,confined
                from core.authorization import bound
                from core.transaction import replace_json
                home=resolve_plan(root,request['scope']['plan_uuid']);plan,tickets,_=read_generation(home)
                bound(root,request,plan,tickets,write=True)
                report=confined(home,home/'.migration-reports'/(digest(request)+'.json'))
                if not report.exists():replace_json(report,dict(original_request=request,rejection=result,disposition='Rejected input retained; canonical selector unchanged'))
                result['reconciliation']+=' Original migration input/rejection retained at '+str(report)
            except (ContractError,ValueError,OSError,KeyError):
                result['reconciliation']+=' Migration report retention unavailable; caller must retain this original input and response.'

    from core.boundaries import before
    try:
        before('reply')
    except OSError as error:
        result=dict(interface_version=1,operation=request.get('operation','invalid'),code='UNSUPPORTED_STORE',commit_state='committed_unknown' if published else 'nonmutation',message=str(error),affected_uuids=[],actual_revisions={},changed_fields=[],event_refs=[],continuation=None,reconciliation='Retry exact request to reconcile original receipt.')
        code=3
    # Emit exactly the compact UTF-8 representation used by public byte budgets.
    sys.stdout.write(json.dumps(result,ensure_ascii=False,allow_nan=False,separators=(',',':')))
    return code


if __name__=='__main__':
    sys.exit(main())
