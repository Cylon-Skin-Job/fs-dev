# Chunk 6: Delete Old Global Files from `ai/<machine>/System/styles/`

**Goal:** Remove the now-duplicate global files from `ai/<machine>/System/styles/`.

**Prerequisites:** Chunks 0-5 complete (server and client both use `ai/<machine>/System/styles/`).

**Files to delete:**
```bash
rm ai/<machine>/System/styles/themes.json
rm ai/<machine>/System/styles/themes.css
rm ai/<machine>/System/styles/views.css
rm ai/<machine>/System/styles/components.css
rm ai/<machine>/System/styles/state.json
```

**Files to KEEP in `ai/<machine>/System/styles/`:**
- `cli.json` — CLI config (not theme-related, keep here)
- `THEME_SYSTEM_AUDIT.md` — documentation (either keep here or move to `ai/<machine>/System/styles/`)

**Do NOT delete:**
- `ai/<machine>/System/styles/cli.json`

**Smoke test:**
1. Refresh the page in the browser
2. Verify everything still renders correctly (colors, layout, components)
3. Change a slider in ThemePicker — verify theme updates and renders
4. Check the browser console — verify no "file not found" or 404 errors
5. Check the server logs — verify no read errors

**Risk:** Medium. If any code path still references the old location, it breaks. The old files were kept until now as a safety net.

**Rollback:** If something breaks, restore from the copies in `ai/<machine>/System/styles/`:
```bash
cp ai/<machine>/System/styles/themes.json ai/<machine>/System/styles/themes.json
cp ai/<machine>/System/styles/themes.css ai/<machine>/System/styles/themes.css
cp ai/<machine>/System/styles/views.css ai/<machine>/System/styles/views.css
cp ai/<machine>/System/styles/components.css ai/<machine>/System/styles/components.css
cp ai/<machine>/System/state/state.json ai/<machine>/System/styles/state.json
```

**Next chunk:** Chunk 7 — Create `ai/<machine>/System/styles/tints.css`.
