"""Capture-only evidence aggregation. Never imports or runs application modules."""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess

C = pathlib.Path(__file__).parent
load = lambda n: json.loads((C / n).read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(name, obj):
    (C / name).write_text(json.dumps(obj, indent=2) + '\n')

pages = load('PAGE-MAP.json')['pages']
baseline = load('EXECUTION-BASELINE.json')
source_rows = {}
for name, rows in [('EXECUTION-BASELINE.json', baseline['source_test_hashes'])] + [(f'S{i:02}-SOURCE-EVIDENCE.json', load(f'S{i:02}-SOURCE-EVIDENCE.json')['files']) for i in range(1, 6)]:
    for row in rows:
        source_rows.setdefault(row['path'], []).append({'manifest': name, 'sha256': row['sha256']})
extras = ['AGENTS.md', 'fusion-studio-server/AGENTS.md', 'fusion-studio-server/lib/thread/thread-runtime-manager.js', 'fusion-studio-server/lib/thread/ThreadManager.js', 'fusion-studio-server/lib/thread/HistoryFile.js', 'fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js', 'fusion-studio-server/scripts/wiki.js', 'fusion-studio-server/lib/wiki/audit/toc-sync.js']
extras += [str(p) for p in pathlib.Path('ai/RC-MacAir-15/Wiki/000-Wiki_Guidance').glob('**/PAGE.md') if '.versions' not in str(p)]
extras += [str(p) for p in pathlib.Path('ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards').glob('*/PAGE.md')]
for p in extras:
    if p not in {r['path'] for r in pages}: source_rows.setdefault(p, [])
sources = []
for p, receipts in sorted(source_rows.items()):
    data = pathlib.Path(p).read_bytes()
    h = sha(data)
    changed = [r for r in receipts if r['sha256'] != h]
    # Only current owner wiki guidance may supersede earlier evidence; no source drift is silently accepted.
    assert not changed or '/Wiki/000-Wiki_Guidance/' in p, (p, changed)
    sources.append({'path': p, 'sha256': h, 'line_count': len(data.splitlines()), 'prior_evidence': receipts, 'disposition': 'current authorized guidance supersedes historical metadata/generator rules' if changed else 'current identity; reuse named raw evidence where inspected, inventory-only rows remain inventory only', 'changed_prior_identities': changed})
commands = []
for args in [['git','rev-parse','HEAD'], ['git','status','--short'], ['rg','-n','queryResourceProvenance|agent:activity|resource:provenance','fusion-studio-client/src'], ['rg','-n',r'uiActionSeed|ui\.action|chat.send_with_resource|changeStorm|automation\.runId','fusion-studio-client/src','fusion-studio-server/lib'], ['rg','-n','last-modified|writeFile|writeFileSync','fusion-studio-server/lib/wiki/audit/toc-sync.js','fusion-studio-server/scripts/wiki.js']]:
    r = subprocess.run(args, capture_output=True, text=True)
    commands.append({'command': args, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'exit': r.returncode, 'stdout': r.stdout, 'stderr': r.stderr})
save('S06-SOURCE-EVIDENCE.json', {'at': now, 'candidate': 'PW01-f24d5cd427b9ca14', 'files': sources, 'commands': commands, 'scope': 'Current identities and reusable raw source/test/authority evidence; tests not rerun; no module execution'})

# Page-specific terminal reconciliation policies. Input blocks are historical chunks, not atomic assertions.
policies = [
('Orientation rewritten as bounded 24+3 source inspection; durable reading rule and System ownership retained; capture links removed into authority evidence.', 'PW-D01–09', 'S01-EVIDENCE.md#s01-c1--system-current-singleton-and-target-separation'),
('Explainable history goals retained as direction; graph paths, universal restore and assistant improvement are future capabilities, not a live graph.', 'PW-D01–07/09; MVP-D07/08; BRG-D01/03/04/08', 'S01-EVIDENCE.md#per-page-and-claim-mapping'),
('Old universal schema, accepted-ref, token and executor requirements replaced by exact save/agent/context overlays; durable principles retained; residual choices translated to feature triggers.', 'PW-D01–09; MVP-D09/14/15/16; ATP-D15–17; BRG-D03/05/08/09', 'S01-EVIDENCE.md#s01-c4--governed-and-legacy-distinction-narrow-overlays'),
('Current private admission, exact publisher/handler grants and awaited delivery replace draft nonwaiting/ref doctrine; legacy API is separate; plugin machinery stays proposal.', 'MVP-D01–07/14/18; ATP-D09/15–17; PW-D05', 'S02-EVIDENCE.md#s02-c3--grants-filters-handlers-delivery-and-downstream-projection'),
('Conceptual domains retained but exact current registered facts/commands/projections/queries replace universal event-family claims; wider families remain unimplemented.', 'MVP-D14; ATP-D09/15–17', 'S02-EVIDENCE.md#s02-c2--four-reserved-publishers-and-actual-carriers'),
('Distinct reported/observed/causal identities retained; exact carriers and required save protection replace common-envelope and universal fail-open claims; graph/enums are not one live schema.', 'MVP-D06–09/14–16; ATP-D02/04/15–17; BRG-D09; PW-D01–07', 'S02-EVIDENCE.md#s02-c2--four-reserved-publishers-and-actual-carriers'),
('Actual legacy/save/agent sinks, transaction boundaries, admission/persistence separation and bounded retry replace ledger-internal payload proposal; broader schema remains open.', 'MVP-D14; ATP-D17; PW-D01/02/07', 'S02-EVIDENCE.md#s02-c5--real-storage-and-legacy-attribution'),
('Real migrations/table owners/indexes replace generalized ledger_events design; graph, retention and proof capabilities remain open; migration040 distinguished from ordinary reconcile.', 'MVP-D14/15; ATP-D16/17; PW-D01/02/05–07', 'S02-EVIDENCE.md#s02-c5--real-storage-and-legacy-attribution'),
('Source owner map replaced stale paths and proposed modules; connected and fallback File consumers named; planned modules labeled future.', 'PW-D09; current source ownership', 'S02-EVIDENCE.md#s02-c7--self-review-scope-and-residual-dependencies'),
('Target flow replaced by real Office/Email save-to-File-render chain; prewrite, postwrite, stale pair, reconnect and targeted dirty-cache behavior separated; wider freshness remains future.', 'MVP-D07/09/14–16; ATP-D13; PW-D06', 'S03-EVIDENCE.md#required-source-narratives'),
('General future versioning replaced by two implemented System snapshot mechanisms and separate optional Git checkpoint; required preimage precedes write; universal diff/restore stays open.', 'MVP-D09/15; ATP-D10/11/16; PW-D06/07', 'S03-EVIDENCE.md#claim-and-source-mapping'),
('Priority-based causal inference retired as proposed resolver; current durable operation links, observed history, optional context and legacy association retain explicit uncertainty.', 'MVP-D16; ATP-D15–17; BRG-D09; PW-D06', 'S03-EVIDENCE.md#claim-and-source-mapping'),
('Draft resource mutation envelope replaced by exact closed save facts and reportedUiContext; wider commands and human/causal proof not inferred; query plumbing separate from display.', 'MVP-D09/14–16; BRG-D09; PW-D06', 'S03-EVIDENCE.md#claim-and-source-mapping'),
('Draft canonical file-version payload retired; actual preimage/checkpoint fields explained with distinct timing and identities; broader graph/diff/restore remains future.', 'MVP-D09/15; ATP-D16; PW-D06/07', 'S03-EVIDENCE.md#claim-and-source-mapping'),
('Full Chat exchange storage kept distinct from normalized activity/query; raw transcript values not globally redacted by index; binding, clocks and identity traced, broad envelope proposal retired.', 'ATP-D15–17; BRIDGE-02 conformance; PW-D01/02/06/07', 'S04-EVIDENCE.md#c1--full-chat-storage-and-disclosure'),
('Draft tool/native-reference payload replaced by current OpenCode terminal snapshot, bounded candidates and secure observation; first/unchanged/failed/interrupted limits explicit; wider policy remains open.', 'ATP-D01–17, narrow D15–17', 'S04-EVIDENCE.md#c2--ingress-clocks-identity-and-interruption'),
('Future query paths kept as goals; current bounded query routes and absent production UI callers distinguished; freshness and recovery are separate consumers.', 'ATP-D09–17; BRG-D01/03/06/08–10; PW-D05–07', 'S04-EVIDENCE.md#c5--ledger-queries-and-ui-absence'),
('Legacy triggers/cron/runner described as current; common automation.runId/kind retained as settled future requirement; generation/output/lifecycle/causal handoff remain open.', 'Capture008 automation common fields; MVP-D17; PW-D05/07; PW-O03/04', 'S05-EVIDENCE.md#a1--legacy-trigger-and-scheduler-chain'),
('Current save context replaces universal UI envelope; historical snapshot and T1/T2 versus T3 direction retained; new UI publisher and all-view coverage unimplemented.', 'BRG-D01–09; MVP-D16; PW-D01/02/05–07', 'S05-EVIDENCE.md#c1--reader-and-optional-sanitizer'),
('Proposed audit payload retired as executable-looking example; query transports current, saved audits/recommendations and mounted review UI future with explicit decisions.', 'PW-D05–07; PW-O01/02/04; ATP-D12/17', 'S05-EVIDENCE.md#q1q2--audit-scope-and-absence-evidence'),
('Storm goals retained; batch schema, exact quotas/thresholds and compaction remain proposals/open; actual watcher/checkpoint controls do not authorize deleting history.', 'PW-D06/07; PW-O01/04; ATP-D10/16', 'S05-EVIDENCE.md#a3s1--goals-policy-and-existing-controls'),
('Shared UI direction and Wiki/File first pair retained; universal wrapper, exact token/envelope/executor and prompt adapter contracts labeled unimplemented; real save and attachment owners replace stale code assumptions.', 'Capture008 first-pair owner selection; BRG-D01–09; PW-D05', 'S05-EVIDENCE.md#p1--operational-attachment-chain'),
('Wiki first-pair selection, send-time active context versus staged subject and absence semantics retained; literal mapping/ABI deferred; current selector and operational attachment path named.', 'Capture008 first-pair owner selection; BRG-D09; PW-D09', 'S05-EVIDENCE.md#p2--actual-per-view-owners-versus-proposed-mappings'),
('File first-pair selection retained; connected owner replaces stale global-tab mapping; operational readers/attachments and future prompt adapter explicitly distinct.', 'Capture008 first-pair owner selection; BRG-D09; PW-D09', 'S05-EVIDENCE.md#p2--actual-per-view-owners-versus-proposed-mappings'),
('Original unrelated workspace/view/planned-navigation prose preserved, not recertified; inserted System/calendar/preservation sections checked; missing runtime metadata pointer corrected mechanically.', 'PW-D01–09; PW-O01/05; owner S06 pointer authorization', 'S01-EVIDENCE.md#s01-c2--conditional-calendar-producer-storage-api-and-consumer'),
('Conflicting universal candidate/ref/nonwaiting doctrine replaced by exact trusted built-in path; command/fact and Chat ownership principles retained; no universal Chat certification.', 'MVP-D14/18; ATP-D15–17; PW-D01–09', 'S02-EVIDENCE.md#s02-c3--grants-filters-handlers-delivery-and-downstream-projection'),
('Original unrelated persistence/Chat/recovery standards preserved, not recertified; inserted System/provenance boundary checked; directory pointers replaced by exact subject owners.', 'PW-D01–09; owner S06 pointer authorization', 'S01-EVIDENCE.md#s01-c1--system-current-singleton-and-target-separation'),
]
assert len(policies) == len(pages)
inventory = load('S00-INPUT-INVENTORY.json')['claims']
dispositions = []
page_results = []
for row, (reason, authority, evidence) in zip(pages, policies):
    text = pathlib.Path(row['path']).read_text()
    headings = re.findall(r'^## (.+)$', text, re.M)
    claims = [r for r in inventory if r['page'] == row['path']]
    page_results.append({**row, 'disposition': 'changed-and-checked' if row['scope'] == 'primary' else 'limitation explicitly labeled in-page', 'reason': reason, 'current_sha256': sha(text.encode()), 'claim_ids': [r['id'] for r in claims], 'authority': authority, 'evidence': evidence, 'final_headings': headings, 'scope_limit': 'all primary prose' if row['scope'] == 'primary' else 'System/provenance insertion or conflicting event rules plus authorized metadata only; unrelated prose not certified'})
    for r in claims:
        retained = r['text'] in text
        scope_exception = row['scope'] == 'supporting_limited' and row['slice'] == 'S01'
        if scope_exception:
            status = 'preserved_unrelated_supporting_scope'
            assert retained, r['id']
            detail = 'Exact original block remains; bounded insertion and metadata edits do not recertify this unrelated contract.'
        elif retained:
            status = 'retained_with_current_scope'
            detail = 'Exact text retained under explicit current/direction/open status and the page policy below.'
        elif 'Captures/' in r['text'] and ('Related' in r['heading'] or r['id'] == 'C0020'):
            status = 'ephemeral_authority_relocated'
            detail = 'Removed capture receipt dependency from durable explanation; raw source decisions and scoped supersessions retained in AUTHORITY-MATRIX.md.'
        else:
            status = 'replaced_by_scoped_current_and_future_guidance'
            detail = 'Original block no longer acts as a current contract; its topic is resolved by the cited page-specific replacement and future decision boundary.'
        # Preserve full input as audit context so mixed blocks cannot masquerade as individually certified facts.
        dispositions.append({'id': r['id'], 'page': r['page'], 'input_heading': r['heading'], 'input_lines': [r['start_line'],r['end_line']], 'input_sha256': sha(r['text'].encode()), 'input_text': r['text'], 'final_disposition': status, 'resolution': detail + ' ' + reason, 'authority': authority, 'evidence': [evidence, row['slice']+'-SOURCE-EVIDENCE.json', 'AUTHORITY-MATRIX.md'], 'final_sections': headings, 'topics': r['topics']})
save('S06-DISPOSITIONS.json', {'at': now, 'candidate': 'PW01-f24d5cd427b9ca14', 'input_blocks': len(dispositions), 'note': 'Each S00 chunk has a terminal topic disposition, not a claim that every old assertion survives. Mixed draft chunks are superseded by the named scoped current/target/open guidance. Supporting scope exceptions are explicit.', 'pages': page_results, 'claims': dispositions})
save('FINAL-ARTICLE-HASHES.json', {'candidate': 'PW01-f24d5cd427b9ca14', 'at': now, 'count': len(pages), 'phase': 'current pre-parent-completion-stamp bytes', 'pending_parent_pass': 'Originating parent session 01a0b8f8-22a1-7c82-ba10-b6afe27fa857 owns separate authorized completion timestamp pass after SPEC-ready and writers terminal; snapshot current predecessors and append evidence.', 'articles': [{'path': r['path'], 'sha256': sha(pathlib.Path(r['path']).read_bytes())} for r in pages]})
print(json.dumps({'sources': len(sources), 'pages': len(page_results), 'claims': len(dispositions), 'commands': len(commands)}))
