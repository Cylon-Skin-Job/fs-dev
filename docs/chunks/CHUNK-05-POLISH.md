# Chunk 5: Polish

**Project:** fs-dev (Fusion Studio)  
**Scope:** Office Document Editor — Phase 5  
**Depends on:** Chunk 1–4 (all prior chunks)  
**Blocks:** Nothing (final chunk)  

---

## Context

By this point, the office-viewer has:
- Document tiles (`OfficeDocumentTile`)
- A Crepe editor surface (`OfficeDocumentPage`)
- Auto-save and manual save
- Export to DOCX/PDF via bundled Pandoc

This chunk adds UX polish, keyboard shortcuts, dirty-state warnings, loading states, and error handling.

---

## What This Chunk Builds

1. Keyboard shortcuts (Ctrl+S save, Esc back to folder)
2. Dirty-state warning when navigating away with unsaved changes
3. Loading states for save and export
4. Error toasts for failed operations
5. Empty state when a folder has no documents
6. Smooth transitions between folder view and document view

---

## Files to Modify

### `fusion-studio-client/src/components/office/OfficeDocumentPage.tsx`

**Keyboard shortcuts:**
- `Ctrl+S` / `Cmd+S` — Force immediate save (already in Chunk 3, verify it works)
- `Esc` — Navigate back to folder view (`onBack()`)

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onBack();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [onBack]);
```

**Dirty-state warning on navigation:**
- Intercept `onBack` and sibling clicks when `isDirty`.
- Show a confirmation dialog: "You have unsaved changes. Save before leaving?"
- Options: "Save & Leave", "Leave Without Saving", "Cancel"

```tsx
const handleBackWithGuard = useCallback(() => {
  if (isDirty) {
    const choice = confirm('You have unsaved changes. Save before leaving?');
    if (choice) {
      handleSave().then(() => onBack());
      return;
    }
  }
  onBack();
}, [isDirty, handleSave, onBack]);
```

*(Note: Replace `confirm()` with a proper modal if the app has a modal system.)*

**Loading indicators:**
- Save button shows a spinner during `isSaving`.
- Export button shows a spinner during export.
- Disable buttons while operations are in-flight.

**Error toasts:**
- If `saveFile` throws or returns error, show toast: "Save failed: {error}"
- If export fails, show toast: "Export failed: {error}"
- Use the app's existing toast system (`lib/toast.ts`) if available.

### `fusion-studio-client/src/components/office/OfficeGrid.tsx`

**Empty state for folders:**
- If a folder contains no `.md` files, show: "No documents in this folder."
- If a folder is completely empty, keep the existing empty state.

**Transition animation:**
- Add a subtle fade/slide when switching between folder view and `OfficeDocumentPage`.
- Use CSS transitions or Framer Motion if the app already uses it.

### `fusion-studio-client/src/components/office/OfficeDocumentTile.tsx`

**Hover state:**
- Scale up slightly on hover (`transform: scale(1.02)`).
- Show a "Open" indicator on hover.

**Active state:**
- Highlight the tile that corresponds to the currently open document.

---

## Acceptance Criteria

- [ ] `Esc` key returns from document view to folder view.
- [ ] `Ctrl+S` forces save and shows feedback.
- [ ] Navigating away with dirty changes shows a confirmation prompt.
- [ ] Save/export buttons show loading spinners during operations.
- [ ] Save/export errors display as toasts or alerts.
- [ ] Empty folders have a friendly empty state.
- [ ] Smooth transitions between views.

---

## Notes

- Do **not** add new dependencies for animations unless the app already uses them.
- Check if `lib/toast.ts` exists and use it for error messages. If not, `alert()` is acceptable for a polish pass.
- The dirty-state guard should also apply to:
  - Clicking a sibling in the ribbon
  - Clicking a different folder
  - Closing the panel
