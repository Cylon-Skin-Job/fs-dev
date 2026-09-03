import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { useFileStore } from '../src/state/fileStore';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('File tabs are shell-hosted and retain shared responsive geometry', () => {
  const contentArea = read('src/components/ContentArea.tsx');
  const viewer = read('src/components/file-explorer/FileViewer.tsx');
  const browserTabsCss = read('src/components/browser/BrowserTabs.css');
  const strip = read('src/components/view-tabs/ViewTabStrip.tsx');
  const css = read('src/components/view-tabs/ViewTabBar.css');
  const fileLayout = read('../ai/RC-MacAir-15/Views/002-file-viewer/styles/layout.css');
  const fileTheme = read('../ai/RC-MacAir-15/System/styles/file-viewer.css');
  const documentCss = read('src/styles/document.css');

  expect(contentArea.match(/<ViewTabBar\s+panel=/g)).toHaveLength(1);
  expect(viewer).not.toContain('TabRow');
  expect(viewer).not.toContain('rv-file-viewer-tabs');
  expect(viewer).not.toContain('rv-file-viewer-header');
  expect(viewer).not.toContain('className="rv-file-viewer-nav"');
  expect(viewer).not.toContain('title="Previous tab"');
  expect(viewer).not.toContain('title="Next tab"');
  expect(viewer).not.toContain('activateAdjacentTab');
  expect(viewer).not.toContain('scrollIntoView');
  expect(viewer).toContain('<FloatingPathActions');
  expect(strip).toContain('new ResizeObserver(updateDensity)');
  expect(strip).toContain('first.getBoundingClientRect().width <= 120');
  expect(strip).toContain('role="tablist"');
  expect(strip).toContain('role="tab"');

  for (const declaration of [
    'gap: 2px;',
    'min-height: 36px;',
    'border-radius: 6px 6px 0 0;',
    'transform: translateY(-2px);',
  ]) {
    expect(browserTabsCss).toContain(declaration);
    expect(css).toContain(declaration);
  }
  expect(browserTabsCss).toContain('padding: 4px 4px 0 4px;');
  expect(css).toContain('padding: 4px 4px 0;');
  for (const declaration of [
    'max-width: 140px;',
    'flex: 1 1 200px;',
    'font-size: 10.5px;',
  ]) {
    expect(css).toContain(declaration);
  }
  expect(css).toContain('transparent calc(100% - 16px)');
  expect(css).toContain('.rv-view-tab-rail.is-compact');
  expect(css).toContain('overflow: hidden;');

  for (const retiredSelector of ['rv-file-viewer-tabs', 'rv-file-viewer-tab', 'rv-tab-close']) {
    expect(fileLayout).not.toContain(retiredSelector);
    expect(fileTheme).not.toContain(retiredSelector);
    expect(documentCss).not.toContain(retiredSelector);
  }
  expect(documentCss).toMatch(/\.rv-file-viewer-content \.rv-code-gutter\s*\{[^}]*border-right: none;/s);
  expect(documentCss).toMatch(/\.rv-file-viewer-content \.rv-wiki-page-content blockquote\s*\{[^}]*border-left-color: var\(--workspace-border-color,/s);
  expect(fileTheme).toMatch(/\.rv-file-explorer-layout\s*\{[^}]*--file-viewer-chrome-border: var\(--workspace-border-color,[^}]*--content-border:\s+var\(--workspace-border-color,/s);
  expect(fileTheme).toMatch(/\.rv-file-viewer-info\s*\{[^}]*border-bottom: 1px solid var\(--file-viewer-chrome-border\);/s);
});

test('File zero/first/home flow is pathless-session-safe', () => {
  const store = read('src/state/fileStore.ts');
  const adapter = read('src/components/view-tabs/viewTabAdapters.ts');
  const viewer = read('src/components/file-explorer/FileViewer.tsx');

  expect(adapter).toContain("tabs.length === 0");
  expect(adapter).toContain("label: 'New file tab'");
  expect(store).toContain("kind: 'home'");
  expect(store).toContain('if (state.tabs.length === 0) return null');
  expect(store).toContain("tabs.filter((tab) => tab.kind === 'file')");
  expect(store).toContain(".filter((item) => typeof item.path === 'string' && item.path.trim().length > 0)");
  expect(store).toContain('state.activeTabPath === FILE_VIEW_HOME_TAB_ID');
  expect(store).toContain('index === activeHomeIndex ? newTab : tab');
  expect(viewer).toContain('<span>Select File</span>');
  expect(adapter).toContain("toggleCollapsed('file-viewer', 'rightCol')");
});

test('File hydration drops an active pathless record and activates its first real survivor', () => {
  const original = useFileStore.getState();
  useFileStore.setState({ tabs: [], activeTabPath: null, viewMode: 'tree' });
  try {
    useFileStore.getState().hydrateTabsFromActivity({
      recents: [],
      navigation: { stack: [], index: -1 },
      tabs: [
        {
          id: 'file-viewer:',
          panel: 'file-viewer',
          path: '',
          title: 'FILES',
          kind: 'view',
          openedAt: 1,
        },
        {
          id: 'file-viewer:notes/real.md',
          panel: 'file-viewer',
          path: 'notes/real.md',
          title: 'real.md',
          kind: 'file',
          extension: 'md',
          openedAt: 2,
        },
      ],
      activeTabId: 'file-viewer:',
    });

    expect(useFileStore.getState()).toMatchObject({
      activeTabPath: 'notes/real.md',
      viewMode: 'viewer',
      tabs: [{ kind: 'file', file: { path: 'notes/real.md' } }],
    });
  } finally {
    useFileStore.setState(original);
  }
});
