"""Root-owned review provenance repair; no product or runtime operations."""
import copy
import hashlib
import json
import stat
from datetime import datetime, timezone
from pathlib import Path

C = Path('/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control')
E = C / 'planning/commit-supervisor/execution'
now = datetime.now(timezone.utc).isoformat()

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def write(name, value, frozen=False):
    p = E / name
    assert not p.exists(), p
    p.write_text(json.dumps(value, indent=2) + '\n')
    if frozen:
        p.chmod(0o444)
    return p

def pin(p):
    p = Path(p)
    s = p.lstat()
    return {'path': str(p), 'exists': True, 'kind': 'file', 'mode': s.st_mode,
            'size': s.st_size, 'sha256': sha(p)}

raw = E / 'SPEC-final-review-1.raw.md'
assert sha(raw) == 'b442816d3df04f7bda5433597518a775d7b08ee5071670339ba2c44c3f81027f'
first = json.loads((E / 'SPEC-final-review-lifecycle.json').read_text())
first.update({'terminal_observed_at': now, 'native_state': 'completed',
              'native_terminal_result': 'REVIEW_COMPLETE / FINDINGS concerning review-gate provenance',
              'raw_report': pin(raw), 'gate_admissible': False,
              'finding': 'R-P01: actual excluded conversation exposure in S5 inventory output',
              'raw_capture': {'method': 'exact native agent_message payload from verified root rollout',
                              'rollout': '/Users/rccurtrightjr./.codex/sessions/2026/10/04/rollout-2026-10-04T00-58-05-01a105eb-8add-7e12-a454-a96b64465cca.jsonl',
                              'line': 11132, 'timestamp': '2026-10-05T04:06:59.768Z',
                              'message_id': 'amsg_01a10a3e-55b8-7fe0-ad91-434664548c6e'},
              'children': [], 'close_agent': 'Unavailable; no closure claimed',
              'repair': 'Different fresh reviewer with strict file whitelist; no product change or test replay'})
(E / 'SPEC-final-review-lifecycle.json').write_text(json.dumps(first, indent=2) + '\n')

cut = E / 'S5/cutover-inventory.json'
native = E / 'S5/thread-inventory.json'
cd = json.loads(cut.read_text())
nd = json.loads(json.loads(native.read_text())['content'][0]['text'])
final_count = sum(len(turn.get('finals', [])) for item in cd['read_summaries'] for turn in item.get('turns', []))
assert final_count > 0
identity_fields = ('id', 'kind', 'projectId', 'hostId', 'status', 'cwd', 'updatedAt', 'pinnedIndex')
safe = {'at': now, 'kind': 'Explicit field-only factual S5 activity inventory',
        'observed_utc': cd['observed_utc'],
        'source_pins': [pin(cut), pin(native)],
        'forbidden_sources': 'Do not open either original inventory: both contain excluded conversation text',
        'jobs': cd['jobs'], 'jobs_path': cd['jobs_path'],
        'central_registered_controller': cd['central_registered_controller'],
        'active_legacy_caller_paths': cd['active_legacy_callers'],
        'matching_automation_tomls': cd['matching_automation_tomls'],
        'cycle_records': cd['cycle_records'],
        'prior_awaiting_legacy_handoff': cd['prior_awaiting_legacy_handoff'],
        'pinned_identity_status': [{k: row[k] for k in identity_fields if k in row} for row in nd['pinnedThreads']],
        'other_identity_status': [{k: row[k] for k in identity_fields if k in row} for row in nd['threads']],
        'limits': 'Historical bounded native listing (2 pinned / 50 other). Titles, summaries, conversation turns, finals, assessments and conclusions omitted. Current installed caller/profile/preimage files remain independent review inputs.'}
safe_path = write('SPEC-final-S5-factual-inventory.json', safe, True)

common = {'scope': 'SPEC final gate procedure', 'original_source': str(raw),
          'downstream_impact': 'Review provenance/accounting only; no candidate source or later SPEC behavior changed'}
records = [
    dict(common, id='SPEC-FINAL-REVIEW1-P01',
         original_requirement='Fresh whole-SPEC review excludes author/manager conversations and previous outer review diagnoses/verdicts',
         actual_change='First whole reviewer printed full S5 inventory files containing nested conversation finals; its gate is excluded and a different fresh reviewer receives a strict whitelist and field-only inventory',
         reason_authority='Local SPEC Review Gate independence contract; prior exposure cannot be undone by timing or technical conclusions',
         files=[str(cut), str(native), str(safe_path), str(E/'SPEC-final-integration-assignment-v2.md')],
         checks=f'Native terminal self-disclosure and root bounded structural validation: {len(cd["read_summaries"])} read summaries and {final_count} nested final entries; original files hashed without exporting their histories',
         observable_effect='First gate does not satisfy acceptance. Current source and successful suites remain unchanged; replacement gate required',
         risk='Excluded first report retained for owner audit only; its conclusions and conversations withheld from replacement'),
    dict(common, id='SPEC-FINAL-REVIEW1-P02',
         original_requirement='Read-only Git discovery strips inherited Git variables and disables optional locks',
         actual_change='First reviewer initial pure root lookup omitted explicit GIT_OPTIONAL_LOCKS=0; later reads used the required environment',
         reason_authority='Disclosed procedural omission retained rather than retroactively certified',
         files=[str(raw)], checks='Native reviewer disclosure; unchanged retained source HEAD/index/ref evidence',
         observable_effect='No observed Git mutation; report-only qualification',
         risk='No claim that initial invocation had the missing setting'),
    dict(common, id='SPEC-FINAL-REVIEW1-P03',
         original_requirement='Full source/evidence reads use exact paths and do not treat truncation as proof',
         actual_change='Some oversized or guessed-path reads failed or truncated; reviewer corrected with exact targeted reads',
         reason_authority='Full coverage obtained through bounded corrections, with failed reads retained as failed diagnostics',
         files=[str(raw)], checks='Native procedural disclosure and explicit full-read coverage',
         observable_effect='No source edit; truncated or failed diagnostics excluded as proof',
         risk='Report does not certify incomplete initial outputs'),
    dict(common, id='SPEC-FINAL-REVIEW1-P04',
         original_requirement='Current file mode comparator matches manifest representation exactly',
         actual_change='Initial comparator compared integer modes with octal strings; corrected exact comparator found zero mismatches',
         reason_authority='Mechanical read-only comparison correction',
         files=[str(raw)], checks='Native reviewer disclosure and corrected exact zero-mismatch readback',
         observable_effect='No candidate change; only corrected comparison supports mode preservation',
         risk='Initial erroneous comparator remains a failed diagnostic')]
procedural = write('SPEC-final-review-1-procedural-facts.json', {'at': now, 'actor': '/root', 'entries': records,
                        'source_report_owner_audit_only': pin(raw), 'source_inventory_structural_validation':
                        {'read_summary_count': len(cd['read_summaries']), 'nested_final_count': final_count,
                         'source_sha256': sha(cut)},
                        'product_source_changed': False, 'suites_replayed': False}, True)
n = json.loads((E/'SPEC-neutral-deviations.json').read_text())
assert n['contextual_entry_count'] == 111
n['at'] = now
n['entries'] += records
n['contextual_entry_count'] = len(n['entries'])
n['unique_ids'] = len({row['id'] for row in n['entries']})
assert (n['contextual_entry_count'], n['unique_ids']) == (115, 109)
snapshot = write('SPEC-neutral-source-preimages/review1-procedural-facts.json', json.loads(procedural.read_text()), True)
n['source_hashes'][str(procedural)] = sha(procedural)
n['source_snapshots'][str(procedural)] = {'path': str(snapshot), 'sha256': sha(snapshot), 'mode': '0o100444',
    'scope': 'Complete provenance only; excluded previous report conclusion fields must not be read by fresh reviewer'}
n['derivation'] += ' Four first-whole-review procedural contexts added. No technical conclusion from that report is included.'
neutral = write('SPEC-neutral-deviations-v2.json', n, True)

m = json.loads((E/'SPEC-final-current-manifest.json').read_text())
for group in ('current_integrated_sources','authority_sources','final_raw_checks','check_helpers_and_derivations','documentation_preimages'):
    for item in m[group]:
        p = Path(item['path'])
        if not item['exists']:
            assert not p.exists() and not p.is_symlink(), p
            continue
        assert p.lstat().st_mode == item['mode'], p
        if item.get('sha256'):
            assert sha(p) == item['sha256'], p
m['at'] = now
m['neutral_deviations'] = pin(neutral)
m['factual_S5_activity_inventory'] = pin(safe_path)
m['scope_rule'] += ' Strict exact-path whitelist: no directory inventories, no S5 inventory originals, no neutral provenance source reports; supplied extracted facts only.'
m['forbidden_paths'] = [str(cut),str(native),str(raw),str(E/'SPEC-final-review-lifecycle.json'),
    str(E/'SPEC-final-review-1-procedural-facts.json'),str(E/'SPEC-final-deviation-classifications.json'),
    str(E/'SPEC-final-report-draft.md'),str(E/'slice-ledger.json')]
manifest = write('SPEC-final-current-manifest-v2.json', m, True)
text = (E/'SPEC-final-integration-assignment.md').read_text()
text = text.replace('E/SPEC-final-integration-review-1.md','E/SPEC-final-integration-review-2.md')
text = text.replace('E/SPEC-final-current-manifest.json (sha256 4389d876a90a77f81a0543d8723f990c5b331575d6d8736c7e1bf8f202f4a248)',f'E/SPEC-final-current-manifest-v2.json (sha256 {sha(manifest)})')
text = text.replace('E/SPEC-neutral-deviations.json (111 factual contexts/105 distinct IDs)',f'E/SPEC-neutral-deviations-v2.json (115 factual contexts/109 distinct IDs; sha256 {sha(neutral)})')
text += '\nStrict evidence access rule: read only exact paths in the v2 manifest and exact current implementation dependencies/authorities linked there. Do not glob, scan or dump E directories. In E/S5 only the 35 exact documentation_preimages paths are permitted; every *inventory* file, original thread/cutover listing, conversation summary and outer review report is forbidden. Use E/SPEC-final-S5-factual-inventory.json for field-only historical activity facts. Never open the original sources named inside that derivative. Neutral original_source/source_snapshots/source_hashes are provenance pointers only: do not open their prior report/classification content. Do not open any prior whole-review report, lifecycle or procedural source addendum. No author conversations, manager assessments or outer acceptance verdicts are permitted. Actual J domain gates remain outputs under behavioral test after independent derivation; current SPEC outer reports are excluded. A prior procedural exposure is a neutral fact, with no prior technical conclusion or desired verdict supplied. Follow these restrictions even if a helper or manifest points to a forbidden source. Ask root to provide a field-only fact if necessary; do not broaden reads.\n'
assignment = E/'SPEC-final-integration-assignment-v2.md'
assert not assignment.exists()
assignment.write_text(text);assignment.chmod(0o444)
classes = json.loads((E/'SPEC-final-deviation-classifications.json').read_text())
for r in records:
    item=copy.deepcopy(r)
    item.update({'classification': 'repair_required' if r['id'].endswith('P01') else 'accepted',
                 'classification_owner': '/root', 'classified_at': now,
                 'root_basis': 'Exclude exposed first pass; different fresh whitelist gate required' if r['id'].endswith('P01') else 'Read-only disclosed procedural qualification; no observed source mutation'})
    classes['entries'].append(item)
classes.update({'at': now,'contextual_entry_count': 115,'unique_ids':109,
                'counts': {'accepted':114,'repair_required':1,'owner_ruling_required':0,'downstream_impact':0},
                'required_repairs':['Fresh admissible final independent review'], 'owner_rulings_required':[]})
(E/'SPEC-final-deviation-classifications.json').write_text(json.dumps(classes,indent=2)+'\n')
print(json.dumps({'manifest':pin(manifest),'assignment':pin(assignment),'neutral':pin(neutral),
                  'factual_inventory':pin(safe_path),'contexts':115,'unique_ids':109,
                  'current_frozen_inputs_unchanged':True,'candidate_changed':False},indent=2))
