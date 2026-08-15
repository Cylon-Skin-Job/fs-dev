# Office Editor Recovery Roadmap — Retired

**Status:** `SUPERSEDED`  
**Superseded:** 2026-07-21 by explicit owner direction

The former SPEC-04R/SPEC-05R recovery roadmap addressed a continuous watcher, cross-workspace convergence, retry, and removal-journal design. That product design is retired and must not be implemented, recovered, or used as acceptance authority.

Current palette authority is:

1. the owner's explicit 2026-07-21 direction;
2. `GUIDANCE.md` §4;
3. `ROADMAP.md` cross-SPEC contract 5; and
4. current SPEC-04/05 packets only where they do not conflict with those higher authorities.

The replacement behavior is a simple source selector:

- `sync_enabled: true` uses only `System_Manager/global-configs/office-custom-color-pallete/colors.json`;
- `sync_enabled: false` uses only the workspace-local `ai/<machine>/System/config/colors.json` array;
- Add/Remove write only the selected source;
- toggling changes only the selector and preserves both arrays; and
- no watcher, merge, fanout, convergence, reconciliation, retry scheduler, removal journal, timestamp, or background recovery machinery exists.

Any implementation already produced under the retired recovery packets is evidence and reusable code only if it serves the replacement contract. Remove obsolete machinery as part of completing SPEC-04/05 and list every deviation from the old packets in the completion report.

Execution follows the current fail-forward workflow: perform necessary integration, document all deviations and downstream effects, repair through independent review until clean, and present the entire completed SPEC to the owner for explicit acceptance before starting the next SPEC.
