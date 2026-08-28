import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('file tabs use the shared browser-style strip without view-owned header chrome', () => {
  const contentAreaSource = read('src/components/ContentArea.tsx');
  const viewerSource = read('src/components/file-explorer/FileViewer.tsx');
  const stripSource = read('src/components/view-tabs/ViewTabStrip.tsx');
  const adapterSource = read('src/components/view-tabs/viewTabAdapters.ts');
  const browserTabsCss = read('src/components/browser/BrowserTabs.css');
  const sharedTabsCss = read('src/components/view-tabs/ViewTabBar.css');
  const documentCss = read('src/styles/document.css');
  const fileLayoutCss = read('../ai/RC-MacAir-15/Views/002-file-viewer/styles/layout.css');
  const fileThemeCss = read('../ai/RC-MacAir-15/System/styles/file-viewer.css');

  expect(contentAreaSource).toMatch(/<ViewLayoutControls panel=\{panel\} \/>\s*<ViewTabBar panel=\{panel\} \/>\s*\{children\}/s);
  expect(viewerSource).not.toContain('rv-file-viewer-header');
  expect(viewerSource).not.toContain('rv-file-viewer-tabs');
  expect(viewerSource).not.toContain('TabRow');
  expect(viewerSource).toContain("import { FloatingPathActions } from '../FloatingPathActions';");
  expect(viewerSource).toMatch(/<FloatingPathActions[\s\S]*?panel="file-viewer"[\s\S]*?relativePath=\{selectedFile\.path\}/);
  expect(viewerSource).toContain('<span>Select File</span>');
  expect(viewerSource).toContain('rv-file-tree-dock-control');

  expect(stripSource).toContain('new ResizeObserver(updateTabDensity)');
  expect(stripSource).toContain("firstTab.getBoundingClientRect().width <= 120");
  expect(stripSource).toContain("className={`rv-view-tab-strip${compactTabs ? ' compact' : ''}`}");
  expect(stripSource).toContain("event.key !== 'Enter' && event.key !== ' '");
  expect(stripSource).toMatch(/tabs\.map[\s\S]*rv-view-tab-close[\s\S]*\{plus && \(/);
  expect(adapterSource).toContain("'file-viewer': fileViewerAdapter");
  expect(adapterSource).toContain("availability: 'always'");
  expect(adapterSource).toContain("panelState.toggleCollapsed('file-viewer', 'rightCol')");

  for (const declaration of [
    'gap: 2px;',
    'padding: 4px 4px 0',
    'min-height: 36px;',
    'border-radius: 6px 6px 0 0;',
    'transform: translateY(-2px);',
  ]) {
    expect(browserTabsCss).toContain(declaration);
    expect(sharedTabsCss).toContain(declaration);
  }
  expect(sharedTabsCss).toMatch(/\.rv-view-tab-strip\s*\{[^}]*overflow: hidden;/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab\s*\{[^}]*max-width: 140px;[^}]*min-width: 0;[^}]*flex: 1 1 200px;/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab:not\(\.active\)::after\s*\{[^}]*right: 0;[^}]*width: 1px;[^}]*height: 16px;[^}]*background: var\(--content-foreground-color,/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab\.active::after,\s*\.rv-view-tab:last-of-type::after,\s*\.rv-view-tab:has\(\+ \.rv-view-tab\.active\)::after,\s*\.rv-view-tab:has\(\+ \.rv-view-tab:hover\)::after\s*\{[^}]*display: none;/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab-label\s*\{[^}]*text-overflow: clip;[^}]*mask-image: linear-gradient\(to right, #000 calc\(100% - 18px\), transparent 100%\);/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab-close \.material-symbols-outlined\s*\{[^}]*font-size: 10\.5px;/s);
  expect(sharedTabsCss).not.toMatch(/\.rv-view-tab-strip\.compact \.rv-view-tab-icon\s*\{[^}]*display: none;/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab-strip\.compact \.rv-view-tab-close\s*\{[^}]*position: absolute;[^}]*opacity: 0;/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab-strip\.compact \.rv-view-tab:hover \.rv-view-tab-close,[\s\S]*\.rv-view-tab-strip\.compact \.rv-view-tab:focus-within \.rv-view-tab-close\s*\{[^}]*opacity: 1;/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab-strip\.compact \.rv-view-tab:hover \.rv-view-tab-label,[\s\S]*\.rv-view-tab-strip\.compact \.rv-view-tab:focus-within \.rv-view-tab-label\s*\{[^}]*mask-image: linear-gradient\([\s\S]*transparent calc\(100% - 16px\),[\s\S]*transparent 100%/s);
  expect(sharedTabsCss).toMatch(/\.rv-view-tab-bar\s*\{[^}]*flex: 0 0 auto;[^}]*height: var\(--view-header-height, 40px\);/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-viewer-info\s*\{[^}]*height: var\(--view-header-height, 40px\);/s);
  expect(fileLayoutCss).toMatch(/\.rv-file-tree-sidebar\s*\{[^}]*top: calc\(var\(--view-header-height, 40px\) - 1px\);/s);
  expect(documentCss).toMatch(/\.rv-file-viewer-content \.rv-code-gutter\s*\{[^}]*border-right: none;/s);
  expect(documentCss).toMatch(/\.rv-file-viewer-content \.rv-wiki-page-content blockquote\s*\{[^}]*border-left-color: var\(--workspace-border-color,/s);
  expect(fileThemeCss).toMatch(/\.rv-file-explorer-layout\s*\{[^}]*--file-viewer-chrome-border: var\(--workspace-border-color,[^}]*--content-border:\s+var\(--workspace-border-color,/s);
  expect(fileThemeCss).toMatch(/\.rv-file-viewer-info\s*\{[^}]*border-bottom: 1px solid var\(--file-viewer-chrome-border\);/s);

  for (const obsoleteClass of ['rv-file-viewer-header', 'rv-file-viewer-tabs', 'rv-file-viewer-tab']) {
    expect(sharedTabsCss).not.toContain(obsoleteClass);
    expect(fileLayoutCss).not.toContain(obsoleteClass);
    expect(fileThemeCss).not.toContain(obsoleteClass);
    expect(documentCss).not.toContain(obsoleteClass);
  }
});
