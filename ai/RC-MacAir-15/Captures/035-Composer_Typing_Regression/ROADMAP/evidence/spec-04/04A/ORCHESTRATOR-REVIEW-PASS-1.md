# SPEC-04 04A Orchestrator Review — Pass 1

Reviewer: `/root/spec04_04a_acceptance` (fresh read-only clean-room reviewer)

Disposition: **FINDINGS**

## Material findings

1. **High — R1 CDP zero-count evidence is fail-open.**
   `r1-electron.mjs` initialized all named targets to zero and asserted a positive
   control only for `ChatAreaFooter`. A target omitted from CDP results could
   therefore pass as quiet. Repair must record discovery independently from
   invocation counts, require every zero-asserted target to be observable, and
   rerun the production R1 gate.
2. **Medium — the parent host retained a whole-collection thread subscription.**
   `useLegacyChatHost.ts` subscribed to `state.threads` and searched it inside
   the parent even when explicit production callers already supplied the exact
   row metadata. Repair must remove that cross-session observation or replace it
   with an exact stable selector and prove unrelated-row updates stay local.

## Evidence inspected

- All 19 files in `SOURCE-SHA256.txt`; 19/19 hashes matched.
- Scoped `git diff --check` passed.
- Production source and `dist` contained no `__fusionChatArchitectureProbe`.
- Raw R1 run `chat-arch-1790131246380-c6f53d4235`.
- Raw correctness run `chat-arch-1790131236480-fa428e6195`.
- Raw V-SUBMIT run `chat-arch-1790131435740-58ab6e8d09`.
- Builder report and builder-owned clean-room review.

## Deviation disposition

- D-04A-1 accepted as mechanically necessary extraction.
- D-04A-2 accepted as evidence-root compatibility bookkeeping, with the
  advisory that runner receipts are not cryptographically bound to every
  product source file.
- D-04A-3 accepted for 04A only; the 530-line legacy host remains mandatory 04C
  retirement work.

Both material findings are routed back to the original 04A builder for
fail-forward repair. A fresh builder-owned review and a fresh orchestrator-owned
acceptance review are required after repair.
