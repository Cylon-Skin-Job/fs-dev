# Clipboard Keychain Redesign — Implementation Briefs

**Master spec:** `docs/CLIPBOARD_KEYCHAIN_REDESIGN.md`
**Standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`

Each session brief is self-contained — a worker session reads its brief, executes, returns a status block. The orchestrator (IDE Claude + user) verifies and commits between waves.

---

## Wave dependency graph

```
Wave 0 (decisions, no code)
  WAVE-0-DECISIONS.md   ← lock D1, D2, D3, D4
        │
        ▼
Wave 1 (parallel — dispatch all four at once)
  W1A secret-detector ──┐
  W1B log-preview ──────┤
  W1C migration ────────┤
  W1D redaction-map ────┘
        │
        ▼
Wave 2 (sequential, the spine — 1 brief, drafted after Wave 1 returns)
  W2 backend + handlers (consumes A, B, C; writes the keychain coordinator)
        │
        ▼
Wave 3 (parallel — dispatch both at once)
  W3F client repository + popup ──┐
  W3G logger integration + smoke ─┘
```

---

## Wave 1 dispatch (current)

Four briefs, all leaf modules, no shared files, no merge conflicts. Dispatch all four to separate sessions same minute.

| Brief | File | Touches |
|-------|------|---------|
| W1A | `SESSION-W1A-secret-detector.md` | `lib/secrets/clipboard/secret-detector.js` + test |
| W1B | `SESSION-W1B-log-preview.md` | `lib/secrets/clipboard/log-preview.js` + test |
| W1C | `SESSION-W1C-migration.md` | `lib/db/migrations/016_clipboard_keychain.js` |
| W1D | `SESSION-W1D-redaction-map.md` | `lib/ws/redaction-map.js` + test |

**No file overlap between briefs.** Each session runs `git status` and reports — orchestrator merges by inspection, not by automated tooling.

---

## What the orchestrator does between waves

1. **Read each session's return block.** Confirm all acceptance criteria passed.
2. **Inspect the diff.** Verify no out-of-scope edits, file sizes within budget, layer-dependency rules respected (per code-standards PAGE.md).
3. **Run the test commands locally** for any session that didn't run them inline.
4. **Commit** with a message like `clipboard-keychain W1A: secret-pattern detector`.
5. **Dispatch next wave** when all current-wave commits are in.

---

## What the orchestrator does NOT do

- Does not let workers commit. Per global CLAUDE.md, only IDE Claude commits.
- Does not allow scope creep. If a worker reports out-of-scope changes, revert and re-dispatch with sharper instructions.
- Does not advance to Wave 2 if any Wave 1 acceptance criterion is in `fail` status.

---

## After Wave 1 returns

Draft `SESSION-W2-backend-handlers.md` with:
- Locked answers to §10 #4 (cap configurability), #5 (UEB payload shape), #7 (trash-can confirm UX), #8 (LRU mitigation).
- Imports from W1A, W1B, W1C-built artifacts.
- Deletes `lib/clipboard/queries.js` and `lib/clipboard/ws-handlers.js` as part of the same brief (the legacy module's fate per §10 #6).

After Wave 2 returns, draft Wave 3 briefs (W3F + W3G) and dispatch in parallel.
