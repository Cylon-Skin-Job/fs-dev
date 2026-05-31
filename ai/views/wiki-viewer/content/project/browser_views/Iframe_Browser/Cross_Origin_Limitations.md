# Cross-Origin Limitations

This article documents what the parent iframe can and cannot observe when the embedded content is cross-origin.

---

## The Core Problem

When an iframe loads content from a **different origin** than its parent, the browser enforces the **Same-Origin Policy (SOP)**. This means the parent cannot:

- Read `iframe.contentWindow.location.href`
- Access `iframe.contentWindow.document`
- Listen to most navigation events
- Read form inputs or DOM state

These restrictions exist to protect user privacy and security. They are not bugs and cannot be bypassed.

---

## What Breaks Cross-Origin

### URL Bar Sync

The parent tries to read the iframe's URL on load:

```typescript
try {
  loadedUrl = iframe.contentWindow?.location.href || null;
} catch {
  // Cross-origin: throws SecurityError
  loadedUrl = null;
}
```

**Result:** The URL bar does not update when the user navigates inside a cross-origin iframe.

### History Stack

The manual history stack (`historyRef`) only works for same-origin navigations. Cross-origin navigations are invisible, so:

- Back/forward buttons may go to wrong URLs
- The history stack gets out of sync with reality

**Fix:** For cross-origin content, we do not push to the history stack. The URL bar remains on the initially loaded URL.

### Reload Fallback

For same-origin, `iframe.contentWindow.location.reload()` works. For cross-origin:

```typescript
try {
  iframe.contentWindow?.location.reload();
} catch {
  // Cross-origin: falls back to re-assigning src
  iframe.src = iframe.src;
}
```

**Caveat:** Re-assigning `src` loses POST data, form state, and scroll position.

---

## What Works Cross-Origin

| Feature | Works? | Notes |
|---------|--------|-------|
| `onLoad` event | ✅ Yes | Fires when the iframe finishes loading |
| `postMessage` | ✅ Yes | Bidirectional, but both sides must cooperate |
| `sandbox` attributes | ✅ Yes | Still enforced |
| Cookie sharing | ❌ No | Isolated by origin |
| `localStorage` access | ❌ No | Isolated by origin |

---

## For AI Agents

**If a user asks why the URL bar doesn't update or back/forward is broken:**

- This is expected behavior for cross-origin content.
- The iframe browser is designed for same-origin apps (localhost) or simple browsing where navigation state is not critical.
- For full navigation observability, use `WebContentsView` (custom-viewer), which has native `did-navigate` events.

**Do not suggest workarounds that violate SOP** (e.g., CORS proxies, `document.domain` hacks). These are security risks.
