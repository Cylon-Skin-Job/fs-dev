# Chat transport simplification — Roadmap preparation

## Readiness and authority

**Destination:** `roadmap-creation` through `mc-roadmap-creator`. **Status: READY_WITH_EXPLICIT_GAPS.** Prepared inline by the owner-facing supervisor on 2026-09-28T23:13:19.009654+00:00 under D-006. First Draft and independent review are complete; this report prepares the next assignment. No additional owner product decision is currently needed to begin Creator work. The next step is a separately authorized Roadmap Creation run, followed by its independent release validation and exact-candidate owner approval.

The proposed three SPEC outcomes are:

1. **Simplify the two transport entry files:** cohesive server domain dispatch and client connection/response responsibilities; preserve observable behavior.
2. **Unify chat command sending:** one client transport owner with truthful local outcomes, explicit identity and existing server acknowledgements.
3. **Handle receipt-status send outcomes:** a definitely unsent status inquiry exits response waiting promptly; ambiguous outcomes retain uncertainty. Neither outcome proves the original prompt was unsent or permits replay.

Recommended order is C1 → C2 → C3 to reduce shared-file rework. C1 has two candidate slice cards, so the draft has four cards inside three SPEC outcomes. C3 is independently fixable; the order is a recommendation, not an approved executable dependency. Do not parallelize writes to shared transport surfaces without assigned ownership.

## Exact input packet

Memory/controller homes are this folder and its `../../` Mission Control parent. Source checkout: `/Users/rccurtrightjr./projects/fs-dev`; branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, dirty. HEAD alone does not identify the product bytes.

| Input | Identity and use |
| --- | --- |
| [FIRST-DRAFT](FIRST-DRAFT.md) | CHAT-SIMPLE-DRAFT-001 rev1; SHA-256 `6e14ca1119c403754629dd463c838c62ccbe89b98ac7da9d6b2893d50f3f0393`; candidate outcomes/cards, proposed public-route smokes, guidance map and deferral contract |
| [Independent validation](reports/DRAFT-VALIDATION-01.md) | `c3f484628b94a215a641fdf9f0e8281c2a9ae8fca1067e41937d90acb9ea2688`; DRAFT_VALIDATED_FOR_DISCUSSION, four perspectives, no material findings |
| [Stage report](reports/STAGE-REPORT.md) | `c3e45b7004e956f0eeca376dbfa520363b6ad65cf39933ba4e7dc729f0d1b873`; assignment, research dispositions and exact evidence |
| [Source snapshot](SOURCE-SNAPSHOT.json) | `4756ff742ff7a4fa71927246aeded7660335caf0279e69e8994724b0413345f1`; 28 original intake hashes, preserved historical snapshot |
| [Standards research](reports/STANDARDS-REPORT.md) and [boundary research](reports/BOUNDARIES-REPORT.md) | Exact hashes bound by the stage and sweep; current guidance, transport semantics and targeted source locations |
| [Local return point](../../TICKET.md), [intent](../../INTENT.md), [decisions](../../DECISIONS.md), [issues](../../ISSUES.md), [capture](../../CAPTURE.md), [references](../../REFERENCES.md) and [index](../../index.json) | Reconciled D-004–D-006 and REF-013; all I-001–I-011 remain open with scoped dispositions |
| [Completed document sweep](../../.document-sweeps/runs/c04f71dab17e482d91cdb79816e7cfbd/report.md) | Run `c04f71dab17e482d91cdb79816e7cfbd`; input `dac011b88ffb01343bf5337e85aceadc3188b18b886c321e4e96e42c6feae0b7`; report `fcb12ff2e4b05651d6591b11729ae8444336b2c159b7492df685c40a46e6d077`; complete, no material documentation gaps |

The sweep covers the current reconciled package and independently matches the draft/review/stage, all 12 boundary-report product hashes and the 21 unchanged intake sources. Seven local records intentionally differ from the historical intake snapshot. This preparation report was written after the sweep and is not represented as part of its input. No other reviewed input was changed afterward.

## Preflight assessment and carried gaps

The direct owner conversation and D-004–D-006 establish coherent outcomes and scope. Current User Preferences, Code Standards router and all eight routed articles, plus Chat overview and stage evidence, were read for this planning run. Their constraints are carried concretely: cohesive deep modules; existing domain/store/receipt owners; portable explicit UI identity; canonical commands; server-owned acceptance and persistence; provider translation/retries in adapters; and public-route verification. The private transport refactor does not require a new general event bus or logger. Actual moved responsibilities and changed semantics require corresponding Chat Structure/protocol documentation updates in the later authorized work.

| Gap / related issues | Consequence and receiving assignment | Gate |
| --- | --- | --- |
| **R1 — send and queue outcomes**, I-011 | Creator maps authenticated send, pre-auth queue admission, definite refusal, caught exceptions and stale generation/workspace handling. Preserve `enqueued` / `uncertain` / `not_enqueued`; a boolean wrapper cannot stand in for that contract. | Settle before executable release of affected C2/C3 work; does not block Creator intake. |
| **R2 — complete migration inventory**, I-011/I-003 | Creator names every moved caller/response owner, removed raw-send bypass and shared non-chat regression surface. Choose focused modules and executable checks. | Settle before affected C1/C2 release; no unsupported all-sends-unified claim. |
| **R3 — status recovery transitions**, I-009/I-011 | Creator maps definite/ambiguous inquiry results to existing recovery states, deadlines, correlation and reconnect behavior. Preserve both acceptance and execution recovery entries and late matching responses. | Settle before C3 release; never infer rejection or resend the original prompt. |
| **R4 — actual baseline and deferral protection**, I-001/I-004 | Creator binds actual dirty source/build bytes and verifies that planned changes preserve request/thread/workspace/connection identity, receipt/dispatch ownership and future recovery repair options. | Before executable release and any affected consumer handoff. Hold only work that compounds a known residual. |

All four are technical work for the receiving stage, not unresolved owner product decisions. If research requires changed retry/resend/cancellation behavior, an external consumer contract or a consequential compromise to later repair, return that concrete choice to the owner before affected release.

## Deferrals and protected behavior

D-005's comprehensive Fusion/OpenCode send, retry, execution and UI mismatch map remains with the [parked same-folder task](codex://threads/01a0ea32-f152-77a2-afc2-b73e8976685a), resumed by the owner after this three-SPEC sequence is built and approved. I-007/I-008/I-009 retain their unresolved diagnosis and recovery evidence. Bounded current-source assessment supports preserving later repair through separate receipt, runtime, adapter and recovery owners; it is not proof the live incidents are harmless or solved. Hold any affected candidate that erases uncertainty/correlation or freezes the defect into a consumer API. Reliable accepted-prompt reconstruction is not released to new plugin consumers by this packet.

Preserve the existing two-second live-turn hourglass, provider retry ownership, server-owned Stop and acceptance, and no automatic prompt resend. I-002/I-005/I-006 broader retirement and Side Chat behavior, and I-010 memory attribution, remain separately owned residuals. The temporary `temp_chat_boundary_v1` sink keeps its explicit health-subscriber delete/migrate obligation. D-003's old 45-minute soak remains waived and historically unperformed; choose proportionate affected checks.

## Receiving assignment and verification

When authorized, `mc-roadmap-creator` should use this exact reviewed draft, deepen R1–R4 with bounded research, and prepare three executable SPEC candidates plus the roadmap/release manifest under a clearly assigned planning output directory here. Retain one author per artifact and independent validation, preserve other dirty-checkout writers, and stop for exact-candidate owner approval before implementation. Use the existing draft rather than repeating completed shaping unless changed evidence requires it. Before launch, recheck affected source identities and any active writer. The draft stage successfully exercised the required planning profiles; this preflight does not launch another stage.

Actually verified: current root/branch/HEAD; draft/review/stage hashes; source freshness; index schema; local file targets and whitespace; completed independent draft validation and document sweep. Root checked all 14 indexed Markdown files for file targets and trailing whitespace; the sweep checked 98 local targets. No broken targets or whitespace findings. Link anchors were not separately audited. Product tests/build/runtime operations were not run for planning; earlier runtime evidence remains dated. This packet is ready for Roadmap Creation with R1–R4 explicitly assigned, not a claim that the existing code or proposed implementation has passed product verification.
