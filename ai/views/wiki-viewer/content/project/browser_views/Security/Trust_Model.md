# Trust Model

This article defines the security assumptions and boundaries of the browser view system.

---

## Threat Model

Fusion Studio is a **developer tool**, not a consumer browser. The user intentionally loads their own applications and websites. The browser panels are designed for productivity, not untrusted content.

### Trusted Actors

- The user who configures the browser panel URL
- The user's own Node server running on localhost
- Known internal tools and dashboards

### Untrusted Actors

- Arbitrary websites the user may visit in browser mode
- Third-party embeds within user apps
- Malicious redirects

---

## Same-Origin vs Cross-Origin

### Same-Origin Apps (e.g., `http://localhost:4000`)

When the parent (Fusion Studio) and the iframe (user app) share the same origin:

**What the app can do:**
- Access the parent's `localStorage` and `sessionStorage`
- Read the parent's cookies
- Manipulate the parent's DOM (if same-origin)
- Make authenticated requests using the parent's credentials

**Why this is acceptable:**
- The user intentionally loaded their own app
- `allow-same-origin` + `allow-scripts` is a deliberate choice for developer convenience
- The app is not jailed — it is trusted

### Cross-Origin Apps (e.g., `https://example.com`)

When the parent and iframe are different origins:

**What the app can do:**
- Run JavaScript within its own origin
- Access its own cookies and storage
- Open popups (if `allow-popups`)

**What the app cannot do:**
- Read the parent's DOM
- Access the parent's storage
- Make authenticated requests to the parent's origin

---

## What Is Blocked Globally

Regardless of origin, the iframe sandbox blocks:

- **Node.js APIs** (`require`, `fs`, `process`) — blocked by `nodeIntegration: false`
- **Electron APIs** — blocked by `contextIsolation: true`
- **Top navigation** — `allow-top-navigation` is omitted, so the iframe cannot redirect the parent window
- **Dangerous schemes** — `javascript:`, `data:`, `file:`, `vbscript:` are blocked by URL validation

---

## App Mode Origin Lock

In `mode: "app"`, the parent enforces an origin lock:

```typescript
if (mode === 'app') {
  const allowedOrigin = getUrlOrigin(initialUrl);
  const loadedOrigin = getUrlOrigin(loadedUrl);
  if (allowedOrigin && loadedOrigin && allowedOrigin !== loadedOrigin) {
    // Redirect back to allowed URL
    setCurrentUrl(initialUrl);
  }
}
```

This prevents a user app from accidentally navigating to a different origin (e.g., via a malicious link).

---

## For AI Agents

**Do not weaken security without documenting it here.**

If you are asked to:
- Add `allow-top-navigation` → **Reject.** This lets the iframe redirect Fusion Studio.
- Remove URL validation → **Reject.** Dangerous schemes must stay blocked.
- Enable `nodeIntegration` in the iframe → **Reject.** This is a massive security risk.

**If you need a new capability, add the minimum sandbox token and document it here.**
