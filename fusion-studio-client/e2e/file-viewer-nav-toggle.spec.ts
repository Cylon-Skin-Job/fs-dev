import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('reselecting File Explorer toggles its persisted file tree pane', () => {
  const appSource = read('src/components/App.tsx');
  const typesSource = read('src/types/index.ts');
  const viewSliceSource = read('src/state/slices/viewSlice.ts');
  const layoutCss = read('../ai/RC-MacAir-15/System/Views/002-file-viewer/styles/layout.css');
  const serverDefaults = read('../fusion-studio-server/lib/view-state/resolver.js');

  expect(appSource).toMatch(/if \(panelId === 'file-viewer' && currentPanel === panelId\) \{\s*toggleCollapsed\(panelId, 'rightCol'\);\s*return;/s);
  expect(appSource).toContain('onSwitch={handlePanelSwitch}');
  expect(appSource).toContain("'--file-tree-w':      `${collapsed.rightCol ? 0 : rightColWidth}px`");
  expect(typesSource).toContain("export type CollapsablePane = 'leftSidebar' | 'leftChat' | 'rightCol';");
  expect(typesSource).toMatch(/collapsed:\s*\{\s*leftSidebar: boolean;\s*leftChat: boolean;\s*rightCol: boolean;/s);
  expect(viewSliceSource).toContain('collapsed: { leftSidebar: false, leftChat: false, rightCol: false }');
  expect(layoutCss).toMatch(/\.rv-file-tree-sidebar\s*\{[^}]*width: var\(--file-tree-w, var\(--right-col-w, 220px\)\);[^}]*transition: width/s);
  expect(serverDefaults).toMatch(/collapsed:\s*\{\s*leftSidebar: false,\s*leftChat:\s+false,\s*rightCol:\s+false,/s);
});
