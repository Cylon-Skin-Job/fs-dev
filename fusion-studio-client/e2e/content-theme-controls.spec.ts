import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('content background is fixed while File Viewer and Wiki borders follow the workspace border control', () => {
  const pickerSource = read('src/components/ThemePicker.tsx');
  const livePreviewSource = read('src/lib/theme/live-preview.ts');
  const documentCss = read('src/styles/document.css');
  const wikiCss = read('../ai/RC-MacAir-15/System/Views/004-wiki-viewer/styles/layout.css');
  const fileViewerCss = read('../ai/RC-MacAir-15/System/styles/file-viewer.css');
  const tintCss = read('../ai/RC-MacAir-15/System/styles/tints.css');
  const captureCss = read('../ai/RC-MacAir-15/System/styles/capture-viewer.css');

  const contentSettings = pickerSource.slice(
    pickerSource.indexOf('Content Settings'),
    pickerSource.indexOf('Border settings'),
  );

  expect(contentSettings).not.toContain('value={contentBackground}');
  expect(contentSettings).toContain('value={contentHeadings}');
  expect(contentSettings).toContain('value={contentText}');
  expect(pickerSource).not.toContain('contentBackground: p.contentBackground');
  expect(pickerSource).toContain('contentHeadings: p.contentHeadings');
  expect(pickerSource).toContain('contentText: p.contentText');
  expect(livePreviewSource).toContain('applyContentTextTone(color, { luminance, contentText, documentBg })');
  expect(livePreviewSource).toContain('applyContentTextTone(computeContentLink({');

  expect(documentCss).toMatch(/\.rv-document-surface\s*\{[^}]*background:\s*var\(--document-surface-bg/s);
  expect(documentCss).toMatch(/\.rv-code-gutter\s*\{[^}]*border-right:\s*1px solid var\(--content-attenuated[^}]*color:\s*var\(--content-attenuated/s);
  expect(documentCss).toMatch(/\.rv-wiki-page-content h1\s*\{[^}]*color:\s*var\(--content-heading-color/s);

  expect(wikiCss).toMatch(/\.rv-wiki-page-viewer\s*\{[^}]*background:\s*var\(--document-bg/s);
  expect(wikiCss).toMatch(/\.rv-wiki-topic-list\s*\{[^}]*background:\s*var\(--theme-primary/s);
  expect(wikiCss).toMatch(/\.rv-wiki-page-nav\s*\{[^}]*background:\s*var\(--theme-primary/s);
  expect(wikiCss).toMatch(/\.rv-wiki-edge-panel\s*\{[^}]*background:\s*var\(--theme-primary/s);
  expect(wikiCss).toMatch(/\.rv-wiki-explorer\s*\{[^}]*--content-border: var\(--workspace-border-color,/s);
  expect(wikiCss).toMatch(/\.rv-wiki-topic-list\s*\{[^}]*border-right: 1px solid var\(--workspace-border-color,/s);
  expect(wikiCss).toMatch(/\.rv-wiki-page-nav\s*\{[^}]*border-bottom: 1px solid var\(--workspace-border-color,/s);
  expect(wikiCss).toMatch(/\.rv-wiki-edge-panel\s*\{[^}]*border-left: 1px solid var\(--workspace-border-color,/s);
  expect(wikiCss).toMatch(/\.rv-wiki-page-viewer \.rv-wiki-page-content blockquote\s*\{[^}]*border-left-color: var\(--workspace-border-color,/s);
  expect(wikiCss).not.toContain('1px solid var(--neutral-chrome-border');
  expect(wikiCss).toContain('color: var(--content-heading-color');
  expect(fileViewerCss).toMatch(/\.rv-file-tree-sidebar\s*\{[^}]*background:\s*var\(--theme-primary/s);
  expect(fileViewerCss).toContain('color: var(--content-attenuated');
  expect(fileViewerCss).toContain('border-bottom: 1px solid var(--file-viewer-chrome-border');
  expect(tintCss).toMatch(/body\[data-tint-right="true"\] \.rv-file-tree-sidebar\s*\{[^}]*background:\s*var\(--theme-primary/s);
  expect(captureCss).toContain('color: var(--content-heading-color');
  expect(captureCss).toContain('color: var(--content-text-color');
  expect(captureCss).toContain('border-bottom: 1px solid var(--content-border');
});
