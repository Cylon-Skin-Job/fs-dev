# Config Schema

This article documents the `index.json` configuration fields for browser panels.

---

## Example Configs

### General Browser (Free Navigation)

```json
{
  "version": "1.0",
  "id": "amazon-shopper",
  "folderName": "amazon-shopper",
  "label": "Amazon Shopper",
  "type": "browser",
  "icon": "public",
  "rank": 10,
  "url": "https://amazon.com",
  "mode": "browser",
  "chrome": {
    "urlBar": true,
    "tabs": false,
    "navButtons": true
  }
}
```

### App Container (Origin-Locked)

```json
{
  "version": "1.0",
  "id": "custom-viewer",
  "folderName": "custom-viewer",
  "label": "Custom Viewer",
  "type": "browser",
  "icon": "app_registration",
  "rank": 99,
  "url": "http://localhost:4000",
  "mode": "app",
  "chrome": {
    "urlBar": true,
    "tabs": false,
    "navButtons": true
  }
}
```

---

## Field Reference

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `id` | yes | string | — | Unique identifier |
| `label` | yes | string | — | Display name in panel switcher |
| `type` | yes | string | browser | Must be browser for iframe, browser-viewer for webview |
| `icon` | no | string | public | Material icon name |
| `url` | yes | string | — | Initial URL to load |
| `homepage` | no | string | — | Default URL on fresh load |
| `mode` | no | string | browser | browser (free nav) or app (origin-locked) |
| `chrome.urlBar` | no | boolean | true | Show address bar |
| `chrome.tabs` | no | boolean | false | Show tab bar (v2) |
| `chrome.navButtons` | no | boolean | true | Show back/forward/reload |

---

## Mode Behavior

| Mode | Navigation | Back/Forward | Origin Lock | Chrome |
|------|-----------|--------------|-------------|--------|
| `browser` | Free | Enabled via manual stack | No | Visible (toggleable) |
| `app` | Enforced to initial URL origin | Disabled | Yes | Can be hidden |

---

## For AI Agents

When creating a new browser panel, always set `mode` explicitly. If the panel is an app container, use `mode: "app"`. If it is a general browser, use `mode: "browser"`.
