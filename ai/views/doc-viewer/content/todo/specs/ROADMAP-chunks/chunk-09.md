# Chunk 9: Final Cleanup

**Goal:** Delete old client CSS files, verify no orphaned imports, and do a full app walkthrough.

**Prerequisites:** Chunks 0-8 complete.

**Files to delete (after confirming all rules were moved):**
```bash
rm open-robin-client/src/components/wiki/wiki.css
rm open-robin-client/src/components/tickets/tickets.css
rm open-robin-client/src/components/agents/agents.css
rm open-robin-client/src/components/tile-row/tile-row.css
rm open-robin-client/src/components/capture/capture.css
```

**Verify no orphaned imports:**
```bash
grep -r "wiki.css\|tickets.css\|agents.css\|tile-row.css\|capture.css" open-robin-client/src/components/
```

Expected: No matches (or only matches in comments/docs).

**If orphaned imports are found, remove them.** Look in:
- `open-robin-client/src/components/wiki/WikiExplorer.tsx`
- `open-robin-client/src/components/tickets/*.tsx`
- `open-robin-client/src/components/agents/*.tsx`
- `open-robin-client/src/components/tile-row/*.tsx`
- `open-robin-client/src/components/capture/*.tsx`

**Full app walkthrough:**
1. Build the client: `cd open-robin-client && npm run build`
2. Restart the server
3. Open every view:
   - Chat
   - Wiki
   - Tickets
   - Agents
   - Files
   - Doc/Capture
4. In each view, test:
   - Layout is correct (no broken grids, no missing padding)
   - Colors render (sidebar bg, panel borders, text colors)
   - All toggles in ThemePicker work
   - All sliders in ThemePicker work
5. Check browser console — verify no errors
6. Check Network tab — verify no 404s

**Risk:** Medium. Orphaned imports cause build failures.

**Congratulations — refactor complete!**
