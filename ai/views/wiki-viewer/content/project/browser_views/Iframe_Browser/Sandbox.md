# Sandbox

This article documents the iframe sandbox tokens used by the iframe-based browser, what each enables, and why the configuration was chosen.

---

## Current Sandbox Configuration

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
  allowfullscreen
/>
```

---

## Token Reference

| Token | What It Enables | Why We Include It |
|-------|----------------|-------------------|
| `allow-scripts` | JavaScript execution | User apps are built with JavaScript |
| `allow-same-origin` | Same-origin access (cookies, localStorage, DOM) | Required for apps to persist state and communicate with parent if same-origin |
| `allow-popups` | `window.open()`, `<a target="_blank">` | OAuth flows, external links |
| `allow-forms` | `<form>` submission | **Critical.** Without this, login pages, search boxes, and settings forms are broken |
| `allow-modals` | `alert()`, `confirm()`, `prompt()` | Many web apps use these for user confirmation |
| `allow-downloads` | File downloads via `<a download>` | User apps may generate CSVs, images, exports |

## Attribute Reference

| Attribute | What It Enables | Why We Include It |
|-----------|----------------|-------------------|
| `allowfullscreen` | `element.requestFullscreen()` | User apps may want fullscreen video, canvas, or presentation mode |

---

## Intentionally Omitted

| Token | Why Omitted |
|-------|-------------|
| `allow-top-navigation` | Prevents the iframe from redirecting the parent Fusion Studio window |
| `allow-pointer-lock` | Not needed for typical user apps |
| `allow-orientation-lock` | Not needed for desktop apps |

---

## Security Implications

### Same-Origin Trust Model

`allow-scripts` + `allow-same-origin` together mean that **same-origin apps have full access to their origin's resources:**

- Cookies
- `localStorage` / `sessionStorage`
- `IndexedDB`
- DOM manipulation (if same-origin)
- `XMLHttpRequest` / `fetch` with origin credentials

This is **intentional** for a developer tool where the user loads their own server. It is not a security jail — it is a convenience boundary.

**Cross-origin apps** are naturally restricted by the browser's Same-Origin Policy, regardless of sandbox tokens.

### What the Sandbox Still Blocks

Even with all these tokens:
- The iframe **cannot** access Node.js APIs (`require`, `fs`, `process`)
- The iframe **cannot** access Electron APIs
- The iframe **cannot** navigate the parent window (`allow-top-navigation` is omitted)
- The iframe **cannot** access the parent's DOM (if cross-origin)

---

## For AI Agents

**If a user reports that forms, downloads, or modals are broken in the iframe browser:**

1. Check the `sandbox` attribute. `allow-forms` was previously missing — this is a known bug that has been fixed.
2. Check `allowfullscreen` if fullscreen APIs fail.
3. Do not add `allow-top-navigation`. It weakens security by letting the iframe redirect the parent.
