import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('file tabs use the browser tab design and shrink to fit without navigation controls', () => {
  const viewerSource = read('src/components/file-explorer/FileViewer.tsx');
  const browserTabsCss = read('src/components/browser/BrowserTabs.css');
  const documentCss = read('src/styles/document.css');
  const fileLayoutCss = read('../ai/RC-MacAir-15/Views/002-file-viewer/styles/layout.css');
  const fileThemeCss = read('../ai/RC-MacAir-15/System/styles/file-viewer.css');

  expect(viewerSource).not.toContain('className="rv-file-viewer-nav"');
  expect(viewerSource).not.toContain('title="Previous tab"');
  expect(viewerSource).not.toContain('title="Next tab"');
  expect(viewerSource).not.toContain('activateAdjacentTab');
  expect(viewerSource).not.toContain('scrollIntoView');
  expect(viewerSource).toContain('new ResizeObserver(updateTabDensity)');
  expect(viewerSource).toContain("firstTab.getBoundingClientRect().width <= 120");
  expect(viewerSource).toContain("className={`rv-file-viewer-tabs${compactTabs ? ' compact' : ''}`}");
  expect(viewerSource).toContain("import { CopyPathButton } from '../CopyPathButton';");
  expect(viewerSource).toContain("import { SendToChatButton } from '../SendToChatButton';");
  expect(viewerSource).toMatch(/<div className="rv-file-page-actions" aria-label="File actions">[\s\S]*?<CopyPathButton[\s\S]*?panel="file-viewer"[\s\S]*?relativePath=\{selectedFile\.path\}[\s\S]*?<SendToChatButton[\s\S]*?panel="file-viewer"[\s\S]*?relativePath=\{selectedFile\.path\}/);

  for (const declaration of [
    'gap: 2px;',
    'padding: 4px 4px 0',
    'min-height: 36px;',
    'border-radius: 6px 6px 0 0;',
    'transform: translateY(-2px);',
  ]) {
    expect(browserTabsCss).toContain(declaration);
    expect(fileLayoutCss).toContain(declaration);
  }
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tabs\s*\{[^}]*overflow: hidden;/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tab\s*\{[^}]*max-width: 200px;[^}]*min-width: 0;[^}]*flex: 1 1 200px;/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tab:not\(:last-child\)::after\s*\{[^}]*right: 0;[^}]*width: 1px;[^}]*height: 16px;[^}]*background: var\(--workspace-border-color, var\(--file-viewer-chrome-border\)\);/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tab\.active::after,\s*\.rv-file-viewer-tab:has\(\+ \.rv-file-viewer-tab\.active\)::after,\s*\.rv-file-viewer-tab:has\(\+ \.rv-file-viewer-tab:hover\)::after\s*\{[^}]*display: none;/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tab \.rv-tab-name\s*\{[^}]*text-overflow: clip;[^}]*mask-image: linear-gradient\(to right, #000 calc\(100% - 18px\), transparent 100%\);/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tab \.rv-tab-close \.material-symbols-outlined\s*\{[^}]*font-size: 10\.5px;/s);
  expect(fileLayoutCss).not.toMatch(/\.rv-file-viewer-tabs\.compact \.rv-file-viewer-tab \.rv-tab-icon\s*\{[^}]*display: none;/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tabs\.compact \.rv-file-viewer-tab \.rv-tab-close\s*\{[^}]*position: absolute;[^}]*opacity: 0;/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tabs\.compact \.rv-file-viewer-tab:hover \.rv-tab-close,[\s\S]*\.rv-file-viewer-tabs\.compact \.rv-file-viewer-tab:focus-within \.rv-tab-close\s*\{[^}]*opacity: 1;/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-tabs\.compact \.rv-file-viewer-tab:hover \.rv-tab-name,[\s\S]*\.rv-file-viewer-tabs\.compact \.rv-file-viewer-tab:focus-within \.rv-tab-name\s*\{[^}]*mask-image: linear-gradient\([\s\S]*transparent calc\(100% - 16px\),[\s\S]*transparent 100%/s);

  expect(fileLayoutCss).not.toMatch(/\.rv-file-viewer-tab\s*\{[^}]*border:\s*none;/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-header\s*\{[^}]*height: var\(--chat-header-height, 40px\);/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-info\s*\{[^}]*height: var\(--chat-header-height, 40px\);/s);
  expect(documentCss).toMatch(/\.rv-file-viewer-content \.rv-code-gutter\s*\{[^}]*border-right: none;/s);
  expect(documentCss).toMatch(/\.rv-file-viewer-content \.rv-wiki-page-content blockquote\s*\{[^}]*border-left-color: var\(--workspace-border-color,/s);
  expect(fileThemeCss).toMatch(/\.rv-file-explorer-layout\s*\{[^}]*--file-viewer-chrome-border: var\(--workspace-border-color,[^}]*--content-border:\s+var\(--workspace-border-color,/s);
  expect(fileThemeCss).toMatch(/\.rv-file-viewer-info\s*\{[^}]*border-bottom: 1px solid var\(--file-viewer-chrome-border\);/s);
  expect(fileThemeCss).toMatch(/\.rv-file-viewer-tab\.active\s*\{[^}]*border-top: 1px solid var\(--workspace-border-color, var\(--file-viewer-chrome-border\)\);[^}]*border-right: 1px solid var\(--workspace-border-color, var\(--file-viewer-chrome-border\)\);[^}]*border-bottom: none;[^}]*border-left: 1px solid var\(--workspace-border-color, var\(--file-viewer-chrome-border\)\);/s);
  expect(fileThemeCss).toMatch(/\.rv-file-viewer-header\s*\{[^}]*background: var\(--panel-chrome-bg/s);
});
