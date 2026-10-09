import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

// I-11 era realignment (2026-09-12): the reselect-toggle moved out of App.tsx
// (the dock toggle seam now lives on the file document surfaces) and the
// collapsable-pane type moved to types/view-state.ts with `contentArea` added.
test('file tree pane toggling stays persisted and wired to the dock seam', () => {
  const appSource = read('src/components/App.tsx');
  const viewStateSource = read('src/types/view-state.ts');
  const viewSliceSource = read('src/state/slices/viewSlice.ts');
  const layoutCss = read('../ai/RC-MacAir-15/System/Views/002-file-viewer/styles/layout.css');
  const serverDefaults = read('../fusion-studio-server/lib/view-state/resolver.js');
  const dockSeam = read('src/components/file-explorer/FileDocumentPresenter.tsx');

  expect(appSource).toContain('onSwitch={handlePanelSwitch}');
  expect(appSource).toContain("'--file-tree-w':      `${collapsed.rightCol ? 0 : rightColWidth}px`");
  expect(viewStateSource).toContain("export type CollapsablePane = 'leftSidebar' | 'leftChat' | 'rightCol' | 'contentArea';");
  expect(viewStateSource).toMatch(/collapsed:\s*\{\s*leftSidebar: boolean;\s*leftChat: boolean;\s*rightCol: boolean;\s*contentArea: boolean;/s);
  expect(viewSliceSource).toContain('collapsed: { leftSidebar: false, leftChat: false, rightCol: false, contentArea: false }');
  expect(dockSeam).toContain("toggleCollapsed('file-viewer', 'rightCol')");
  expect(layoutCss).toMatch(/\.rv-file-tree-sidebar\s*\{[^}]*width: var\(--file-tree-w, var\(--right-col-w, 220px\)\);[^}]*transition: width/s);
  expect(serverDefaults).toMatch(/collapsed:\s*\{\s*leftSidebar: false,\s*leftChat:\s+false,\s*rightCol:\s+false,\s*contentArea: false,/s);
});
