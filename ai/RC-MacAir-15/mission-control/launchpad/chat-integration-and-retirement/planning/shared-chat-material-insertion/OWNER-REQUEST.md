# Shared chat material insertion — original owner request

> Direct owner instructions in the current conversation, October 7, 2026. Planning authority only. Preserved by Codex side chat (ephemeral), /root, 2026-10-07T09:28:43Z. This packet does not transfer the registered Launchpad main identity or checkpoint boundary.

## Product instruction

I want one shared controller for adding material to chat. Reuse the existing chat action and store owners, and route screenshots, Send to Chat, and composer plus-menu actions through the same destination validation and insertion logic.

Destination rules:
- A global Send to Chat action targets the active open chat when clicked.
- Every action inside a composer’s plus menu targets THAT composer’s chat, regardless of which other chat or view has focus.
- Screenshot actions follow the same rule: a global control targets the active open chat; a composer control targets its own chat.
- These rules apply to Main Chat and Side Chat. Do not infer a Main-only restriction from an old helper, comment, or global currentThreadId.

Resolve and snapshot the exact destination when the action begins. Delayed capture or preparation must never redirect material into another chat because focus changed. Revalidate the destination before insertion; cancel if the originating composer changes or closes, or its destination becomes invalid. Preserve independent view and chat ownership.

Each source remains responsible for preparing its material—for example, capturing and saving a screenshot. The shared controller owns destination validation and adding the prepared text or attachment through the existing stores. Preserve screenshot request-ID/saved-path correlation and existing server-owned prompt acceptance, persistence, and provenance.

The default operation adds material to the composer. It does not automatically send or create a chat. Later, we can add explicit options such as “start a new chat” and “paste and send” through this controller. Do not implement those future modes now.

Inspect all existing entry points so the repair closes the shared ownership problem instead of adding another screenshot-specific exception. Verify global targeting, composer targeting, Main/Side behavior, delayed completion, owner-change cancellation, and isolation between views. Account for the necessary scope changes and renew affected checks and independent review.

## Planning-only instruction

This will be our next ticket and SPEC. Don't build.

## Authority and evidence limits

The second instruction constrains the first to ticket/SPEC preparation. No product implementation, tests that alter product code, app restart, commit, publication, Alpha operation or implementation dispatch is authorized. Source inspection and independent planning review are authorized. No current build acceptance is reopened.

The original instructions are available directly in this live conversation. No missing turn UUID is invented; no historical transcript coverage or saved checkpoint is claimed.
