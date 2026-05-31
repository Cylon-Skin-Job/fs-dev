# History and Navigation

This article documents how navigation and history work in the iframe-based browser.

---

## Manual History Stack

The iframe browser does not use the browser's native history API. Instead, it maintains a **manual history stack** in React refs:

```typescript
const historyRef = useRef<string[]>([initialUrl]);
const historyIndexRef = useRef(0);
```

**Why manual?** The iframe's internal history is opaque to the parent, especially for cross-origin content. We cannot call `iframe.contentWindow.history.back()` reliably.

---

## Navigation Flow

### User Types a URL

1. User types in the chrome bar and submits
2. `navigateTo(url)` validates the URL
3. URL is pushed to history stack (truncating forward entries)
4. `currentUrl` state updates
5. `useEffect` syncs `iframe.src = currentUrl`

### User Clicks a Link Inside the Iframe (Same-Origin)

1. iframe loads the new page
2. `onLoad` fires
3. `handleLoad` reads `contentWindow.location.href`
4. URL is pushed to history stack
5. URL bar updates

### User Clicks a Link Inside the Iframe (Cross-Origin)

1. iframe loads the new page
2. `onLoad` fires
3. `handleLoad` tries to read `location.href` → throws
4. Navigation is silently ignored
5. URL bar does not update

---

## App Mode Behavior

In `mode: "app"` (origin-locked):

- Back/forward buttons are **disabled**
- The app handles its own routing via JavaScript
- The parent enforces origin lock: if `location.href` changes to a different origin, it redirects back to `initialUrl`

This is the correct behavior for an app container: the app is a single-page application that manages its own state.

---

## Known Limitations

1. **Cross-origin navigation is invisible.** The URL bar and history stack do not update.
2. **No forward history after new navigation.** Typing a new URL truncates the forward stack.
3. **History is lost on panel switch.** React unmount destroys the refs. No persistence.
4. **POST data is lost on reload.** The reload fallback re-assigns `src`.

---

## Future Improvements

- Persist history to `localStorage` per panel
- Use `postMessage` to receive navigation events from cooperative same-origin apps
- Migrate app-container use cases to `WebContentsView`, which has native history APIs
