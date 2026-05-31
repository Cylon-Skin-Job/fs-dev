# CSP Requirements

This article documents the Content-Security-Policy and X-Frame-Options requirements for user apps that load inside the iframe browser.

---

## The Problem

Modern web frameworks and security middleware (Express Helmet, Rails, Django) often set headers that prevent a page from being embedded in an iframe:

```http
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'
```

If these headers are present, the iframe will refuse to load the page. The user sees a blank panel.

---

## Required Headers

User apps must send **one** of the following:

### Option 1: X-Frame-Options

```http
X-Frame-Options: ALLOWALL
```

**Note:** `ALLOWALL` is non-standard but widely supported. It allows framing by any origin.

### Option 2: Content-Security-Policy (Recommended)

```http
Content-Security-Policy: frame-ancestors 'self' http://localhost:*;
```

This is more precise. It allows framing only by:
- The same origin (`'self'`)
- Any localhost port (`http://localhost:*`)

If Fusion Studio is served from a non-localhost origin, adjust accordingly:

```http
Content-Security-Policy: frame-ancestors 'self' http://app.example.com;
```

---

## Common Framework Fixes

### Express + Helmet

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      frameAncestors: ["'self'", "http://localhost:*"],
    },
  },
}));
```

Or disable `X-Frame-Options` entirely:

```javascript
app.use(helmet.frameguard({ action: 'allow-from', domain: '*' }));
```

### Next.js

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' http://localhost:*;" },
        ],
      },
    ];
  },
};
```

### Vite Dev Server

```javascript
// vite.config.js
export default {
  server: {
    headers: {
      'X-Frame-Options': 'ALLOWALL',
    },
  },
};
```

---

## For AI Agents

If a user reports a blank browser panel:

1. Ask them to check the browser's DevTools console for framing errors.
2. Look for `X-Frame-Options: DENY` or `frame-ancestors 'none'` in the response headers.
3. Guide them to relax the policy using the examples above.
4. Do not suggest disabling CSP entirely — only relax `frame-ancestors`.
