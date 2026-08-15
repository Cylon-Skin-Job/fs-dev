#!/usr/bin/env python3
"""Extract a Claude Code JSONL conversation into clean, citable markdown.

Produces:
  - conversation-extract.md  : full cleaned conversation with chat-pair IDs + line numbers
  - conversation-index.md    : compact index of chat pairs (CP#) with one-line summaries

Citation scheme:
  [CP<id> @L<line>]   e.g. [CP5 @L332]
"""
import json
import sys

SRC = "/Users/rccurtrightjr./.claude/projects/-Users-rccurtrightjr-/82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl"
OUT_FULL = "/Users/rccurtrightjr./projects/fs-dev/claude-convo-artifacts/conversation-extract.md"
OUT_INDEX = "/Users/rccurtrightjr./projects/fs-dev/claude-convo-artifacts/conversation-index.md"

def text_of(content):
    """Return (text, parts) where parts is a list describing block types."""
    parts = []
    text = []
    if isinstance(content, str):
        return content, [("text", content)]
    if isinstance(content, list):
        for c in content:
            if not isinstance(c, dict):
                continue
            t = c.get("type")
            if t == "text":
                text.append(c.get("text", ""))
                parts.append(("text", c.get("text", "")))
            elif t == "thinking":
                th = c.get("thinking", "")
                parts.append(("thinking", th))
            elif t == "tool_use":
                name = c.get("name", "?")
                inp = c.get("input", {})
                fp = inp.get("file_path") or inp.get("filePath") or ""
                def _short(s, n=160):
                    s = str(s)
                    return s if len(s) <= n else s[:n] + "…"
                if name == "Bash":
                    parts.append(("tool_use", f"Bash: {_short(inp.get('command',''))}"))
                elif name == "Read":
                    extra = f" +{inp.get('offset','')}-{inp.get('limit','')}" if inp.get('offset') else ""
                    parts.append(("tool_use", f"Read: {fp}{extra}"))
                elif name == "Edit":
                    parts.append(("tool_use", f"Edit: {fp}  old=\"{_short(inp.get('oldString',''),80)}\""))
                elif name == "Write":
                    parts.append(("tool_use", f"Write: {fp}"))
                elif name == "Glob":
                    parts.append(("tool_use", f"Glob: {inp.get('pattern','?')}"))
                elif name == "Grep":
                    parts.append(("tool_use", f"Grep: {inp.get('pattern','?')} in {inp.get('include','')} {inp.get('path','')}"))
                elif name == "Task":
                    parts.append(("tool_use", f"Task({inp.get('subagent_type','?')}): {_short(inp.get('description',''))}"))
                elif name == "TodoWrite":
                    todos = inp.get("todos", [])
                    parts.append(("tool_use", f"TodoWrite: {len(todos)} items"))
                elif name == "Question":
                    parts.append(("tool_use", f"Question: {inp.get('questions',[{}])}"))
                elif name == "WebFetch":
                    parts.append(("tool_use", f"WebFetch: {inp.get('url','?')}"))
                elif name == "WebSearch":
                    parts.append(("tool_use", f"WebSearch: {inp.get('query','?')}"))
                else:
                    parts.append(("tool_use", f"{name}: {str(inp)[:150]}"))
            elif t == "tool_result":
                rcontent = c.get("content", "")
                if isinstance(rcontent, list):
                    rcontent = " ".join(
                        x.get("text", "") for x in rcontent if isinstance(x, dict)
                    )
                rcontent = str(rcontent)
                # mark errors
                is_err = c.get("is_error", False)
                parts.append(("tool_result", ("ERR: " if is_err else "") + rcontent))
            else:
                parts.append((t or "?", str(c)[:150]))
    return "\n".join(text), parts


def main():
    rows = []
    with open(SRC) as f:
        for line_no, line in enumerate(f):
            try:
                obj = json.loads(line)
            except Exception:
                continue
            rows.append((line_no, obj))

    # Build chat pairs: a chat pair = one user turn (real text) + the assistant block(s) until next user turn.
    # We treat command/system noise as skipped. A "user turn" = a user message with real text
    # (not a local-command caveat/command, not a pure tool_result echo).
    # Assistant blocks between user turns are grouped to the preceding user turn.

    def is_real_user_text(obj):
        if obj.get("type") != "user":
            return False
        txt, parts = text_of(obj.get("message", {}).get("content", ""))
        # exclude pure tool_result user messages
        if not txt.strip():
            return False
        if txt.startswith("<local-command"):
            return False
        if txt.startswith("<command-name>"):
            return False
        if txt.startswith("<command-args>"):
            return False
        if txt.startswith("<command-message>"):
            return False
        # exclude messages that are ONLY a tool_result (no text block)
        types = {p[0] for p in parts}
        if types == {"tool_result"} or (types <= {"tool_result"} and "text" not in types):
            return False
        return True

    def is_assistant(obj):
        return obj.get("type") == "assistant"

    # Walk and assemble pairs
    pairs = []  # list of dict {cp, user_line, user_text, assistant: [(line, parts)]}
    i = 0
    n = len(rows)
    cp = 0
    while i < n:
        line_no, obj = rows[i]
        if is_real_user_text(obj):
            user_text, user_parts = text_of(obj.get("message", {}).get("content", ""))
            user_text_only = "\n".join(p[1] for p in user_parts if p[0] == "text")
            assistant_blocks = []
            j = i + 1
            # gather assistant blocks and intervening tool_result user messages (which belong to this pair)
            while j < n:
                ln2, o2 = rows[j]
                if is_real_user_text(o2):
                    break
                if o2.get("type") == "assistant":
                    _, aparts = text_of(o2.get("message", {}).get("content", ""))
                    assistant_blocks.append((ln2, aparts))
                j += 1
            pairs.append({
                "cp": cp,
                "user_line": line_no,
                "user_text": user_text_only,
                "assistant": assistant_blocks,
            })
            cp += 1
            i = j
        else:
            i += 1

    # Write full extract
    with open(OUT_FULL, "w") as out:
        out.write("# Conversation Extract (cleaned)\n\n")
        out.write(f"Source: `82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl`\n")
        out.write(f"Total chat pairs: {len(pairs)}\n\n")
        out.write("Citation scheme: `[CP<id> @L<jsonl-line>]`\n\n")
        out.write("---\n\n")

        for p in pairs:
            out.write(f"## CP{p['cp']}  @L{p['user_line']}\n\n")
            out.write(f"**USER:**\n\n")
            out.write(f"{p['user_text']}\n\n")
            for ln, aparts in p['assistant']:
                out.write(f"**ASSISTANT @L{ln}:**\n\n")
                for kind, val in aparts:
                    if kind == "text":
                        out.write(f"{val}\n\n")
                    elif kind == "thinking":
                        # include thinking but compact (collapse to ~600 chars)
                        t = val
                        if len(t) > 800:
                            t = t[:800] + " …[truncated]"
                        out.write(f"<details><summary>thinking</summary>\n\n{t}\n\n</details>\n\n")
                    elif kind == "tool_use":
                        out.write(f"- 🔧 TOOL: `{val}`\n")
                    elif kind == "tool_result":
                        r = val
                        if len(r) > 500:
                            r = r[:500] + " …[truncated]"
                        out.append = None
                        # put result compactly
                        first_line = r.splitlines()[0] if r else ""
                        out.write(f"    ↳ result: `{first_line[:200]}`\n" if first_line else f"    ↳ (empty result)\n")
                out.write("\n")
            out.write("---\n\n")

    # Write index
    with open(OUT_INDEX, "w") as out:
        out.write("# Conversation Index (chat pairs)\n\n")
        out.write(f"Source: `82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl`\n")
        out.write(f"Total chat pairs: {len(pairs)}\n\n")
        for p in pairs:
            ut = p["user_text"].strip().replace("\n", " ")
            if len(ut) > 140:
                ut = ut[:140] + "…"
            out.write(f"- **CP{p['cp']}** @L{p['user_line']}: {ut}\n")

    print(f"Wrote {len(pairs)} chat pairs")
    print(f"  -> {OUT_FULL}")
    print(f"  -> {OUT_INDEX}")
    import os
    print(f"Full size: {os.path.getsize(OUT_FULL)} bytes")

if __name__ == "__main__":
    main()
