# Fusion Studio Spec Index

Specs generated from code standards audits, architecture planning, and event/ledger design work. Each spec includes dependencies, gotchas, and silent fail risks.

> **Provenance authority:** Current SPEC-32 through SPEC-40 planning authority is the [Provenance Spec Set Map](../../008-Provenance-Temp/00-provenance-spec-set-map.md) and linked files in `008-Provenance-Temp`, together with their referenced durable wiki pages. Same-name SPEC-32/33/34 files in this `003-TODO/specs` directory are superseded snapshots and must not be implemented. The Temp set remains `DISCUSSION DRAFT`; implementation begins only from an explicitly frozen, owner-approved slice packet, after which promotion must update this index and replace/archive stale copies atomically. This correction is tracked by the [2026-07-15 provenance cross-article findings](../../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat; decision-tagged findings remain open.

---

## Recommended Execution Order

### Phase 1: Foundations (CSS tokens + z-index)
| Order | Spec | Priority | Risk |
|-------|------|----------|------|
| 1 | [SPEC-15](15-css-zindex-standardization.md) | Z-index hierarchy | ✅ DONE |
| 2 | [SPEC-17](17-css-spacing-standardization.md) | Spacing + font tokens | ✅ DONE |
| 3 | [SPEC-16](16-css-color-standardization.md) | Color cleanup | LOW — Vite leftovers |

### Phase 2: CSS Cleanup (depends on Phase 1)
| Order | Spec | Priority | Risk |
|-------|------|----------|------|
| 4 | [SPEC-21](21-inline-styles-extraction.md) | Inline styles -> CSS | MEDIUM — blocked by SPEC-17 |
| 5 | [SPEC-18](18-rv-prefix-migration.md) | .rv- class prefix | MEDIUM — 395 classes, querySelector gotcha |

### Phase 3: Server Module Extraction
| Order | Spec | Priority | Risk |
|-------|------|----------|------|
| 6 | [SPEC-04](04-thread-manager-split.md) | ThreadManager split | LOW — no dependencies, do first |
| 7 | [SPEC-03](03-thread-ws-handler-split.md) | ThreadWebSocketHandler split | MEDIUM — depends on SPEC-04 |
| 8 | [SPEC-11](11-compat-js-split.md) | compat.js split | MEDIUM — migration infrastructure |
| 9 | [SPEC-10](10-qwen-harness-split.md) + [SPEC-14](14-gemini-harness-split.md) | Qwen+Gemini shared extraction | HIGH — subtle differences |
| 10 | [SPEC-01](01-server-js-decomposition.md) | server.js decomposition | **CRITICAL — do LAST** |

### Phase 4: Client Component Extraction
| Order | Spec | Priority | Risk |
|-------|------|----------|------|
| 11 | [SPEC-05](05-ws-client-split.md) | ws-client.ts split | HIGH — turn lifecycle fragile |
| 12 | [SPEC-02](02-robin-overlay-split.md) | RobinOverlay split | MEDIUM — after tokens in place |
| 13 | [SPEC-08](08-hover-icon-modal-split.md) | HoverIconModal split | LOW — module-level state gotcha |
| 14 | [SPEC-06](06-voice-recorder-split.md) | VoiceRecorder split | LOW — cleanup order matters |

### Safe Anytime
| Spec | Priority | Risk |
|------|----------|------|
| [SPEC-12](12-emoji-trigger-split.md) | LOW — optional data extraction | Minimal |
| [SPEC-19](19-chat-harness-picker-fetch.md) | LOW — remove redundant fetch | Minimal |

### Architecture Corrections
| Spec | Priority | Risk |
|------|----------|------|
| [SPEC-27](27-tints-to-theme-system.md) | **HIGH** — tints are styles, not state | MEDIUM — touches state, themes, CSS across all views |
| [SPEC-28](28-universal-sidebar-collapse.md) | **MEDIUM** — collapse/resize UI missing in non-chat views | LOW-MEDIUM — touches wiki, file explorer, agents layouts |
| [SPEC-32](../../008-Provenance-Temp/32-resource-event-sync-controller.md) | **HIGH** — central UEB resource sync + view data cleanup | DISCUSSION DRAFT — current planning authority; freeze/approve slice packet before implementation; HIGH blast radius |
| [SPEC-33](../../008-Provenance-Temp/33-universal-ledger-file-versioning.md) | **HIGH** — SQLite file versioning + provenance over UEB events | DISCUSSION DRAFT — current planning authority; later package blocked by listed ULV owner decisions |
| [SPEC-34](../../008-Provenance-Temp/34-ui-action-provenance-module.md) | **HIGH** — central UI-origin command context and server-owned `uiActionId` | DISCUSSION DRAFT — current planning authority for SPEC-32 `RSC-D12a`; freeze/approve slice packet before implementation |

### Ready Chat Implementation Package

| Package | Order | Status | Risk |
|---|---|---|---|
| [RCC-0108 roadmap](RCC-0108-ROADMAP.md) | [01 runtime ownership](RCC-0108-SPEC-01-runtime-drain-ownership.md) → [02 server step/frontier](RCC-0108-SPEC-02-server-step-frontier.md) → [03 terminal errors/diagnostics](RCC-0108-SPEC-03-terminal-errors-diagnostics.md) → [04 client routing/frontier](RCC-0108-SPEC-04-client-routing-frontier.md) → [05 presentation/acceptance](RCC-0108-SPEC-05-presentation-acceptance.md) | READY FOR IMPLEMENTATION | HIGH — sequential cross-layer chat lifecycle work; pause overlapping implementation |

### Do Not Implement (deprioritized or no-split)
| Spec | Reason |
|------|--------|
| [SPEC-07](07-catalog-visual-split.md) | One job (data catalog), acceptable size |
| [SPEC-09](09-base-cli-harness-split.md) | One job (base class), acceptable size |
| [SPEC-13](13-live-segment-renderer-split.md) | **DO NOT SPLIT** — breaks completion detection |
| [SPEC-20](20-state-store-decoupling.md) | Zustand pattern is standard for React |
| [SPEC-22](22-app-tsx-import-reduction.md) | Root orchestrator, imports are composition |

---

## Dependency Graph

```
SPEC-17 (tokens) ──blocks──> SPEC-21 (inline styles)
SPEC-17 (tokens) ──should──> SPEC-02 (RobinOverlay)
SPEC-15 (z-index) ──should──> all CSS work

SPEC-04 (ThreadManager) ──before──> SPEC-03 (ThreadWS)
SPEC-03 (ThreadWS) ──before──> SPEC-11 (compat)
SPEC-11 (compat) ──before──> SPEC-10/14 (harnesses)
ALL server specs ──before──> SPEC-01 (server.js)

SPEC-05 (ws-client) ──before──> SPEC-02 (RobinOverlay robin handlers)
SPEC-34 (UI action provenance) ──before──> SPEC-32 UI-origin mutation producer conversion per view
SPEC-32 (resource event sync) + relevant resolved ULV blockers ──before──> SPEC-33 slice that depends on them
```

## Top 5 Legacy Split Silent Fail Risks

1. **ws-client setPendingTurnEnd** — if not cleared on turn_begin, new turns finalize immediately (past bug)
2. **server.js checkSettingsBounce** — if enforcement lost during extraction, AI writes to settings/ folders
3. **server.js session closure** — if session not injected to extracted handlers, wrong session mutated
4. **ThreadManager autoRename race** — closeSession during Kimi subprocess causes state inconsistency
5. **Qwen/Gemini provider ID** — hardcoded in shared base breaks token normalization
