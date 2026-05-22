# Cloud Backup

> **Related ticket:** RCC-0072 — Create onboarding tickets to download with app

This folder holds the symlink to your cloud-backed Fusion Studio storage.

## How It Works

On first run (or when you enable backup in Settings), Fusion Studio:

1. **Detects your cloud provider** — iCloud Drive, Google Drive, Microsoft OneDrive, Dropbox, or a custom folder you choose.
2. **Creates `Fusion Studio/`** in the root of that cloud drive.
3. **Creates a symlink here** named `fusion-studio-cloud-sync` that points to the cloud folder.

```
~/Library/Mobile Documents/com~apple~CloudDocs/Fusion Studio/  ← real folder (in iCloud)
        ↑
        └─ symlink ──>  System Files/cloud-backup/fusion-studio-cloud-sync
```

## What Gets Synced

Only **workspace databases** and **System Files state** live in the cloud folder:

- `workspace.db` — file versioning, checkpoints, undo/redo
- `solobooks.db` — bookkeeping data (if using Spending view)
- `state.json` — layout, panel widths, view config
- `theme.json` — design tokens and slider values

Source files, documents, and media stay in your local workspace. The cloud folder is a **lightweight mirror** of system state — not your whole project.

## Supported Providers

| Provider | Typical Path | Notes |
|----------|-------------|-------|
| iCloud Drive | `~/Library/Mobile Documents/com~apple~CloudDocs/` | macOS native; preferred |
| Google Drive | `~/Google Drive/` or `~/My Drive/` | user-selectable |
| OneDrive | `~/OneDrive/` | user-selectable |
| Dropbox | `~/Dropbox/` | user-selectable |
| Custom | any folder you pick | folder picker fallback |

## Manual Setup

If you skipped onboarding, enable backup anytime:

1. Open **Settings > Backup**
2. Choose your provider (or pick a custom folder)
3. Fusion Studio creates the cloud folder and symlink automatically

## Disabling Backup

Delete the symlink in this folder. Your local data remains untouched. The cloud folder is left as-is in case you re-enable later.

---

## Security: Why External Access Is Restricted

Fusion Studio **cannot** read or write files outside its own project folders by default. This is intentional.

To work on external files — a Downloads folder, a shared drive, a cloud-synced Documents folder — you **symlink individual folders into your workspace**:

```bash
# Example: symlink Downloads into your project
ln -s ~/Downloads ~/projects/my-app/ai/views/content/external-downloads
```

Valid symlink targets inside a project:
- Project root or any subfolder
- `ai/views/content/<any-subfolder>/`
- Anywhere within the workspace tree

The File-Viewer marks symlinks with a distinct icon so you always know when you're looking at external data. Clicking, editing, or deleting a symlinked file affects the **real file** at the target path — this is a direct user action, not automatic background sync.

This model keeps Fusion Studio safe by default while giving you full control over what external data enters your workspace.
