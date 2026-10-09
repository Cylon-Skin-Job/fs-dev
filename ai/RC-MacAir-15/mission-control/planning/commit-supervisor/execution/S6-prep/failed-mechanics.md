# Preserved nonmutating authoring/read attempts

Substantive failed attempts and successful corrections are recorded in
deviations.json and their exact raw logs. Additional tooling attempts:

- During final self-review one multi-file apply_patch transaction failed context
  matching before any file changed. Exact tool text: `Script error: apply_patch
  verification failed: Failed to find expected lines in /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/planning/commit-supervisor/execution/S6-prep/recipe.md:
  No source/Alpha DB/cache restoration occurs.` Readback confirmed all hunks
  unapplied. Correct context was then supplied and the complete transaction passed.
- A read of `planning/commit-supervisor/APPROVAL.json` returned exit1:
  `cat: planning/commit-supervisor/APPROVAL.json: No such file or directory`.
  Exact file discovery found the existing `execution/approval-receipt.md`; no
  authority was fabricated, and the complete receipt was already read at entry.
- A preliminary preservation comparison asserted an empty old-key drift map
  when the map sizes differed. Exact output was `AssertionError: {'unowned': []}`.
  Union-key readback found only root's newly created
  `E/S4-wiki-builder-assignment.md`. Raw before/after metadata is retained and
  final preservation explicitly records that coordination addition.

These authoring/read attempts caused no candidate/source/profile effects and
do not change fixture intent. Supplied-format precondition and symlink readback
self-review refinements were followed by distinct final negative/recovery checks;
successful live UI evidence is reused for unaffected observation logic.

The first freeze construction assumed the runtime contracts lived in the planning
bundle root. It stopped before creating any manifest with exact output:
`AssertionError: /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/planning/commit-supervisor/runtime-rehearsal-manager-contract.md`.
File discovery confirmed both contracts under `execution/`; final freeze uses
those exact previously read paths.
