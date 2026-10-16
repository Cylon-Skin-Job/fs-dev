"""Validate exact saved runtime facts without claiming native attestation."""
from pathlib import Path
from .schema import fail, current
from .store import evidence, find_ref, ref, digest, file_hash
from . import authorization

# Autonomous grants are distinct from inline contributions. Evaluators cannot
# repair subjects or accept their own results; later review operations add facts.
ATTEMPT_GRANTS={'assignment.claim','run.start_record','run.progress_record','run.summary_set',
                'run.checkpoint','run.block','run.pause','run.resume_record','run.handoff_submit',
                'run.return_record','state.check','transaction.apply'}
EVALUATION_GRANTS=ATTEMPT_GRANTS|{'review.attempt_add','review.result_record',
                               'review.finding_add','review.finding_disposition','review.recheck_record'}


def resolve(root,plan,tickets,pin):
    known=plan['revisions']+[x for t in tickets.values() for x in t['revisions']]
    return find_ref(plan,tickets,pin) if any(x['uuid']==pin['entry_uuid'] for x in known) else evidence(root,pin)


def procedure(job):
    body=job['body'];path=Path(body['procedure_path'])
    if not path.is_absolute() or path.is_symlink() or not path.is_file() or file_hash(path)!=body['procedure_sha256']:
        fail('Stored job procedure bytes are unavailable/changed','SOURCE_UNVERIFIED')


def actor_for(plan,identity):
    actor=next((x for x in current(plan) if x['uuid']==identity and x['kind']=='actor'),None)
    if not actor or actor['body']['state']!='active':fail('Exact active registered actor required','FORBIDDEN')
    if actor['body']['runtime_kind']=='ephemeral':fail('Unknown runtime cannot autonomously claim/start','SOURCE_UNVERIFIED')
    return actor


def runtime_identity(actor):
    """The actual underlying runtime identity behind an actor binding.

    A canonical UUID identifies a record, not a runtime. Two actors can share
    the same real runtime_kind/host_id/runtime_id while differing in UUID; the
    original freshness contract compares the runtime, so null is treated as the
    explicit value it is for ephemeral unknown-native actors.
    """
    body=actor['body']
    return (body.get('runtime_kind'),body.get('host_id'),body.get('runtime_id'))


def same_runtime(left,right):
    return runtime_identity(left)==runtime_identity(right)


def registered_actors(plan,identities):
    """Return current plan actors whose UUID appears in identities, preserving order."""
    wanted=set(identities)
    return [x for x in current(plan) if x['kind']=='actor' and x['uuid'] in wanted]


def distinct_runtimes(actors):
    """True only when every actor has a different underlying runtime identity."""
    seen=set()
    for actor in actors:
        identity=runtime_identity(actor)
        if identity in seen:return False
        seen.add(identity)
    return True


def claimant(root,plan,job,actor,binding_pin):
    authorization.validate_assignment(actor,job)
    body=actor['body']
    if body['binding_evidence_ref']!=binding_pin or ref(job) not in body['assignment_refs']:
        fail('Claim must use the exact registered job and runtime binding','FORBIDDEN')
    proof=authorization.host_evidence(root,body)
    if proof.get('source_checkout')!=job['body']['source_checkout'] or proof.get('source_branch')!=job['body']['source_branch'] or proof.get('source_head')!=job['body']['source_head']:
        fail('Runtime checkout/branch/revision differs from stored job','SOURCE_UNVERIFIED')
    if body['runtime_kind']=='child' and body['parent_actor_uuid']!=job['body']['manager_uuid']:
        fail('Actual child parent differs from job manager','FORBIDDEN')
    procedure(job)
    return proof


def proof(root,plan,tickets,pin,expected,kind,job,actor,attempt=None):
    item=authorization.dependency(root,plan,tickets,pin,expected);body=item['body'];data=body.get('content')
    if item['kind']!='content' or body.get('authority')!='active_code_constraint' or body.get('state')!='active' or not isinstance(data,dict):
        fail('Saved actual runtime evidence required','MISSING_EVIDENCE')
    if data.get('proof_kind')!=kind or data.get('assignment_ref')!=ref(job):
        fail('Runtime proof names another job/revision or transition','SOURCE_UNVERIFIED')
    a=actor['body']
    if any(data.get(k)!=v for k,v in {'actor_uuid':actor['uuid'],'runtime_kind':a['runtime_kind'],'runtime_id':a['runtime_id']}.items()):
        fail('Runtime proof does not match actual bound actor','SOURCE_UNVERIFIED')
    if attempt and data.get('attempt_ref')!=ref(attempt):fail('Runtime proof names another attempt/revision','SOURCE_UNVERIFIED')
    if data.get('provenance') not in ('trusted-local-fixture','actual-runtime-tool'):
        fail('Runtime proof must disclose actual tool versus fixture provenance','SOURCE_UNVERIFIED')
    if data['provenance']=='actual-runtime-tool' and not isinstance(data.get('tool_result'),dict):
        fail('Actual runtime proof must retain the raw tool result','MISSING_EVIDENCE')
    return data


def start_proof(root,plan,tickets,pin,expected,job,actor,attempt):
    data=proof(root,plan,tickets,pin,expected,'start_ack',job,actor,attempt)
    if data.get('acknowledged') is not True or data.get('loaded_assignment_sha256')!=digest(job) or data.get('loaded_procedure_sha256')!=job['body']['procedure_sha256'] or data.get('source_pins')!=job['body']['source_refs']:
        fail('Actual loaded briefing acknowledgment missing/different','MISSING_EVIDENCE')
    return data


def inactive_proof(root,plan,tickets,pin,expected,job,actor,attempt,manager):
    item=authorization.dependency(root,plan,tickets,pin,expected);data=item['body'].get('content',{})
    kind=data.get('proof_kind')
    if kind not in ('inactive','interrupt_ack'):fail('Inactive or acknowledged interruption required','STOP_UNCONFIRMED')
    data=proof(root,plan,tickets,pin,expected,kind,job,actor,attempt)
    if data.get('manager_uuid')!=manager['uuid'] or (data.get('inactive') is not True if kind=='inactive' else data.get('acknowledged') is not True):
        fail('Manager replacement stop proof is unconfirmed','STOP_UNCONFIRMED')
    return data
