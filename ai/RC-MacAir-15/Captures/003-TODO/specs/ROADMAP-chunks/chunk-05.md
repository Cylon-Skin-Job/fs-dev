# Chunk 5: Update Client Path References

**Goal:** Find all client-side hardcoded references to `ai/<machine>/System/styles/` and update them to `ai/<machine>/System/styles/`.

**Prerequisites:** Chunk 4 complete (theme service writes to new path).

**Files to change:**

## 5a. `open-robin-client/src/components/App.tsx`

Find the comment near line 162:

**Current:**
```tsx
// ai/<machine>/System/styles/themes.css (workspace) with optional overrides at
// ai/<machine>/Views/<view>/styles/themes.css.
```

**Change to:**
```tsx
// ai/<machine>/System/styles/themes.css (workspace) with optional overrides at
// ai/<machine>/Views/<view>/styles/themes.css.
```

## 5b. `open-robin-client/src/styles/variables.css`

Find the comment near line 90:

**Current:**
```css
/* Theme tokens live in ai/<machine>/System/styles/themes.css (loaded at runtime by
 * useSharedWorkspaceStyles). That file is the canonical home for every
 * theme-editable CSS custom property. Per-view overrides go in
 * ai/<machine>/Views/<view>/styles/themes.css and win via the cascade. */
```

**Change to:**
```css
/* Theme tokens live in ai/<machine>/System/styles/themes.css (loaded at runtime by
 * useSharedWorkspaceStyles). That file is the canonical home for every
 * theme-editable CSS custom property. Per-view overrides go in
 * ai/<machine>/Views/<view>/styles/themes.css and win via the cascade. */
```

## 5c. `open-robin-client/src/components/Robin/ThemeDetail.tsx`

Find the path references (around lines 167, 179):

**Current:**
```tsx
<code>ai/<machine>/System/styles/themes.css</code>
<code>ai/<machine>/Views/&#123;viewer-name&#125;/styles/themes.css</code>
```

**Change to:**
```tsx
<code>ai/<machine>/System/styles/themes.css</code>
<code>ai/<machine>/Views/&#123;viewer-name&#125;/styles/themes.css</code>
```

**Smoke test:**
1. Build the client: `cd open-robin-client && npm run build`
2. Verify TypeScript compiles with no errors
3. Open the Theme Detail panel and verify the displayed paths are correct

**Risk:** Low. Comments and UI text only.

**Next chunk:** Chunk 6 — Delete old global files from `ai/<machine>/System/styles/`.
