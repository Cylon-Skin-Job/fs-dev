# Chunk 4: Export Pipeline (Pandoc + IPC)

**Project:** fs-dev (Fusion Studio)  
**Scope:** Office Document Editor — Phase 4  
**Depends on:** Chunk 1 (Save Infrastructure), Chunk 3 (Office Document Page)  
**Blocks:** Chunk 5  

---

## Context

Fusion Studio is an Electron app. The user wants document export (PDF, DOCX) to work out of the box with no host dependencies. This means Pandoc must be bundled inside the Electron binary and invoked from the main process.

The client is a React app served from `localhost:3001` (dev) or static `dist/` (prod). The Electron main process (`electron/main.cjs`) already has IPC handlers for `capture-page` and `capture-rect`.

---

## What This Chunk Builds

1. A build script that downloads Pandoc binaries for all target platforms.
2. Bundling Pandoc into `electron/resources/pandoc/`.
3. An IPC handler `export-document` in the Electron main process.
4. Preload bridge exposure for the new IPC channel.
5. UI integration in `OfficeDocumentPage` (Export button + dropdown).
6. Client-side download logic (base64 → Blob → download).

---

## Files to Create / Modify

### New File: `fusion-studio-client/scripts/download-pandoc.js`

**Purpose:** Download Pandoc binaries at build time.

**Requirements:**
- Download from GitHub releases (e.g., `https://github.com/jgm/pandoc/releases/download/3.1.11/pandoc-3.1.11-macOS.zip`).
- Support macOS (arm64 + x64), Windows, Linux.
- Extract to `fusion-studio-client/electron/resources/pandoc/<platform>/pandoc`.
- Fail the build if download fails.

**Simplified approach for now:**
```js
const fs = require('fs');
const path = require('path');
const https = require('https');

const PANDOC_VERSION = '3.1.11';
const RESOURCES_DIR = path.join(__dirname, '..', 'electron', 'resources', 'pandoc');

const PLATFORMS = {
  darwin: `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-macOS.zip`,
  win32: `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-windows-x86_64.zip`,
  linux: `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-linux-amd64.tar.gz`,
};

// Download, extract, place binary in RESOURCES_DIR/<platform>/pandoc
```

**Note:** For a real implementation, use a library like `adm-zip` and `tar`. For macOS, you may need to handle both `arm64` and `x86_64` (universal binary or separate downloads). For this chunk, start with the current build platform and document the multi-platform requirement.

### Modified File: `fusion-studio-client/electron/main.cjs`

Add `export-document` IPC handler:

```js
const { spawn } = require('child_process');
const os = require('os');

// Resolve Pandoc binary path
function getPandocPath() {
  const platform = os.platform();
  const binName = platform === 'win32' ? 'pandoc.exe' : 'pandoc';
  // In dev, look in electron/resources/pandoc/<platform>/
  // In production, process.resourcesPath points to Contents/Resources (macOS) or resources (others)
  const devPath = path.join(__dirname, '..', 'resources', 'pandoc', platform, binName);
  const prodPath = path.join(process.resourcesPath, 'pandoc', platform, binName);
  return fs.existsSync(prodPath) ? prodPath : devPath;
}

ipcMain.handle('export-document', async (_event, { format, content, filename }) => {
  const pandocPath = getPandocPath();
  if (!fs.existsSync(pandocPath)) {
    return { success: false, error: 'Pandoc not found in bundle' };
  }

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${filename}.md`);
  const outputExt = format === 'pdf' ? 'pdf' : 'docx';
  const outputPath = path.join(tmpDir, `${filename}.${outputExt}`);

  fs.writeFileSync(inputPath, content, 'utf8');

  const args = [inputPath, '-o', outputPath];
  if (format === 'pdf') {
    args.push('--pdf-engine=xelatex'); // or wkhtmltopdf if bundled
  }

  return new Promise((resolve) => {
    const proc = spawn(pandocPath, args);
    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data; });
    proc.on('close', (code) => {
      if (code !== 0 || !fs.existsSync(outputPath)) {
        resolve({ success: false, error: stderr || 'Pandoc failed' });
        return;
      }
      const buffer = fs.readFileSync(outputPath);
      const base64 = buffer.toString('base64');
      // Clean up temp files
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
      resolve({ success: true, base64, filename: `${filename}.${outputExt}` });
    });
  });
});
```

### Modified File: `fusion-studio-client/electron/preload.cjs`

Expose the new IPC channel:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  capturePage: () => ipcRenderer.invoke('capture-page'),
  captureRect: (rect) => ipcRenderer.invoke('capture-rect', rect),
  exportDocument: (payload) => ipcRenderer.invoke('export-document', payload),
});
```

### TypeScript Types (if needed)

Add to `fusion-studio-client/src/types/electron.d.ts` or similar:
```ts
declare global {
  interface Window {
    electronAPI?: {
      capturePage: () => Promise<string | null>;
      captureRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<string | null>;
      exportDocument: (payload: { format: 'docx' | 'pdf'; content: string; filename: string }) => Promise<
        | { success: true; base64: string; filename: string }
        | { success: false; error: string }
      >;
    };
  }
}
```

### Modified File: `fusion-studio-client/src/components/office/OfficeDocumentPage.tsx`

Add export handler:

```tsx
const handleExport = async (format: 'docx' | 'pdf') => {
  if (!window.electronAPI?.exportDocument) {
    alert('Export not available');
    return;
  }
  if (!crepeRef.current) return;
  const markdown = await crepeRef.current.getMarkdown();
  const result = await window.electronAPI.exportDocument({
    format,
    content: markdown,
    filename: file.name.replace(/\.md$/, ''),
  });
  if (!result.success) {
    alert(`Export failed: ${result.error}`);
    return;
  }
  // Download
  const byteCharacters = atob(result.base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {
    type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

Wire the Export button:
```tsx
<button onClick={() => handleExport('docx')} title="Export DOCX">
  <span className="material-symbols-outlined">description</span>
</button>
<button onClick={() => handleExport('pdf')} title="Export PDF">
  <span className="material-symbols-outlined">picture_as_pdf</span>
</button>
```

---

## Acceptance Criteria

- [ ] `scripts/download-pandoc.js` downloads and extracts Pandoc to `electron/resources/pandoc/`.
- [ ] `electron/main.cjs` exposes `export-document` IPC handler.
- [ ] `electron/preload.cjs` exposes `exportDocument` to renderer.
- [ ] `OfficeDocumentPage` has Export DOCX and Export PDF buttons.
- [ ] Export generates a valid `.docx` file that opens in Microsoft Word / Google Docs / Apple Pages.
- [ ] Export generates a valid `.pdf` file.
- [ ] No external Pandoc installation is required on the host machine.
- [ ] Error states are handled gracefully (missing binary, Pandoc failure).

---

## Notes

- **PDF engine:** Pandoc needs a PDF engine. The default is LaTeX (`xelatex`/`pdflatex`). If bundling LaTeX is too heavy, consider bundling `wkhtmltopdf` instead, or use `weasyprint`. For Phase 1, document the PDF engine dependency and start with DOCX (which needs no external engine).
- **Build integration:** Add `npm run download-pandoc` to the build pipeline, or call it in a `postinstall` script.
- **Security:** `export-document` receives Markdown content from the renderer. Pandoc processes untrusted input. This is fine for local documents, but be aware of the attack surface.
