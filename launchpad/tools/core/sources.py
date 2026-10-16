"""Read exact plan/Wiki source metadata and derive registered reconciliation gaps."""
from pathlib import Path
import re
import subprocess
from datetime import datetime
from .schema import current,fail
from .store import digest,now,ref
from . import relations


def all_records(plan,tickets,history=False):
    return [x for snap in [plan]+list(tickets.values()) for x in (snap['revisions'] if history else current(snap))]


def wiki(body,assignment):
    base=Path(assignment['body']['source_checkout']).resolve();declared=body['source_checkout'];path=Path(body['locator'])
    if not declared or Path(declared).resolve()!=base or not body['source_ref']:return None,'Exact assigned checkout/ref absent or mismatched'
    if not path.is_absolute():path=base/path
    if path.is_symlink() or not path.resolve().is_relative_to(base):return None,'Wiki path outside assigned checkout'
    try:
        def git(*args):return subprocess.check_output(['git','-C',str(base),*args],stderr=subprocess.DEVNULL,text=True,timeout=5).strip()
        if Path(git('rev-parse','--show-toplevel')).resolve()!=base:return None,'Source checkout is not exact Git root'
        head=git('rev-parse','HEAD');selected=body['source_ref'];assigned=assignment['body']['source_branch']
        try:branch=git('symbolic-ref','--short','HEAD')
        except subprocess.SubprocessError:branch=None
        resolved=git('rev-parse','--verify',assigned);canonical=git('rev-parse','--symbolic-full-name',assigned)
        if canonical.startswith('refs/heads/'):
            named=canonical.removeprefix('refs/heads/')
            if branch!=named or selected not in (named,canonical,head):return None,'Wrong source branch/ref: actual '+str(branch)+'; assigned '+assigned
        elif resolved!=head or assignment['body']['source_head']!=resolved or selected not in (assigned,resolved):return None,'Exact assigned source ref/head differs from checked-out bytes'
        if git('rev-parse',selected)!=head:return None,'Source ref differs from checked-out bytes'
        raw=path.read_bytes();text=raw.decode('utf-8')
        match=re.match(r'\A---\n(.*?)\n---(?:\n|\Z)',text,re.S)
        if not match:return None,'Wiki metadata frontmatter missing or unclosed'
        front=match[1].splitlines();metadata=False;stamps=[]
        if sum(line=='metadata:' for line in front)!=1:return None,'Wiki metadata section missing or ambiguous'
        for line in front:
            if line and not line[0].isspace():metadata=line.strip()=='metadata:'
            elif metadata:
                match=re.fullmatch(r'  last-modified:\s*(.+)',line)
                if match:
                    scalar=match[1].strip()
                    if not scalar:return None,'Wiki metadata stamp empty'
                    if scalar[0] in ('"',"'"):
                        if len(scalar)<2 or scalar[-1]!=scalar[0] or scalar[0] in scalar[1:-1]:return None,'Malformed Wiki metadata scalar quoting'
                        scalar=scalar[1:-1]
                    elif '"' in scalar or "'" in scalar:return None,'Malformed Wiki metadata scalar quoting'
                    stamps.append(scalar)
        if len(stamps)!=1:return None,'Wiki metadata.last-modified missing or ambiguous'
        stamp=stamps[0];parsed=datetime.fromisoformat(stamp.replace('Z','+00:00'))
        if parsed.tzinfo is None:return None,'Wiki metadata.last-modified lacks timezone'
        import hashlib
        return dict(revision=head,stamp=stamp,sha256=hashlib.sha256(raw).hexdigest(),lifecycle='live',assigned_ref=assigned,assigned_baseline_head=assignment['body']['source_head'],actual_branch=branch),None
    except (OSError,ValueError,UnicodeError,subprocess.SubprocessError):return None,'Wiki/source checkout unavailable or malformed metadata'


def observe(reference,plan,tickets,assignment):
    b=reference['body'];used=dict(revision=b['used_revision'],sha256=b['used_sha256'],stamp=b['used_stamp'])
    result=dict(reference_uuid=reference['uuid'],reference_revision_uuid=reference['revision_uuid'],observed_at=now(),observed_revision=None,observed_stamp=None,observed_sha256=None,freshness='unverified',reason='',used=used,historical_pin_available=False,source_lifecycle=None)
    if b['target_kind']=='external':result.update(freshness='not_checked',reason='Generic external sources are not automatically checked');return result
    if b['target_kind']=='wiki_metadata':observed,reason=wiki(b,assignment)
    else:
        target=next((x for x in all_records(plan,tickets) if x['uuid']==b['locator']),None)
        retained=[x for x in all_records(plan,tickets,True) if x['uuid']==b['locator']]
        result['historical_pin_available']=any(x['revision_uuid']==b['used_revision'] and digest(x)==b['used_sha256'] for x in retained)
        result['source_lineage']=relations.replacement(all_records(plan,tickets),b['locator'])
        observed=dict(revision=target['revision_uuid'],stamp=target['last_updated'],sha256=digest(target),lifecycle=target['lifecycle']) if target else None
        reason='Plan-managed target missing from captured generation'
    if not observed:result['reason']=reason;return result
    result.update(observed_revision=observed['revision'],observed_stamp=observed['stamp'],observed_sha256=observed['sha256'],source_lifecycle=observed['lifecycle'])
    if b['target_kind']=='wiki_metadata':result.update(assigned_source_ref=observed['assigned_ref'],assigned_baseline_head=observed['assigned_baseline_head'],actual_source_branch=observed['actual_branch'])
    if result.get('source_lineage',{}).get('fully_superseded'):result.update(freshness='changed',reason='Source fully superseded; exact retained pin and replacements disclosed')
    elif observed['lifecycle']!='live':result.update(freshness='changed',reason='Source '+observed['lifecycle']+'; retained pin disclosed separately')
    elif not b['used_sha256'] or not b['used_revision'] or not b['used_stamp']:result['reason']='Source-used version/hash/stamp incomplete'
    elif any(observed[k]!=used[k] for k in ('revision','sha256','stamp')):
        reason='Source revision/hash/stamp differs from source-used version'
        if observed['stamp']==used['stamp']:reason+='; equal stamp cannot certify bytes'
        else:
            try:
                if datetime.fromisoformat(observed['stamp'].replace('Z','+00:00'))<datetime.fromisoformat(used['stamp'].replace('Z','+00:00')):reason+='; older/restored source'
            except (ValueError,TypeError):reason+='; source-used timestamp unverified'
        if b['target_kind']=='plan_entry':
            used_index=next((i for i,x in enumerate(retained) if x['revision_uuid']==b['used_revision'] and digest(x)==b['used_sha256']),None)
            if used_index is not None and any(x['body']==target['body'] and x['kind']==target['kind'] and x['extensions']==target['extensions'] for x in retained[used_index+1:]):reason+='; restored older retained payload (new current revision)'
        result.update(freshness='changed',reason=reason)
    else:result.update(freshness='current',reason='Exact source-used revision/hash/stamp matches')
    return result


def obligations(reference,observation,items,retained):
    b=reference['body'];ids=set(b['supported_scope'])
    versions={x['revision_uuid'] for x in retained if x['uuid']==b['locator']};hashes={digest(x) for x in retained if x['uuid']==b['locator']}
    def consumes(pin):
        return pin['locator']==b['locator'] or b['target_kind']=='plan_entry' and (pin['revision'] in versions or pin['sha256'] in hashes or pin['native_ref']==b['locator'])
    ids|={x['body']['from_uuid'] for x in items if x['kind']=='edge' and x['body']['edge_kind']=='references' and x['body']['to_uuid']==reference['uuid']}
    ids|={x['uuid'] for x in items if x['uuid'] not in (reference['uuid'],b['locator']) and any(consumes(p) for p in x['source_refs'])}
    rows=[]
    for uuid in sorted(ids):
        item=next((x for x in items if x['uuid']==uuid and x['lifecycle']=='live'),None)
        if not item:rows.append(dict(entry_uuid=uuid,state='unverified',reason='Registered current dependent missing/inactive'));continue
        pins=[x for x in item['source_refs'] if consumes(x)]
        latest=pins[-1] if pins else None
        matched=bool(latest and not observation.get('source_lineage',{}).get('fully_superseded') and observation['source_lifecycle']=='live' and observation['freshness'] not in ('unverified','not_checked') and latest['sha256']==observation['observed_sha256'] and latest['revision']==observation['observed_revision'])
        # An exact current references edge can reconcile plan sources without a
        # filesystem source envelope. Old endpoint pins remain historical.
        edges=[x for x in items if x['kind']=='edge' and x['body']['edge_kind']=='references' and x['body']['from_uuid']==uuid and x['body']['to_uuid']==reference['uuid']]
        matched|=observation['freshness']=='current' and any(x['body']['from_revision_uuid']==item['revision_uuid'] and x['body']['to_revision_uuid']==reference['revision_uuid'] for x in edges)
        rows.append(dict(entry_uuid=uuid,current_ref=ref(item),state='reconciled' if matched else 'needs_reconciliation',used_source=latest,reason='Exact current source pin/disposition retained' if matched else 'Main must reconcile this exact current entry with source pin/disposition'))
    return rows


def details(reference,plan,tickets,assignment,items):
    observation=observe(reference,plan,tickets,assignment);rows=obligations(reference,observation,all_records(plan,tickets),all_records(plan,tickets,True))
    return dict(source=observation,reconciliation=dict(coverage='Registered current consumers in captured plan only; unknown consumers not claimed',registered_count=len(rows),unreconciled_count=sum(x['state']!='reconciled' for x in rows),entries=rows))


def validate_reference(item,items,captured,expected):
    if item['kind']!='reference' or captured.get(item['uuid'])==item:return
    by_id={x['uuid']:x for x in items};body=item['body'];keys=list(body['supported_scope'])
    if len(keys)!=len(set(keys)):fail('Duplicate reference supported scope')
    if body['target_kind']=='plan_entry' and body['locator'] in by_id:keys.append(body['locator'])
    for key in keys:
        if key not in by_id:fail('Reference target/consumer outside selected ticket','MISSING_EVIDENCE')
        if key in captured and expected.get(key)!=captured[key]['revision_uuid']:fail('Exact reference target/consumer expectation required','REVISION_CONFLICT')


def projection(root,plan,tickets):
    """Capture current read-only source statuses in this immutable rendered generation."""
    from .store import evidence
    actors={x['uuid']:x for x in current(plan) if x['kind']=='actor'};result={}
    for key,ticket in tickets.items():
        items=current(ticket);details_by_id={}
        for item in items:
            if item['kind']!='reference':continue
            actor=actors.get(item['writer']['actor_uuid']);assignment=None
            try:
                assignments=[evidence(root,pin) for pin in actor['body']['assignment_refs']] if actor else []
                home=str((Path(root)/next(x for x in current(plan) if x['kind']=='plan')['body']['current_home']).resolve())
                matching=[x for x in assignments if x['kind']=='assignment' and home in x['body']['write_paths']]
                assignment=matching[0] if len(matching)==1 else None
            except Exception:pass
            if assignment:details_by_id[item['uuid']]=details(item,plan,tickets,assignment,items)
            else:details_by_id[item['uuid']]=dict(source=dict(freshness='unverified',reason='Source assignment unavailable in captured view'),reconciliation=dict(coverage='Registered consumers only',registered_count=0,unreconciled_count=0,entries=[]))
        result[key]=details_by_id
    return result
