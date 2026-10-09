# Documentation repair packet

Initial staged tree: `44b2592705cdbc35620207e579113ede27a4a787`; candidate `/private/tmp/chat-ar-integration-r6pe5gmi/candidate`. Origin: fresh child `/root/chat_commit_initial_review/other_markdown_review_01`; independent validation by `/root/chat_commit_initial_review`. Both raw findings remain preserved unchanged in [other-markdown-review-01.raw.md](other-markdown-review-01.raw.md).

## OTHER-MD-01

Severity `material`, confidence `high`, proposed disposition `open`.

Authority: edited Wiki article strict YAML/frontmatter and truthful metadata rules. Affected artifact: `ai/RC-MacAir-15/Wiki/007-Chat_System/006-Runtime_Model/PAGE.md`, initial SHA-256 `ec38f18dc55ffb9d59f46683116aae158f2cf2643ae76a99a6f26df2d9f6d293`. The repeated `metadata.last-modified` at lines 5 and 55 makes actual installed `gray-matter` throw. The renderer catches this by retaining the complete unparsed input as body with empty metadata, so the Wiki header/source metadata disappears and the YAML envelope enters the rendered body.

All four materiality dimensions are present: article policy violation, an edited included article, observable reader/rendering loss, and actual parser execution plus source fallback. The duplicate is also present in the target baseline; retain that provenance rather than calling it a newly introduced regression.

Independent validation: [document-findings-validation.json](document-findings-validation.json), SHA-256 `95a6e24e3b1c455a0faacab4785f9d91cddee365e7ebe46b0069cc7e8e5952a4`, first execution. No live rendering/app operation was performed.

Bounded repair responsibility: this article's valid metadata only, with exact current preimage retained; preserve source list/body/authority claims. Release: one valid modification timestamp, successful actual parser output with expected title/description/source list, source/body preservation evidence, fresh manager-assigned documentation handoff review. Check affected article metadata/rendering through existing code; a broad prose rewrite is unnecessary.

## OTHER-MD-02

Severity `material`, confidence `high`, proposed disposition `open`.

Authority: coherent publication units and deferred MC operational-framework boundary; exact session procedures must be loadable before their assigned operations. The four new operational Launchpad instruction/index pairs would be published without their required Launchpad/history/investigation/schema procedures, which resolve in source but are absent from the isolated candidate. A session following them cannot perform the mandated re-entry.

Exact affected new leaves (all absent in target and source HEAD):

- `launchpad/chat-harness-repair-and-testing/AGENTS.md` and `index.json`
- `launchpad/governed-events-and-ledger/AGENTS.md` and `index.json`
- `launchpad/plugin-foundation/AGENTS.md` and `index.json`
- `launchpad/plugin-views-and-provisioning/AGENTS.md` and `index.json`

All paths above are under `ai/RC-MacAir-15/mission-control/`. Complete current hashes and exact missing relative links are recorded in [OTHER-MD-02-operational-paths.json](OTHER-MD-02-operational-paths.json), SHA-256 `0fa1745d10f042d7b5520ebcf3b468f4a0c1b6e12cb44ae38dcf80696567914a`. Independent link resolution is the second execution in the raw validation record. All four materiality dimensions hold for these newly selected instruction packages.

Baseline clarification: `launchpad/chat-integration-and-retirement/AGENTS.md` is a **tracked** existing baseline, not a new file. Target/source HEAD SHA-256 is `2a88395345613b5a680cc71f987a7a4ae449ebc60863df0899e03f2bf9825527`; current source/candidate SHA-256 is `886fe0f833d9eacc055166f5a6184f7d39c330ef772f860a8b438d0fb1e08825`. Its update narrows remit under D-008 and adds Main-chat startup/Checkpoint/Memory Maintenance steps. Six linked procedure gaps existed in the old baseline too. Preserve the tracked baseline and the complete current source/preimage; do not delete that existing instruction file or describe its old routing debt as a newly introduced defect. A candidate assembly change may defer its operational update while retaining the source-native D-008 decision/intent and accepted technical evidence. The supervisor chooses the coherent current assembly.

Required result: defer/reconcile operational instructions/indexes or include an independently reviewed closed dependency package. Retain durable plugin decision/issue records required by live Wiki links and all accepted Chat evidence. Do not imply MC setup acceptance or start a role merely by retaining archival notes. Root has established that the MC framework's setup-owner acceptance remains pending; original source bytes remain untouched.

Release: current selected publication scope contains no newly claimed runnable/re-entry package with omitted mandatory procedures; exact exclusions and retained baseline debt are documented; fresh independent handoff review confirms the resulting scope and source/preimage protection.

No necessary new owner product choice is identified. These are bounded established-intent repairs/assembly work for the assigning Commit Supervisor, not reviewer-authored feature scope. Reports here do not repair, stage, publish or resolve the findings.

