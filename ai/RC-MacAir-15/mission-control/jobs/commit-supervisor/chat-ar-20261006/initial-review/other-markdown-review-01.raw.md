REVIEW_COMPLETE — **findings**, initial publication-scope review. Two material documentation findings remain. This does not certify the final integration candidate.

Reviewer: `/root/chat_commit_initial_review/other_markdown_review_01`, fresh independent read-only session; inherited settings, no overrides, delegation, repairs, staging or runtime operations. No files were written; the parent may preserve this report unchanged at the assigned raw-report path.

Reviewed identity:

- Source: `d15792920731f85e45b743519d4af2b807d95a9c`
- Target: `3356e1b73cc5d44028eac5baa02fd542a8bbc385`; source and target trees match.
- Candidate: `/private/tmp/chat-ar-integration-r6pe5gmi/candidate`
- Recorded staged tree: `44b2592705cdbc35620207e579113ede27a4a787`
- Actual cached diff: 1,593 paths; raw diff SHA-256 `9baa617c5facfd496c030cca9c1c08329adaf0b115ec37f689084ca6e93ebe7c`
- All 999 Markdown paths in `commit-paths.json` match the source bytes or absence exactly. All 1,699 intake Markdown records still match `source-intake-identity.json`; zero byte drift.

**OTHER-MD-01 — Duplicate YAML key rejects the live Chat Runtime Model frontmatter**

Severity: **material**. Confidence: **high**. Disposition: **open; bounded repair required**.

- Criterion: Wiki Style Guide requires strict YAML and valid frontmatter for edited pages; Wiki AGENTS requires truthful metadata on edited articles.
- Evidence: `ai/RC-MacAir-15/Wiki/007-Chat_System/006-Runtime_Model/PAGE.md` contains `metadata.last-modified` twice, at lines 5 and 55. Current candidate SHA-256: `ec38f18dc55ffb9d59f46683116aae158f2cf2643ae76a99a6f26df2d9f6d293`.
- Reproduction: parse the current file using the installed client `gray-matter`. It throws `duplicated mapping key at line 55, column 3`.
- Observable impact: `front-matter.ts:514` returns the entire unparsed document as body with empty metadata. `wiki-frontmatter.ts:70` then returns null frontmatter; `PageViewer.tsx:26` omits the title/description header and `:37` omits source metadata. The YAML envelope remains in the rendered body.
- Qualification: the duplicate exists in HEAD too; this is a retained defect in an edited, included article, not a newly introduced regression.
- Release condition: preserve the complete current preimage, retain one valid modification timestamp, and verify the current article parses with its expected title, description and source list.

**OTHER-MD-02 — Selected Launchpad instruction packages depend on deferred, absent procedures**

Severity: **material**. Confidence: **high**. Disposition: **open; integration-scope repair required**.

- Criterion: the assignment requires coherent publication units and specifically requires MC framework/setup dependencies to accompany their procedures or be deferred. The session contract requires exact authoritative procedures and usable handoffs.
- Evidence: the candidate includes the four new Launchpad AGENTS/index packages while omitting their mandatory referenced contracts and skills. For example, `launchpad/chat-harness-repair-and-testing/AGENTS.md:13,19,23` instructs readers to use files that do not exist in the candidate:
  - `launchpad/.agents/skills/mc-launchpad/SKILL.md`
  - `ticket-workflow.md`
  - `investigation-contract.md`
  - `.agents/skills/mc-memory-maintenance/SKILL.md`
  - `.agents/skills/mc-document-sweep/SKILL.md`
  - `.agents/skills/mc-preflight/SKILL.md`
  - `conversation-evidence.md`
- The same missing routes appear in `governed-events-and-ledger`, `plugin-foundation` and `plugin-views-and-provisioning` AGENTS files at lines 11/15, and the included `chat-integration-and-retirement/AGENTS.md:11,15`.
- Reproduction: resolve those relative links from each candidate AGENTS file; they are absent. They resolve in the source checkout, demonstrating an assembly dependency rather than a source-document typo.
- Observable impact: a session following the published folder’s re-entry instructions cannot load its mandatory Launchpad, history, investigation or schema procedures.
- Release condition: select a reviewed, closed dependency package, or defer/reconcile the operational instructions while retaining the needed durable notes. Preserve the explicitly pending MC setup acceptance; do not convert archive inclusion into operational setup acceptance.

Publication classifications:

| Unit | Recommendation and evidence |
|---|---|
| **590 Wiki leaves** | Include together, subject to the two repairs above. This comprises 585 Markdown leaves plus five Wiki-local TOMLs. All 61 deleted Wiki Markdown leaves have byte-identical current history counterparts. The 419 `.versions` entries are durable article history, including retirement relocation; do not filter them out as fixture copies. |
| **Wiki workflow package** | Include its seven Markdown files and five TOMLs with `008-Workflows/002-Wiki_Update/PAGE.md`. They are passive definitions. The setup receipt explicitly discloses unverified runtime profile selection/nested spawning; no indispensable new owner choice was identified for archiving this package. |
| **13 Issue leaves** | Include the 12 Markdown files and `Issues/content/tickets.json` together. All ten local dirty tickets’ titles and states agree with the rendering index. RCC-0087, RCC-0092 and RCC-0106 are closed as superseded, without claiming implementation. |
| **238 Capture Markdown + 311 companions** | Include as historical documentation/evidence. The companion manifest’s 262 JSON files all parse and contain baselines, source/article fingerprints, snapshot/change manifests and bounded verification receipts. The 32 Python/eight CJS files are task-local historical verification/writer tooling; preserve them without invoking them or presenting their old results as current proof. Six diffs/two patches preserve article evidence. The 039 HTML is a static illustration. |
| **041 support preimages** | Include with cleanup records. `SUPPORT-*-PREIMAGE.md` are explicitly authored support-file history, unlike copied runtime fixtures. |
| **Capture 035 evidence** | Defer as a separate record/evidence unit. Its 313 preliminary Markdown paths mix authored reports, copied `preedit`/`pre-doc-*` Wiki/source files and generated Playwright `error-context.md`. Do not include recursively by extension. |
| **MC framework/setup** | Defer the executable framework, configuration, indexes and operational package as one separately reviewed unit. Its original implementation receipt authorizes setup/rehearsal; its final report explicitly retains owner setup acceptance as pending. Historical completion reports do not release that gate. |
| **Nested rehearsal/fixture/recovery trees** | Exclude from this publication unit. Preserve source bytes; no deletion is recommended. |
| **Generated/live state** | Exclude Wiki `.audit-state.json`, view/session state, runtime databases/backups, raw browser traces and temporary runtime profiles. |

The new native-listener direction is explicitly future work in the inspected Wiki and plugin records. Wiki pages link `plugin-foundation/{DECISIONS,ISSUES}.md`; retain those durable authority/gap records even if the operational framework remains deferred.

All five lenses were covered:

- **Behavior & Verification:** strict parsing across all 174 live Wiki pages; 119 dirty live articles had no envelope/schema issues apart from OTHER-MD-01. Issue state/title consistency and source/candidate equality were checked.
- **Standards Compliance:** complete assigned session/workflow/review contracts, root/memory/Wiki instructions and article policies read. Legacy metadata on untouched pages was not promoted into repair scope.
- **Integrations & Dependencies:** Wiki package closure, ticket rendering index, archive companions and Launchpad procedure closure examined; OTHER-MD-02 records the concrete assembly gap.
- **Forward Compatibility:** inspected plugin/native-listener/storage direction remains distinguished from implemented behavior and unresolved choices. No speculative future requirements added.
- **Wiki Impact:** zero unresolved relative links or listed `fusion-studio*` source paths in the source’s live Wiki; zero broken live Wiki relative links in the candidate. Deleted-page/history preservation was independently compared by bytes.

Exact inventory selectors and fingerprints use the immutable intake, sorted by `path`, serialized with `json.dumps(entries, sort_keys=True, separators=(',', ':'))`:

- Wiki: prefix `ai/RC-MacAir-15/Wiki/`, with `.md` suffix or `.codex/` prefix — **590**, SHA-256 `725d704d45198f48885d6b0506375cbcefa3bee27ff6a9804bc4615c78561348`.
- Captures: prefix `ai/RC-MacAir-15/Captures/`, `.md` suffix, excluding `/035-Composer_Typing_Regression/` — **238**, SHA-256 `97cbce7584b6094609f90e89cfa89e1a63b87909dfab96dc669a9276fc1b2d13`.
- Capture 035: its exact prefix plus `.md` suffix — **313**, SHA-256 `1aff45880464c92195f0a8ee97e053d4deef514081c48b87a1ec92d59adf2563`.
- Companion array: `initial-review/capture-evidence-companion-paths.json` — **311**, file SHA-256 `92e042e127912920617d209a3ba1ce081702bb89de1cd3ad00c4a344622978a7`.
- Intake file SHA-256: `5fc319987adee1cfb6e009547fc4557a6d51cd9e50ab3df8cad2f32a02368132`.
- Preliminary 1,241-path file SHA-256: `3339b5a45badce2b70d78b9bbee5491312eddcddba50d7c7489c71a93de38bcb`.

Advisory: two modified articles lack a byte-identical HEAD snapshot anywhere in current Wiki `.versions`—the Code Standards heading and Chat Runtime Model. Git retains those baselines; the available chronology does not establish a further material preservation violation. Preserve exact preimages during the required repair.

Limits: this was bounded initial documentation/scope QA, not a complete factual recertification of every historical report, product test run, actual app rendering session, MC setup acceptance or publication approval. No archive checker/writer scripts or runtime processes were executed.

