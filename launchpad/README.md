# Launchpad local ticket core

LP-01-S1/S2 supply an assigned seed and revision-checked transaction path with immutable canonical JSON and self-contained read-only file viewers. Installed operations and closed arguments are discoverable through `catalog.list` and `operation.describe`; later roadmap operations remain explicitly unavailable.

```sh
python3 launchpad/tools/ticket_cli.py --framework /absolute/disposable/framework --request /absolute/request.json
python3 -m unittest discover -s launchpad/tests -p 'test_lp01*.py'
node --test launchpad/tests/ui/*.test.cjs
```

The framework argument names the writable local store. Maintained schema, template, scripts and view assets come from this package. A framework must already exist; the CLI never discovers or chooses a global target. Requests follow `assets/schema/request.schema.json`; responses follow `response.schema.json`. Exit 0 is success, 2 is a contract/authority/conflict refusal, 3 is a store failure.

Provisioning uses the exact `plan.create` nil-generation convention. Save closed record envelopes under `<framework>/.evidence/<revision_uuid>.json` for the original owner authority, actual CWD/permission/identity evidence, exact assignment and active actor. The actor binding reference pins the actor envelope; its binding-evidence and assignment refs pin those separately saved records. The assignment's `write_paths` contains exactly the resolved new plan home; `source_checkout` contains the bounded seed source root. The public tool validates every evidence envelope/hash and the actual process CWD. This is a trusted local Full Access workflow validation boundary; copying an ID is not native host authentication. No task, role, schedule or publication is activated.

An assigned `ticket.create` pins the maintained inert template hash and a saved seed content envelope. Its file source refs must resolve inside the assignment's source root with exact source-file hashes. Scope/ToDo source-item bodies point to the exact same seed envelope. Template cloning mints fresh logical UUIDs and timestamps and creates no actor, grant, approval, claim or runtime records in the ticket. Source items use stable source aliases for later seed edits. Edits preserve logical UUIDs and creation times, retain old revisions and require exact expected revisions for every changed existing object. Removing source items is refused until an explicitly accounted routing/coverage operation is installed. An identical seed apply preserves the original physical ticket payload, binding and all business envelopes/revisions/update times. Only a new plan generation and committed idempotency receipt are published; changed_refs and changed_fields are empty. Manual reload observes that new captured generation, and same-request retry returns its receipt without republishing.

`seed.edit_preview` validates exact root/object expectations, applicable suboperation grants, source pins and prospective seed commands without publication. Applying the inspected command still requires its current generation, object expectations and source hashes. The existing request schema does not carry a preview-digest field on `ticket.create` or `ticket.seed_apply`; that digest is inspection evidence, not a substitute for apply validation.

Plan `CURRENT` is the sole relative selector. Canonical ticket payloads physically reside inside each child `.revisions` folder. Both HTML aliases resolve a complete same-generation publication. The API captures CURRENT once and checks child file hashes. Prepared publication evidence retains generated-view hashes. Historical generation files remain present. Browser content is read-only, embedded, network-free and manually refreshed; already-open pages show their captured generation.

Each named-plan selector also routes to `<framework>/plans.HTML`, the latest header-only registry chooser. Registration atomically replaces this derived routing page under the provisioning lock. Earlier immutable plan pages can reach subsequently registered plans through this manual navigation without fetching data or rewriting another plan's business snapshot. Retrying the same bootstrap request repairs a missing chooser. S2 recovery must account for plan CURRENT publication, root registry publication and this derived chooser publication as separate interruption boundaries.

Routing headers must have canonical UUID/string fields and a confined relative `work-tickets/<safe-name>` home. Malformed, duplicate, inert-template or symlink destinations are refused before provisioning publishes a new plan or chooser. Viewer interpolation substitutes the original maintained template once; literal `{{TITLE}}`, `{{MODEL}}` and `{{SCRIPTS}}` in supplied content remain text.

The chooser destination must be absent or an ordinary confined file before provisioning, preview and publication. Generated navigation uses the validated file URL without following a chooser symlink. A failure after CURRENT is selected reports `committed_unknown` with reconciliation context; inspect the captured store before retrying. Complete interruption/recovery handling remains S2.

The portable model/card/tree/modal/style modules use explicit inputs. The source timeline's 200px cards, 100px gaps, 120px row spacing, main rail and four branch fan-out/convergence are preserved with tokenized dark palette fallbacks. A seed can preserve a bounded source presentation declaration under `extensions.source.preserved.presentation` (`position`: opening/track/convergence, optional nonnegative slot); its selected track still comes from the assigned public create request. This declaration carries presentation only.

The 32-record source sample is a disposable visual fixture, with explicitly provisional track assignments. It is not source-board conversion or evidence for38 records. Create it through `tests/host/create_sample.py --root <new-disposable-root> --source <read-only32-record-source-json>`. Then run `node launchpad/tests/host/verify_file_host.cjs --browser chrome --root <root>` with `NODE_PATH` pointing to a verified installed Playwright dependency. The runner launches installed Chrome, saves screenshots, exercises the public CLI refresh boundary and closes its own browser. The same host restores presentation as described below.


S2 installs `record.update`, `record.create`, `issue.create`, `acceptance.record`, `transaction.apply`, `recovery.inspect`, `recovery.plan`, and `recovery.apply` through the existing eleven-tool registry. The operation is `transaction.apply` on tool `db.transaction`; its authored subrequests are `{operation,args}`, with no nested scope, caller IDs, generated-ID placeholders, or invented `edge.create`. Outer `expected` and `args.expected` must agree exactly. A transaction has one selected plan/ticket scope, at most100 authored operations, combined grants checked before staging, and one commit. Prospective creates detect duplicate homes before any payload is written. Unsupported later roadmap suboperations visibly refuse the complete batch.

S2 generic writes support content/category/edge/reference; protected records require named operations. Source/owner authority cannot be manufactured by generic content creation or changed by generic update. Category moves, item removal and dropped source lineage are held for LP02. Exact expected revisions include plan/ticket roots, changed records, content category/items and named authority/subject/gate/report/edge dependencies. A newer plan generation conflicts even for nonoverlap; inspect the returned current headers/diff and deliberately issue fresh expectations. An unchanged update publishes only the receipt, preserving all business envelopes and physical ticket payloads. Original older receipts replay their saved result/high-water without adopting the current generation.

The narrow A02 `acceptance.record` path records only exact ticket content subjects with assigned parent/owner evidence and passing independent exact-subject review/report pins. It does not certify LP04 native run return, evaluator claim, slot prerequisites, workflow owner gates or finalization. Those protected subject kinds refuse until their assigned lifecycle is installed. Related acceptance+pending issue+exact endpoint edge operations share one commit; there are no generated-ID substitutions to link newly generated records that the caller has not inspected.

Unpublished child homes retain `.child-intents/<home>.json` naming exact request hash/actor/assignment. An exact precommit retry may replace only its unpublished, ordinary derived aliases; child payloads and failed generations stay immutable inventory. Different request owners or foreign aliases refuse. Bootstrap intents are atomically saved under `.provisioning/` before a plan home exists. Same-request bootstrap retry repairs root registry/chooser after selected publication without republishing business data. Root routing remains header-only and independent of other plans' progress.

Recovery uses the byte-identical authored operation shapes. `recovery.inspect` returns validation findings containing retained generation/child payload paths and hashes, including incomplete staging and prior recovery actions. `recovery.plan` pins an exact saved canonical receipt plus current generation and scope, returning a preview digest for acknowledgment of a committed receipt or abandonment of an unselected generation. `recovery.apply` revalidates digest/current expectations, assigned owner authority and saved inactive-writer evidence whose actual process has exited. The evidence is ordinary typed content with its JSON payload identifying the inspected PID and original assignment; it is trusted local workflow evidence, not a native authentication claim. Recovery retains all files, never steals claims, executes dispatch, or hand-rolls CURRENT back. Its own receipt-only commit records the repair acknowledgment. Incomplete stages without a saved canonical receipt remain inspectable inventory, not fabricated recovery receipts.

Optional test-only `LP_TX_TRACE`, `LP_TX_STOP`, `LP_TX_FAIL` instrument each actual mkdir/write/flush/file-fsync/directory-fsync/alias/selector/registry/chooser/readback/reply boundary in a public subprocess. The test matrices kill or fail that process at each recorded boundary, restart through public commands and check old-or-new physical canonical/embedded generations. These hooks are inert when absent. They prove process interruption and filesystem failure handling on the exercised local POSIX host, not arbitrary hardware power loss or universal network filesystem guarantees. Unsupported flock/fsync/symlink operations refuse rather than downgrade.

## Presentation restore (LP-01-S3)

The existing connected file viewer loads its embedded generation before restoring presentation from localStorage. The key includes framework UUID (currently the plan UUID), plan UUID, view kind and version. Stored values contain UUID selections, explicit false/true expansion, current or pinned modal targets, focus and independent window/workflow/category/modal/timeline scroll offsets. Current modals resolve latest embedded records; Pin revision retains the exact envelope revision across a later public commit and manual reload. Missing current targets fall to a surviving containing section; new targets start with component defaults. Scroll offsets clamp after layout. Chrome file persistence is the supported tested host; no all-browser guarantee is made.

Storage denied, corrupt shape/JSON and quota failures show a restore-unavailable notice while ordinary read-only content renders. Details show actual JSON as selectable text and supporting paths stay inert. Copy JSON and the ticket logo call the system clipboard once per gesture; failure displays selectable fallback text without clipboard history. The browser never fetches, polls, invokes native coordination or writes source content.

The installed-Chrome verifier extends the existing 32-record source/sample checks with restore/focus/scroll/pin, public CLI commit and latest plan/ticket aliases, storage failures and clipboard fallback. `restore_sample.py` adds explicitly synthetic scroll/escaping stress text to a disposable public-minted fixture. Before LP-02-S1, public deletion was unavailable. The historical A03 deleted-target check is explicitly labeled an embedded host-model simulation with retained revisions, separate from real public commit/reload evidence. This test does not certify a deletion command.

## Typed records and scoped reads (LP-02-S1)

The installed v1 catalog remains the source of operation availability. S1 adds `query.filter/search/project/page/explain`, count/group-count/distinct/exists aggregates, `record.get/head/exists/history/diff/related`, category routing preview/apply, and shape/registered-extension `validation.record`. Request shapes and the closed 27-kind registry remain the approved schema bytes. Unsupported checks return an incomplete validation with uncovered scope; validation is separate from adoption.

Queries use explicit selected plan/ticket scope, default 20 and maximum 100 rows, and a 16KiB response budget. Cursors bind the retained generation, exact scope, query fingerprint and previous tuple. Changing current data does not change a page snapshot; changed cursor parameters or corrupted tokens refuse. Projection/filter/sort fields are closed to envelope or registered kind-body fields (`title` or `body.title`, for example). Numeric fields sort numerically; UUID breaks ties. Oversize detail fields are omitted with an explicit gap and field list; the exact immutable canonical file remains available. Relationship traversal defaults to one level; its bounded overflow requires narrowing the subject/edge kinds or raising the limit explicitly. It does not silently expand unrelated history.

`record.archive/delete/restore` apply only to content with the exact object/category/item/affected-acceptance expectations and original assigned authority. Deletion is limited to unused, unreferenced, unevidenced pending proposals. It publishes a same-UUID/kind/body/extensions/created-at tombstone in envelope lifecycle; original and tombstone revisions remain retrievable. Default queries and category trees exclude inactive current records. Exact getters label lifecycle, an already open pin keeps its original bytes, and an obsolete current modal falls to its containing category after refresh. Explicit Show current from a retained pin can inspect the tombstone. Restoration verifies the retained nearest live predecessor and creates a new live revision without reviving an invalidated acceptance. Ordinary seed editing cannot revive archived seed content.

`record.move_category` retains logical identity, source items, supported nested extensions and accumulated source pins. `intake.route_preview` validates exact category-move operations and ordered source pins without publishing; `intake.route` verifies their digest/expected map and commits through the same transaction owner. Its source list must equal the ordered unique pins of the proposed operations. S1 route coverage rows are empty because no item is disposed. Source-item omission remains refused until LP-02-S3 installs explicit coverage/disposition. `record.clone` creates a pending content UUID with a pinned derived-from edge; an omitted body defaults to pending proposal/implementation-choice authority, and an explicit replacement body must also be pending. Merge and complete coverage/approval commands remain unavailable pending LP-02-S3. LP-02-S2 installs named supersession and derived source freshness below.

A granted writer's rejected record/routing schema or extension input is retained under the selected plan's `.migration-reports/<request-hash>.json`, containing the original request and rejection. This evidence does not change CURRENT or business records. The error reconciliation names its path; a report save failure is disclosed so the caller retains the original request/response.

S1 verification uses `python3 -m unittest discover -s launchpad/tests -p 'test_lp02_records.py'`, the relevant earlier provider suites, and `node --test launchpad/tests/ui/*.test.cjs`. The small actual Chrome fixture is `node launchpad/tests/host/verify_lp02_host.cjs --browser chrome --root <new-disposable-root>` with the bundled Playwright path in `NODE_PATH`. It proves public deletion/current exclusion, retained original pins, current tombstone labels, containment/focus, restoration, source-item route metadata and exact canonical/view readback on one ticket. It creates no live authority conversion, native task, timer or installation.


## Source freshness and one-way replacement (LP-02-S2)

`record.supersede` and `decision.supersede` take semantic `old_uuid`, `new_uuid`, `scope_item_uuids`, and exact assigned `authority_ref`. Optional `reverse_input` describes new-side presentation; it never swaps these semantic owners or stores a reciprocal edge. Endpoint/source-item/affected-acceptance expectations are required. Duplicate endpoints, self/dangling/cyclic/overlapping replacements fail without publication. Supersession edges require these named operations and are immutable through generic edits. A scoped union excludes only replaced source items; old content remains current while residual items remain. Exact get/head/history/diff and related/inverse inspection disclose replacement and residual identity against the captured generation. Old bodies and pins never change; affected acceptances invalidate without granting replacement approval.

A named reference read returns its source-used version separately from derived `details.source` and `details.reconciliation`. Plan-entry locators currently resolve exact entry UUIDs within the selected captured plan; an unavailable or unspecified cross-plan target remains unverified. Wiki references require the exact assigned Git checkout root, checked-out branch/ref, confined path, and nested frontmatter `metadata.last-modified` with timezone. The trusted assignment selects the branch/ref, independently of the caller reference. A named branch observes its latest checked-out HEAD and discloses the assignment baseline head; an exact non-branch ref/commit requires its pinned head to match. Actual bytes and Git HEAD are checked; equal timestamps never certify different hashes, older/restored data is disclosed, and missing/malformed/wrong-branch sources are unverified. Generic external files/URLs return `not_checked`. A live reference's registered supported consumer counts as substantive use, so an unevidenced pending consumer must be archived or superseded rather than deleted. No source file, business timestamp, approval, claim or source-observation record is written by a read.

Registered consumers are identified from supported-scope UUIDs, references edges and retained source-use pins (Plan revision/hash/native UUID or Wiki locator). Bounded current-entry headers expose every registered obligation count and any omitted details; unknown consumers are never claimed complete. Main reconciliation edits exact current entries with actual new source pins and explicit content disposition, preserving old pins. A pin to an archived/deleted/fully replaced source cannot certify reconciliation. `validation.record` supports `source freshness` and `registered reconciliation` checks and reports incomplete scope until required gaps resolve. No standalone `source.observe` operation is invented; generic protected observer creation remains refused.

The static viewer embeds read-only source statuses at publication, partial residuals, and explicit full-replacement inspection. An already open view cannot observe later external edits. A newly published generation followed by manual refresh updates that captured source projection; `record.get` can inspect external metadata separately at its returned `observed_at`. A pinned historical reference keeps its exact source-used fields. If this view captured only the newer reference's freshness, the pinned inspector labels its own freshness unverified and displays the newer status separately with that reference's revision identity; it never substitutes a current-used hash for the pin. The public pinned `record.get` checks that exact historical binding directly. Derived read disclosures participate in the actual 16KiB response bound and explicitly report omission/narrowing rather than extending a paginated response after its budget check.

Verify with `python3 -m unittest discover -s launchpad/tests -p 'test_lp02_sources.py'`, affected provider/record suites, UI tests, and `node launchpad/tests/host/verify_lp02_sources_host.cjs --root <disposable-root>` with bundled Playwright in `NODE_PATH`. Controlled Wiki fixtures use the assigned existing Git checkout without commits or branch changes; original Wiki and live plans stay unchanged. Full item coverage, merge and presented-batch approvals remain the next assigned slice.

## LP-02 item accounting and presented approvals

The installed LP-02 interface includes `record.merge`, `decision.record`,
`decision.present_batch` and `decision.approve_batch`. Existing typed mutation,
query, source, lifecycle, and transaction operations retain their original
closed schemas. This installation does not adopt an existing ticket, activate
an agent, authenticate a native owner identity, or publish Git work.

`intake.route_preview` accepts explicit related content operations and coverage
rows. `intake.route` applies the exact preview digest, original object/plan
expectations, source pins, and assigned authority through the existing single
canonical publisher. Supported intake operations are category moves, explicit
content updates, merges, clones, decision recording, and accounted seed edits.
New mutation grants remain required for every nested operation.

A coverage row identifies a stable `source_item_uuid` and the exact source
entry revision from that item's `body.source`, with `carried`, `adapted`,
`changed`, `dropped`, or `deferred` disposition and an explanatory note. Carry,
adaptation, and change require real destination record refs whose explicit
`scope_item_uuids` include the source item and occur on the destination's
`body.item_uuids`. Drop and defer require an exact active original owner decision
naming that item. Rows cannot be created or edited through generic CRUD.
Missing items, invalid pins, incomplete scope, or missing disposition authority
refuse the affected intake. Later edits that stale a saved destination produce
an incomplete source ledger; they do not silently repoint that retained mapping.

`record.merge` keeps its approved arguments: `uuid`, `target_uuid`, `reason`,
`source_refs`, and the explicit complete replacement `body`. There is no
`coverage_rows` argument on merge. Merges with identified items are integrated
through intake with complete coverage of both source and target items. The
source remains retained; the target keeps its UUID, creation time, supported
extensions and historical revisions. An owner-authorized one-way replacement
edge records the source scope. No concatenation, interpretation, or acceptance
is inferred from the merge.

Caller coverage destinations pin the **captured current** target revision/hash
and explicit scope. Inside this exact related transaction, the coverage owner
validates those captured bindings and expectations, then resolves each to the
new prospective revision produced by the explicit operation. It never rebinds
an arbitrary historical, foreign, or stale pin. Preview returns the caller's
exact rows and digest; apply retains the exact resolved destination revisions
in canonical coverage records. This permits a real body-changing merge without
requiring callers to predict generated UUIDs or widening the schemas.

Splits use explicit complete bodies for already identified destination records
and item rows for each actual successor. Routing keeps the same logical UUID.
Explicit transferred or dropped/deferred items may leave a source body only
with complete current disposition. An accounted seed omission retains the old
source-item definitions and prior content for inspection while the current seed
Capture and Ticket pointers evolve. Mapping never marks work delivered or
approved. `validation.record` with `checks:["item coverage"]` returns an
incomplete verdict for unmatched or stale registered item destinations. The
ledger covers identified registered items; it makes no absent-history claim.

`decision.record` puts Wiki-backed interpretations in Decisions as pending
proposals or pending implementation choices. An explicit original owner decision
may be recorded only with a `kind:"owner_decision"` source pin to its exact
saved `.evidence/<revision>.json` envelope, matching its real content and item
scope and exact dependency expectation. Labels, Wiki support, and source
freshness alone cannot confer owner direction. These are trusted local saved
evidence checks; native identity verification remains the caller's responsibility.

`decision.present_batch` requires a pending body with null `acceptance_ref`,
ordered exact `entry_refs`, `batch_digest = digest(entry_refs)`, and a
`presentation_evidence_ref` whose saved content is exactly
`{entry_refs,batch_digest}`. Presentation grants no acceptance. `accepted_scope`
on `decision.approve_batch` is an explicit subset of these presented entry UUIDs;
item-level limits remain in each frozen entry ref's `scope_item_uuids`. Empty item
scope denotes the whole entry, following the existing reference contract.

The original owner instruction is a saved live owner-decision content envelope
whose JSON content is exactly
`{kind:"approve_presented_batch",presented_batch_ref,accepted_scope,gate_refs}`.
This keeps the approved operation arguments unchanged. The typed review gates
must pass, cover the exact accepted refs/digest, retain actual report/evidence
refs, have no findings, and identify a writer/reviewer distinct from the subject
producers and accepting recorder. Every original/gate/report dependency has an
exact expectation. Merely supplying a `gate_refs` label is insufficient.
`acceptance.record` remains available for ordinary provider content; Decisions
category approval requires the presented-batch path in both direct and nested
transactions.

Approval is saved separately from the original pending interpretation envelope.
Late, new, materially edited, restored, or ungranted items remain pending.
Partial item scopes expose `partially_accepted` plus explicit uncovered items;
valid scopes on the same exact revision are unioned. When a batch receipt is
invalidated, unchanged exact live revisions/scopes retain their prior owner
approval applicability with the receipt disposition disclosed. This projection
never revives the invalidated whole execution gate or grants changed revisions.
An Issue is resolved only when its full explicit replacement scope is covered
by current exact accepted direction. Approval, replacement and the derived
issue resolution can be published in the same related transaction; no invented
`issue.resolve` operation or generic state toggle is used.

The static category viewer shows pending/scoped approvals, presented receipts,
and the current Ticket source ledger. Current and pinned record inspectors keep
exact retained bytes and separately label the current revision/approval/ledger
scope. These disclosures are captured with a generation; a newly published
view and manual refresh are required to see changes. Presentation storage and
the browser do not mutate canonical records or obtain native transcripts.


Current coverage also checks each destination and disposition decision's active
supersession scope. A retained exact envelope is historical evidence when its
mapped items have been replaced. Full/partial replacement holds only the obsolete
items until explicit current successor rows or actual current drop/defer direction
reconcile them; valid residual mappings remain usable.

Interpretations retain their presented-approval obligation across category
relabeling and routing through canonical content/category revision history.
Generic acceptance cannot convert that identity into ordinary provider content.
Current applicability for these interpretations requires genuine protected
presented-batch acceptance provenance. Category articles show each captured
canonical item disposition/current applicability beside retained source text,
including explicit dropped/deferred and incomplete-mapping notices. Text and
history are preserved; no automatic archive/delete is inferred.

Accounted split rows also record real scoped `derived_from` edges from each
destination to its explicitly edited source. Endpoint pins use the final
prospective revisions, while retained source revisions preserve the original
interpretation. Approval obligations follow these edges and incoming scoped
`supersedes` edges through canonical history; sharing a raw source-item UUID
alone adds no obligation. Final prospective validation rejects generic
acceptance or active interpretation state inserted before later transformation
suboperations establish that lineage. Genuine exact presented approval remains
required only for the interpreted scope; unrelated provider scope stays usable.

## LP-03 S1: exact entry and simultaneous discussions

The installed local provider now adds read-only `session.entry`, bound `discussion.resume_context`/`context.startup`/`context.reentry`, and mutations `actor.bind`, `discussion.register`, `discussion.summary_record`. Normative closed schemas and registry bytes remain unchanged. See `work-tickets/template/ENTRY.md` for the caller sequence. Source template updates are distinct from LP-05 caller installation.

Entry verifies the actual CLI process CWD and reads exact saved assignment/CWD bindings from at most 100 registered routing headers. It performs no directory scan or write. Known scope resolves; missing/ambiguous scope returns nullable selection and bounded exact choices. Optional supplied binding must already be verified. CWD alone never invents an actor. The responsible manager binds a subordinate with exact saved evidence, original authority, assigned ticket/role and grants contained by its own assignment. Saved local envelopes are trusted evidence, never a claim of native host attestation.

Bound Resume exposes assigned role, unfinished discussions, saved headers, phase/checkpoint status and source limits. Existing discussions offer owner context/prior-checkpoint/fresh choices; unavailable native chat asks the owner. A new discussion preserves unfinished peers. Registration reuses its still-open actor/phase on re-entry and supports open peers without an exclusive lock. Inline children retain their actual writer and parent, may append to the parent discussion, and cannot register a phase or receive wider mutation grants.

Each summary appends an immutable journal entry. `recorded_item_refs` pin exact committed mutation receipts in the selected scope; capture-only thoughts and Threads remain separate. Direct fronting entries drive current phase by `(commit_seq,event_ordinal)` among open discussions. Inline-child entries remain visible without phase competition. Plan card, sidebar highlight, Focus click and saved log share one captured projection. Both pages embed receipt payloads and need manual refresh; no native transcript, task, message, schedule or history cursor is created. Closed-peer projection and actual independently reviewed checkpoint closure are implemented by S2 below.

A07 proof runs `python3 -m unittest discover -s launchpad/tests -p 'test_lp03_discussions.py'` and `node launchpad/tests/host/verify_lp03_discussions_host.cjs --browser chrome --root <disposable-fixture-root>`. The public suite preserves exact request/stdout/exit, fresh-process canonical/hash readback, real write/selector/readback/reply fault boundaries and retry receipts. Set `LP_A07_REPORT` to an absolute report path to retain raw evidence before test temporary fixtures are removed. Host evidence uses installed Google Chrome with an isolated disposable browser profile and actual public mutations; no existing browser profile or live board is changed.

## Reviewed discussion checkpoints (LP-03 A08)

The bound fronting main uses the existing public `checkpoint.prepare`, `checkpoint.apply`, and `checkpoint.close` operations. This local source workflow does not install a native-history checkpoint caller. Every operation retains exact current plan/ticket/object expectations and an idempotency key; direct and transaction subrequests use identical guards.

Preparation requires `previous_accepted_ref` explicitly: `null` for the first accepted checkpoint for that ticket and conversation phase, otherwise the latest exact accepted closed checkpoint reference. The selected open discussion supplies its phase and lower boundary. The caller supplies the committed high-water, declared exact raw input references, and next action. Preparation freezes only the selected discussion's journal entries in that interval plus declared inputs; the predecessor establishes continuity, never coverage of a peer. Original record bytes and input hash remain inspectable. A missing declared raw source or unresolved journal gap prevents completion; the standard native-history-unavailable disclosure restricts coverage to saved journals.

Reconcile inline using existing named operations and exact expectations, then apply. The existing `patch_preview_digest` is `core.store.digest({"input_sha256": checkpoint.body.input_sha256, "patches": patches})`. `patches` is the ordered prospective manifest of changed content/category/reference/source-item/edge/acceptance/presented-batch records against the committed preparation snapshot, each containing `uuid`, `body`, `source_refs`, `extensions`, and `lifecycle`. Include mutations before `checkpoint.apply` in one transaction, or deliberately commit them first and compute the same manifest. The operation records exact final patched references. The preparation and reconciliation must each have a committed readback before review/closure. No parallel publisher or schema fields are introduced.

An independent fresh `checkpoint-reviewer` actor is manager-bound with saved actual host evidence and a ticket-scoped evaluation assignment whose node is the checkpoint UUID. It inspects the original raw inputs and exact reconciled checkpoint and patch readbacks. Save its existing typed review envelope with `mode: "checkpoint-raw-source"`, passing verdict/no findings, `subject_refs: [reconciled_checkpoint_ref, ...patched_refs]`, digest of those subject references, exact original `evidence_refs`, its assignment UUID and independent writer. Its saved content report uses JSON `checkpoint_ref`, `input_sha256`, `raw_input_refs`, `patched_refs`, `readback_refs`, `reviewer_actor_uuid`, and `source_review: true`. These are report content, not new normative envelope/body fields. `attempt_uuid` remains a report's opaque evaluation identifier here; LP-04 owns autonomous attempt registration and claims. Saved trusted local evidence is not native identity attestation or proof of native-history completeness.

Closure requires that exact review and ordered `readback_refs: [reconciled_checkpoint_ref, ...patched_refs]`. It rechecks source bytes, original digest, current patched revisions, independent reviewer/assignment/report, and latest accepted ticket/phase predecessor before closing only the selected discussion. A peer acceptance makes an older preparation stale; prepare a fresh packet rather than relabel an old review. Failed/incomplete/stale reviews, conflicts and missing declared raw inputs preserve prior accepted coverage and open state. Nested edits after closure cannot change its reviewed patch within the same transaction.

The checked Checkpoint row opens the same saved log, now including the accepted checkpoint and exact uncovered journal references. Entries after high-water stay uncovered; original summaries, corrections and open questions stay visible. All phase peers must have accepted closure before the phase checks; no next-mode condition is required. A new open peer unchecks the phase without removing historical checkpoints. Historical pin inspection retains its exact discussion/checkpoint and makes the journal/native boundary explicit. These operations neither write `CHECKPOINT.json` nor advance native cursors or release autonomous claims.

Public proof: `python3 -m unittest discover -s launchpad/tests -p 'test_lp03_checkpoints.py'`. Optional `LP_A08_REPORT=<absolute-file>` retains raw requests/argv/CWD/environment/stdout/exits and physical canonical before/fault/replay snapshots before fixtures clean up. Installed Chrome proof: `NODE_PATH=<verified-playwright-root> node launchpad/tests/host/verify_lp03_checkpoints_host.cjs --root <new-disposable-fixture-root>`; it saves exact raw CLI/readback files, screenshots and browser report, then closes its browser.

## Requester state and reviewed inline support (LP-03 A09)

The bound `db.mutate` operation `state.check` saves an independent position for each exact requester, conversation/monitor mode, and normalized plan/ticket scope. `exclude_actual_self` filters the actual writer only; a child with parent attribution remains another writer. First use saves a baseline. Later calls return exact saved check references, prior/current check times, snapshot hashes, added/changed/removed references, unchanged ongoing run references, and gaps. Resolve returned record references through the existing read-only provider for writer/source details. Observation records, receipts, selector generation, and cosmetic observation clocks do not become substantive deltas or update `last_progress_at`, checkpoint coverage, or approval. Meaningful saved worker summaries remain substantive changes even when `last_progress_at` is unchanged. Actual native process liveness stays unknown without a separate host observation; a saved child return never certifies indefinite execution.

Pass the exact prior position in `expected`, the current plan expectation, and an idempotency key. A paginated check freezes its observed generation/high-water. Preserve its `continuation` and original limit/filter to inspect subsequent pages; the acknowledged high-water advances after the final page. Repeating a page, including with a fresh request key, returns that saved page. Omitting a pending continuation resumes its initial page and does not discard the unfinished interval. Optional `acknowledge_high_water` must equal a fully inspected final high-water; pending or forged acknowledgments fail. New changes after the frozen boundary remain for the next check. Checking never substitutes for D-058 mutation expectations. `include_history:true` includes inactive/current superseded identities; retained revision bodies remain retrievable through the existing history reader.

An assigned inline child can `support.report_submit` but cannot patch the shared corpus. Save an exact existing `content` JSON report with `assignment_uuid`, ordered `source_base_refs`, and ordered `suggested_operations`. These are report content conventions, not new normative fields or a report kind. The report's actual writer must match the assigned child. Source/base pins must include every existing target and dependency referenced by the bounded suggested content operations. Submission records report readiness and its own receipt while preserving ticket content.

The fronting parent inspects the report and obtains a fresh independent manager-bound `support-reviewer` evaluation against the exact report, source/base bytes, and `core.store.digest(report.body.content)`. Save a typed passing `review` with `mode:"support-raw-source"`, `subject_refs:[report_ref,...source_base_refs]`, the same subject digest and evidence references, no findings, and an exact content report whose JSON is `report_ref`, `source_base_refs`, `preview_digest`, `reviewer_actor_uuid`, and `source_review:true`. Reviewer assignment node is the report UUID. The reviewer differs from the main, child, and source producers; its identity is not reused for another integrated report. Saved trusted local envelopes do not attest native host identity or native-source completeness. LP-04 owns actual autonomous evaluation attempts/claims.

Only the assigned fronting parent may `support.integrate` with that exact review, digest, report/source/base pins, original authority, and current expectations including the staged submission. It applies the reviewed suggestions through the existing atomic transaction publisher. A newer main target/source revision conflicts. Report-ready, factual report acceptance, canonical integration, and their receipts remain distinct; factual acceptance does not grant owner direction. Replay with the original request key returns the original receipt, while a new integration key for the same report refuses duplicate application. Direct and nested operations use the same guards. The current captured discussion log includes saved checks, actual changed records, and these support facts; historical pins retain their original content until the owner chooses Current.

Run `python3 -m unittest discover -s launchpad/tests -p 'test_lp03_state*.py'`; set `LP_A09_REPORT` and `LP_A09_PHYSICAL` to absolute paths to preserve raw requests/stdout/readbacks and literal physical fault/replay files before disposable fixtures clean up. Run installed Chrome evidence with `NODE_PATH=<verified-playwright-root> node launchpad/tests/host/verify_lp03_state_host.cjs --root <new-disposable-fixture-root>`. Monitor-mode fixtures use retained saved headers only; no live task, schedule, message, or caller adoption is started by these tests.


## LP-04 A10 exact autonomous jobs

The public CLI now installs `assignment.publish/bind/claim/release/handoff`,
`assignment.prompt_get/permissions/entries`, and the named `run.*` dispatch,
start, progress, summary, checkpoint, pause/block/resume and frozen-return facts.
These operations reuse the existing plan lock, prospective edits and immutable
publisher. Later independent acceptance, hierarchy editing and finalization
operations retain their separate release gates.

A manager publishes an immutable ticket-owned job naming an autonomous node
slot, exact node/definition/source references, role, manager, procedure digest,
checkout branch/HEAD, prerequisites, report path and return criteria. The
manager binds an actual runtime actor to that exact canonical assignment and
records a dispatch result only after the host action. Unknown ephemeral actors
cannot claim or acknowledge autonomous starts. Runtime children have scoped
attempt grants distinct from inline discussion contributions; evaluators have
an evaluation job, never the ticket claim. An existing slot gets a linked
replacement attempt rather than another job or an age-based takeover.

Saved runtime content evidence uses `proof_kind` dispatch/start_ack/inactive/
interrupt_ack/return; exact assignment reference, actor UUID, runtime kind/ID,
and `provenance` trusted-local-fixture or actual-runtime-tool distinguish its
origin. Actual-tool evidence retains the raw tool result. Dispatch evidence
names dispatched/failed and the supplied assignment digest. Start acknowledgment
pins the current attempt, loaded assignment/procedure digests and source pins.
Replacement requires the responsible manager and exact inactive predecessor or
acknowledged-interrupt evidence. A failed dispatch retains its fact without a
start. Saved local envelopes validate a trusted agent workflow; the CLI cannot
attest native identity, messages or full history independently.

The closed mutation response has no body-details field. Successful direct
`assignment.claim`/`assignment.handoff` return a serialized `claim_context` in
`continuation`, containing the complete stored briefing and exact assignment/
attempt pins from the committed generation. A transaction containing claims
returns serialized `claim_contexts`. Exact-key retry returns those original
contexts even after newer progress. `assignment.prompt_get` supplies explicit
current or pinned readback; it does not claim an unknown provider-composed
prompt was loaded. `assignment.entries` exposes saved lifecycle facts.

Claimed and running attempts both own the slot and show a spinning nested claim
symbol, while the acknowledged-start receipt remains independently visible.
The current replacement shows missing start until its own acknowledgment;
original abandoned claims and starts remain inspectable. End-turn checkpoints
retain resumable state and their clock, never return/acceptance. Return requires
an existing assigned frozen report file with exact retained hash, deliverable
references, checks/warnings/skips/deviations and the exact manager recipient.
The publisher must save the return fact before completion can be claimed.

A10 verification:

```sh
python3 -m unittest discover -s launchpad/tests -p 'test_lp04*.py'
python3 launchpad/tests/host/lp04_claims_sample.py <disposable-fixture-root>
node launchpad/tests/host/verify_file_host.cjs --browser chrome --root <disposable-fixture-root> --a10
```

The documented file-host command's `--a10` mode exercises real installed Chrome
against public-minted lifecycle views. Its generated runtime IDs and start
receipts are explicitly fixture evidence. Any separately retained actual
runtime-child dispatch/claim/loaded acknowledgment is reported distinctly;
no fixture establishes persistent-task messaging, scheduling or installed
caller adoption. No helper executes Git or grants publication authority.

### LP-04 A11 current return, distinct gates and responsible-parent acceptance

The named public `review.attempt_add`, `review.result_record`, `review.recheck_record`, `review.finding_add`, `review.finding_disposition`, `workflow.rework_add`, and the autonomous branch of `acceptance.record` now use the existing atomic publisher. Generic content/support acceptance keeps its original scoped provider contract. Generic CRUD cannot mint protected gate/attempt/acceptance records or causal `repair_of` edges.

An evaluator owns a published immutable `work_kind:evaluation` assignment, its actual dispatch, exclusive claim, loaded acknowledgment and running attempt. Its job source pins include exact bare subject refs. A11 `subject_digest` is SHA256 of the normalized ordered `subject_refs` array, including explicit item scope. `review.attempt_add` freezes that exact manifest before result. Each result needs a fresh independently bound actor/runtime and evaluation assignment; producer/manager or reused reviewer identity is refused. Job `return_criteria` includes the exact `gate:builder` or `gate:orchestrator` mode; these are conventions inside the approved existing string fields, not new schema fields.

The saved JSON content report is attributed to that evaluator and contains `evaluation_assignment_ref`, `evaluation_attempt_ref`, `reviewer_actor_uuid`, `subject_refs`, `subject_digest`, `independent:true`, `mode`, `evidence_refs`, `verdict`, `finding_refs`, `report_path`, and `report_file_sha256`. Save the assigned actual report file before referencing it; path/bytes and retained evidence must match. Verdict and report scope are exact. A result pass is distinct from the evaluator's own frozen `run.return_record`; parent acceptance requires both current passing modes from distinct fresh jobs/actors and those actual own returned report refs. Saved local structured reports enforce content/hash/scope; they do not cryptographically authenticate native actors or human approval.

Full returned scope is the exact returned attempt ref followed by its ordered frozen deliverable refs, each with actual full item IDs where applicable. Parent `acceptance.record` accepts only its own job's exact returned scope. Original saved acceptance instruction contains `kind:parent_acceptance`, exact `subject_refs`, `subject_digest`, ordered `gate_refs`, and `accepting_actor_uuid`. Partial accepted scope remains inspectable but does not release a full successor. An owner gate instead needs a separate original `owner_decision` evidence envelope with `kind:owner_acceptance` and its exact own subjects/gates, after its own prerequisites; a child's parent receipt never satisfies an enclosing owner gate.

Continuing rows remain `output_circle` when returned, passed, accepted without next start, or next dispatch failed/only claimed. Only a following slice's actual acknowledged start with the exact preceding full acceptance prerequisite produces `check_circle`. A normal following slice cannot start before that release, including an early immutable job that omitted it; do not silently repoint an early job. First-start guards revalidate current source and prerequisite pins. A resumed already-started attempt retains its original immutable briefing and source pins; a resumable checkpoint is still not return. Terminal autonomous siblings have no invented successor and check after their own parent acceptance. The same captured viewer separately shows eligible owner hand versus its own owner acceptance. New nested workflow structure/top-level phase routing remains A12 work.

A normative subject mutation atomically invalidates only affected active acceptance and current passing review revisions, requiring exact affected expectations. Historical original gates/approval remain retained; unaffected scoped content provider coverage stays with its original applicability owner. Linked repair uses a canonical causal finding plus its actual finding review gate, exact original direction and a `workflow.rework_add` obligation; `repair_of` edges preserve original subjects/revisions. Repair job pins that obligation, returns its own output, and fresh builder/orchestrator rechecks cover that current repair before a separate evaluator may validate the original finding's disposition. Findings retain original rule/description/evidence/scope; factual repair obligations grant no expanded owner direction.

Run public A11 checks with `python3 -m unittest discover -s launchpad/tests -p 'test_lp04_acceptance*.py'`, UI with the existing Node suite, and generate the disposable host with `python3 launchpad/tests/host/lp04_acceptance_sample.py <root>`. The documented host accepts `node launchpad/tests/host/verify_file_host.cjs --browser chrome --root <root> --a11`. Fixture native IDs, starts, gates and acceptance instructions are explicitly test data; installed Chrome and physical filesystem execution are real. Actual own native evaluator/next-start evidence and separate code lower/manager gates remain required before A11 acceptance. Definitions/callers/native transport/pilot adoption are later separately assigned providers.

### LP-04 A12 definition, checklist and prompt reconciliation

The installed provider adds the authored definition reads `workflow.node_get/outline/children/ancestors/dependencies/gates`, the checklist reads `checklist.current/obligations`, `prompt.get`, and the prospective pairs `workflow.edit_preview`/`workflow.edit_apply` and `checklist.reconcile_preview`/`checklist.reconcile_apply`. No parallel publisher is introduced: preview/apply reuse the existing prospective edit engine, the plan lock and the single immutable publication owner, and generic CRUD still refuses protected kinds.

Authored definition edits keep each workflow node's stable UUID and creation time, mint a new revision, and retain every prior revision. `workflow.edit_apply` is the named authority for the bounded subrequests `record.create`/`record.update` limited to workflow nodes, dependency edges and definitions; a parent/child/order move changes only those fields. Cycles in the node hierarchy and in `dependency` edges are refused. A rejected input with an unknown extension namespace fails `INVALID_SCHEMA` and its original request is retained under `.migration-reports/`, never dropped; imported definition text is inert data and is never executed.

An edit that would change the definition a live (`claimed`/`running`/`paused`/`blocked`) assignment pins is refused, so an active assignment is never silently repointed. A published-but-inactive job keeps its immutable node/definition pin; because that pinned revision is no longer current, binding or starting it against the changed definition conflicts rather than silently adopting it. Source/scope accounting reuses the existing coverage rows/holds, so an intentional item removal still needs a complete disposition.

The checklist is the `Checklist` category content. Its draft state is provisional; `checklist.current`/`obligations` expose each item as `pending` or `reconciled` against an exact approved SPEC digest, and unresolved carried obligations stay pending through reconcile. `checklist.reconcile_preview` requires exact approved-SPEC pins, binds the exact operations/coverage in its `preview_digest`, and `checklist.reconcile_apply` writes an exact `reference` binding (target kind `plan_entry`, exact `used_revision`/`used_sha256`/`used_stamp`) through the same atomic publisher. Nothing marks work delivered or approved.

`prompt.get` and the fullscreen node/prompt modal expose three distinct loaded-evidence classes: the authored `template` definition (inert), the stored `supplied` assignment briefing, and the child's `acknowledged` loaded hashes/runtime. They are never conflated. Identical display labels still preserve genuinely distinct actor UUIDs/runtime identities, and a prompt whose provider cannot be established from saved evidence is labeled `unknown`, never guessed. The portable card symbol/color derives only from the explicit current top-level workflow node; nested review/attempt/gate icons never roll up into the card. Chevron, name and description remain independent keyboard-focusable targets with focus return; owner gates show eligible only after their own real released prerequisites.

A12 verification:

```sh
python3 -m unittest discover -s launchpad/tests -p 'test_lp04_workflow*.py'
python3 -m unittest discover -s launchpad/tests -p 'test_lp04*.py'
node --test launchpad/tests/ui/*.test.cjs
python3 launchpad/tests/host/lp04_workflow_sample.py <disposable-root>
node launchpad/tests/host/verify_lp04_workflow_host.cjs --browser chrome --root <disposable-root>
```

Saved local envelopes and fixture IDs remain trusted-local evidence, not native identities or human approval. The parent/orchestrator separately owns the actual-runtime workflow/prompt chain; no fixture here establishes a native start, provider-composed prompt or installed consumer adoption.

### LP-04 A13 authorized integration and terminal release

The installed provider adds the authored operations `integration.record`, `ticket.finalize`, and `track.release_check` (tool `db.mutate`, grant `authorized operation recorder`). The helper executes **no** Git operation: it records and validates inspected, supplied facts only. Their availability is reported truthfully by `catalog.list`/`operation.describe`, and dispatcher wiring stays thin.

`integration.record` stores one exact `integration` body (closed `record.schema.json#/$defs/integration`). The four `*_ref` arguments name saved operation-inspection receipts; the body's string fields are reconciled by inspection rather than guessed: `candidate_digest`→`subject_digest`, the main/consumer/pull-source git ref names are read from the inspected receipts, and `pull_source_ref` (absent from the args) is read from the pull-verification receipt. The authorized checkout/branch/consumer checkout must match the applicable owner authorization scope receipt. The authorized commit, main integration SHA and pulled head SHA must be identical, main ancestry must be independently verified, and the pull must be verified into the named consumer checkout/ref. Commit-only, push-only, and an integration without the verified required pull each refuse with no mutation; wrong checkout/branch/ref/ancestry and missing authorization refuse the same way.

`ticket.finalize` requires the exact accepted candidate/scope (an active acceptance whose subject digest equals the candidate), the applicable owner authorization, the verified main ancestry and the verified required pull, then finalizes **once**: the ticket becomes `finalized` with `finalization_ref` pointing at the exact integration record, an open discussion is preserved unchanged, and a second finalization refuses without mutation.

`track.release_check` re-evaluates **all** plan dependency release conditions across every ticket and returns the completed/locked/unlocked result (the plan dependency graph is recomputed from current finalization receipts, workflow prerequisites and explicit holds). Unlock is eligibility only — no assignment, attempt, dispatch or event is created — and another unmet prerequisite keeps a successor locked. The generated timeline exposes each ticket's finalization state; a completed ticket's Final Commit is terminal with no invented next mode, and the card symbol still derives only from the explicit current top-level workflow node. A seed-only Plan Manager edit recomputes all four track paths; mid-build/terminal seed edits and authored blocked-SPEC content are refused.

A13 verification:

```sh
python3 -m unittest discover -s launchpad/tests -p 'test_lp04_finalization*.py'
python3 -m unittest discover -s launchpad/tests -p 'test_lp04*.py'
node --test launchpad/tests/ui/*.test.cjs
python3 launchpad/tests/host/lp04_finalization_sample.py <disposable-root>
node launchpad/tests/host/verify_lp04_finalization_host.cjs --browser chrome --root <disposable-root>
```

Saved fixture identities, authorization receipts, ancestry and pull facts are trusted-local evidence, not a real remote Git operation or human finalization. The parent chain separately owns the actual authorized commit/push/pull and the real fact store.
