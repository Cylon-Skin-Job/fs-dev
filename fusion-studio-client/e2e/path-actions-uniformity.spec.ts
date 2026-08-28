import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function filesContainingImport(importName: string) {
  const sourceRoot = path.resolve(process.cwd(), 'src/components');
  const matches: string[] = [];

  function visit(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (
        entry.isFile()
        && entry.name.endsWith('.tsx')
        && read(path.relative(process.cwd(), entryPath)).includes(`import { ${importName} }`)
      ) {
        matches.push(path.relative(sourceRoot, entryPath));
      }
    }
  }

  visit(sourceRoot);
  return matches.sort();
}

test('page and detail path actions use the shared floating component with current paths', () => {
  const mappings = [
    ['src/components/capture/FilePageView.tsx', /<FloatingPathActions[\s\S]*?panel=\{panel\}[\s\S]*?relativePath=\{file\.path\}/],
    ['src/components/office/OfficeDocumentTopbar.tsx', /<FloatingPathActions[\s\S]*?panel=\{PANEL\}[\s\S]*?relativePath=\{file\.path\}/],
    ['src/components/email/EmailDocumentTopbar.tsx', /<FloatingPathActions[\s\S]*?panel=\{PANEL\}[\s\S]*?relativePath=\{file\.path\}/],
    ['src/components/office/OfficeGrid.tsx', /<FloatingPathActions[\s\S]*?panel=\{PANEL\}[\s\S]*?relativePath=\{currentFolder\}/],
    ['src/components/email/EmailGrid.tsx', /<FloatingPathActions[\s\S]*?panel=\{PANEL\}[\s\S]*?relativePath=\{currentFolder\}/],
    ['src/components/agents/AgentTiles.tsx', /<FloatingPathActions[\s\S]*?panel="agents-viewer"[\s\S]*?relativePath=\{`\$\{agent\.folder\}\/\$\{agent\.id\}\/`\}/],
    ['src/components/wiki/EdgePanel.tsx', /<FloatingPathActions[\s\S]*?panel="wiki-viewer"[\s\S]*?relativePath=\{viewedPagePath\}/],
    ['src/components/file-explorer/FileViewer.tsx', /<FloatingPathActions[\s\S]*?panel="file-viewer"[\s\S]*?relativePath=\{selectedFile\.path\}/],
    ['src/components/wiki/PageViewer.tsx', /<FloatingPathActions[\s\S]*?panel="wiki-viewer"[\s\S]*?relativePath=\{viewedPagePath\}/],
    ['src/components/tickets/TicketBoard.tsx', /<FloatingPathActions[\s\S]*?panel="issues-viewer"[\s\S]*?relativePath=\{relativePath\}/],
  ] as const;

  for (const [file, binding] of mappings) {
    const source = read(file);
    expect(source).toContain("import { FloatingPathActions }");
    expect(source).toMatch(binding);
    expect(source.match(/<FloatingPathActions/g)).toHaveLength(1);
  }

  expect(read('src/components/capture/FilePageView.tsx')).not.toMatch(/\{isCaptureView \? \(\s*<FloatingPathActions/);
});

test('superseded page pairs are gone while explicit per-item controls remain', () => {
  const directConsumers = [
    'FloatingPathActions.tsx',
    'file-explorer/FileNode.tsx',
    'file-explorer/FolderNode.tsx',
    'wiki/TopicList.tsx',
  ];

  expect(filesContainingImport('CopyPathButton')).toEqual(directConsumers);
  expect(filesContainingImport('SendToChatButton')).toEqual(directConsumers);

  for (const file of directConsumers.slice(1)) {
    const source = read(`src/components/${file}`);
    expect(source).toContain('<CopyPathButton');
    expect(source).toContain('<SendToChatButton');
  }

  const viewsCss = read('../ai/RC-MacAir-15/System/styles/views.css');
  expect(viewsCss).not.toContain('.rv-file-page-actions');
  expect(read('src/components/wiki/EdgePanel.tsx')).not.toContain('NodeActions');
  expect(read('src/components/office/OfficeGrid.css')).not.toContain('.rv-office-folder-actions');
  expect(read('src/components/email/EmailGrid.css')).not.toContain('.rv-email-folder-actions');
});

test('floating actions have a bottom-right containing block on each migrated surface', () => {
  const sharedCss = read('src/components/FloatingPathActions.css');
  expect(sharedCss).toMatch(/\.rv-floating-path-actions\s*\{[^}]*position: absolute;[^}]*right:[^}]*bottom:/s);

  expect(read('src/components/capture/FilePageView.css')).toMatch(/\.rv-file-page-view\s*\{[^}]*position: relative;/s);
  expect(read('src/components/office/OfficeDocumentPage.css')).toMatch(/\.rv-office-document-page\s*\{[^}]*position: relative;/s);
  expect(read('src/components/email/EmailDocumentPage.css')).toMatch(/\.rv-email-document-page\s*\{[^}]*position: relative;/s);
  expect(read('src/components/office/OfficeGrid.css')).toMatch(/\.rv-office-content-panel\s*\{[^}]*position: relative;/s);
  expect(read('src/components/email/EmailGrid.css')).toMatch(/\.rv-email-content-panel\s*\{[^}]*position: relative;/s);
  expect(read('../ai/RC-MacAir-15/Views/007-agents-viewer/styles/layout.css')).toMatch(/\.rv-agent-detail-fullscreen\s*\{[^}]*position: relative;/s);
  expect(read('../ai/RC-MacAir-15/Views/004-wiki-viewer/styles/layout.css')).toMatch(/\.rv-wiki-edge-panel\s*\{[^}]*position: relative;/s);
});
