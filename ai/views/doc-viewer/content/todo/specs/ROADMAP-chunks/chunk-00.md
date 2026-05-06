# Chunk 0: Create `ai/settings/` and Seed It

**Goal:** Create the target folder and populate it with copies of existing global files.

**Prerequisites:** None. This is purely additive.

**Philosophy:** The user controls styling through a simple GUI (sliders + toggles). Global CSS lives in `ai/settings/`. Per-view CSS lives in `ai/views/{viewer}/settings/` and handles layout only. The server does not contain CSS — it reads files from disk and serves them as text.

**Files to create:**

```bash
mkdir -p ai/settings

# Copy (don't move yet) global files from their current location
cp ai/views/settings/themes.json ai/settings/themes.json
cp ai/views/settings/themes.css ai/settings/themes.css
cp ai/views/settings/views.css ai/settings/views.css
cp ai/views/settings/components.css ai/settings/components.css
cp ai/views/settings/state.json ai/settings/state.json

# Create new empty file (will be populated in Chunk 7)
touch ai/settings/tints.css

# Copy variables.css from client source
cp open-robin-client/src/styles/variables.css ai/settings/variables.css
```

**What these files are:**
- `themes.json` — All theme definitions (sliders, colors, active theme ID)
- `themes.css` — Generated CSS from the active theme (regenerated on boot and on slider changes)
- `views.css` — Global view chrome styles (chat chrome, panels, sidebar chrome)
- `components.css` — Global component styles (buttons, inputs, cards, etc.)
- `state.json` — Workspace state default (NOT per-view; per-view state lives in `ai/views/{viewer}/settings/state.json`)
- `tints.css` — Global tint selector catalog (body[data-tint-*] rules). Empty for now.
- `variables.css` — CSS custom property defaults (fallbacks when themes.css is missing)

**Smoke test:**
```bash
ls -la ai/settings/
```

Expected output:
```
drwxr-xr-x  9 user  staff   288 Apr 26 16:36 .
drwxr-xr-x  5 user  staff   160 Apr 26 16:36 ..
-rw-r--r--  1 user  staff  1254 Apr 26 16:36 components.css
-rw-r--r--  1 user  staff   600 Apr 26 16:36 state.json
-rw-r--r--  1 user  staff  2548 Apr 26 16:36 themes.css
-rw-r--r--  1 user  staff 36077 Apr 26 16:36 themes.json
-rw-r--r--  1 user  staff     0 Apr 26 16:36 tints.css
-rw-r--r--  1 user  staff  2974 Apr 26 16:36 variables.css
-rw-r--r--  1 user  staff 34065 Apr 26 16:36 views.css
```

**Risk:** None. This is purely additive. The old files in `ai/views/settings/` remain untouched.

**Next chunk:** Chunk 1 — Add `__settings__` pseudo-panel to server.
