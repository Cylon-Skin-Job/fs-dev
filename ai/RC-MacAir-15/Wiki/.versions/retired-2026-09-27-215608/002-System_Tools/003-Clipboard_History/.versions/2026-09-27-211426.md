---
name: Clipboard History
description: Managed clipboard history policy for Fusion Studio copy actions.
metadata:
  incoming-edges:
    - System Tools
    - Chat Reply Payloads
  outgoing-edges:
    - Secrets Manager
  source-files:
    - fusion-studio-client/src/clipboard/clipboard-api.ts
    - fusion-studio-server/lib/secrets/clipboard/handlers.js
  connected-skills: []
  related-trigger-files: []
---

Any app action that writes to the system clipboard should also write to Fusion
Studio clipboard history.

Frontend code should use:

```ts
writeAndRecord(text, source)
```

Do not use direct `navigator.clipboard.writeText()` for app-owned copy actions.

## Privacy

Clipboard storage must keep using existing secret redaction safeguards. The
Secrets Manager is the storage path for API keys and similar credentials;
clipboard history is not credential storage.
