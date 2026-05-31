# URL Validation

This article documents the URL validation rules enforced by the iframe browser.

---

## Allowed Schemes

| Scheme | Example | Notes |
|--------|---------|-------|
| `http://` | `http://localhost:3000` | Standard HTTP |
| `https://` | `https://example.com` | Standard HTTPS |
| Bare `localhost` | `localhost:3000` | Normalized to `http://localhost:3000` |

## Blocked Schemes

| Scheme | Reason Blocked |
|--------|---------------|
| `javascript:` | XSS vector |
| `data:` | Can embed executable content |
| `file:` | Local file access |
| `vbscript:` | Legacy script injection |
| `about:` | Can be used for UI spoofing |
| `fusion-studio:` | Internal protocol, not for external content |

## IP Address Rules

| Input | Result |
|-------|--------|
| `localhost` | ✅ Allowed, normalized to `http://localhost` |
| `127.0.0.1` | ✅ Allowed |
| Bare IPv4 (`192.168.1.1`) | ❌ Blocked |
| IPv6 | ❌ Blocked (not explicitly handled) |

**Why block bare IPs?** They are often used in phishing and C2 infrastructure. `localhost` and `127.0.0.1` are explicitly allowed for local development.

---

## Validation Flow

```
User input
  → Trim whitespace
  → Normalize bare localhost
  → Parse with new URL()
  → Check scheme against allowlist
  → Check scheme against blocklist
  → Check hostname against IP rules
  → Return { valid, normalizedUrl, reason }
```

---

## For AI Agents

If you need to allow a new scheme or relax a rule:

1. Update `src/components/browser/urlValidator.ts`
2. Add a test case
3. Document the change here
4. Explain the security implications

Do not bypass validation for convenience.
