# Chunk 6: Delete Old Global Files from `ai/views/settings/`

**Goal:** Remove the now-duplicate global files from `ai/views/settings/`.

**Prerequisites:** Chunks 0-5 complete (server and client both use `ai/settings/`).

**Files to delete:**
```bash
rm ai/views/settings/themes.json
rm ai/views/settings/themes.css
rm ai/views/settings/views.css
rm ai/views/settings/components.css
rm ai/views/settings/state.json
```

**Files to KEEP in `ai/views/settings/`:**
- `cli.json` — CLI config (not theme-related, keep here)
- `THEME_SYSTEM_AUDIT.md` — documentation (either keep here or move to `ai/settings/`)

**Do NOT delete:**
- `ai/views/settings/cli.json`

**Smoke test:**
1. Refresh the page in the browser
2. Verify everything still renders correctly (colors, layout, components)
3. Change a slider in ThemePicker — verify theme updates and renders
4. Check the browser console — verify no "file not found" or 404 errors
5. Check the server logs — verify no read errors

**Risk:** Medium. If any code path still references the old location, it breaks. The old files were kept until now as a safety net.

**Rollback:** If something breaks, restore from the copies in `ai/settings/`:
```bash
cp ai/settings/themes.json ai/views/settings/themes.json
cp ai/settings/themes.css ai/views/settings/themes.css
cp ai/settings/views.css ai/views/settings/views.css
cp ai/settings/components.css ai/views/settings/components.css
cp ai/settings/state.json ai/views/settings/state.json
```

**Next chunk:** Chunk 7 — Create `ai/settings/tints.css`.
