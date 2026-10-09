/** Production PageViewer readback of the seven changed canonical articles. */
import { expect, test } from '@playwright/test';
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';

const wiki = path.resolve('../ai/RC-MacAir-15/Wiki');
const articles = ['007-Chat_System/004-Chat_UI/001-Composer/PAGE.md', '004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md',
  '007-Chat_System/007-Structure/PAGE.md', '007-Chat_System/005-Testing_And_Operations/PAGE.md',
  '010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md',
  '010-Events_And_Ledger/011-UI_Action_Provenance_Module/001-Wiki_Viewer_UI_Context/PAGE.md',
  '010-Events_And_Ledger/011-UI_Action_Provenance_Module/002-File_Viewer_UI_Context/PAGE.md'];
const pages = articles.map(relative => ({ relative, source: fs.readFileSync(path.join(wiki, relative), 'utf8') }));
let bundle: Promise<string>;
test('changed Wiki articles parse, render/read back through actual production viewer and link source paths', async ({ page }, testInfo) => {
  const entry = 'virtual:material-wiki', resolved = '\0' + entry;
  bundle ??= build({ configFile: false, logLevel: 'silent', plugins: [{ name: 'material-wiki', resolveId: id => id === entry ? resolved : null,
    load: id => id === resolved ? `import {Buffer} from 'buffer'; globalThis.Buffer=Buffer; import React from 'react'; import {createRoot} from 'react-dom/client';
      import {PageViewer} from ${JSON.stringify(path.resolve('src/components/wiki/PageViewer.tsx'))};
      import {useWikiStore} from ${JSON.stringify(path.resolve('src/state/wikiStore.ts'))};
      window.__wikiReadback=(relative,source)=>{const folder=relative.replace(/\\/PAGE.md$/,'');
        const node={id:folder,path:folder,pagePath:relative,name:folder,label:folder,kind:'article',depth:1,children:[]};
        useWikiStore.setState({root:{id:'root',path:'',name:'Wiki',label:'Wiki',kind:'root',depth:0,children:[node]},
          viewedPath:folder,viewedPagePath:relative,selectedContent:source,loading:false,error:null});};
      createRoot(document.querySelector('#root')).render(React.createElement(PageViewer));` : null }],
    build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'iife' } } } })
    .then((r: any) => r.output.find((x: any) => x.type === 'chunk').code);
  await page.setContent('<div id="root"></div>'); await page.addScriptTag({ content: await bundle });
  const readback = [];
  for (const { relative, source } of pages) {
    const parsed = matter(source), metadata = parsed.data.metadata;
    expect(typeof metadata['last-modified']).toBe('string'); expect(metadata['last-modified']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(new Set(metadata['source-files']).size).toBe(metadata['source-files'].length);
    for (const code of metadata['source-files']) expect(fs.statSync(path.resolve('..', code)).isFile()).toBe(true);
    const links = [...parsed.content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1]);
    for (const link of links) if (!/^(https?:|#|\/)/.test(link)) expect(fs.existsSync(path.resolve(wiki, path.dirname(relative), link.split('#')[0]))).toBe(true);
    await page.evaluate(({ relative, source }) => (window as any).__wikiReadback(relative, source), { relative, source });
    await expect(page.locator('.rv-wiki-page-frontmatter-header h1')).toHaveText(parsed.data.name);
    for (const heading of [...parsed.content.matchAll(/^## (.+)$/gm)].map(match => match[1])) await expect(page.getByRole('heading', { name: heading, exact: true })).toHaveCount(1);
    await expect(page.locator('.rv-wiki-page-content')).toContainText('Main'); await expect(page.locator('.rv-wiki-page-content')).toContainText('Side');
    const footer = page.locator('.rv-wiki-page-metadata-footer'); for (const code of metadata['source-files']) await expect(footer).toContainText(code);
    const body = await page.locator('.rv-wiki-page-content').innerText();
    readback.push({ relative, sha256: crypto.createHash('sha256').update(source).digest('hex'), name: parsed.data.name,
      headings: await page.locator('.rv-wiki-page-content h2').allTextContents(), links, metadataSources: metadata['source-files'], renderedText: body });
    await page.screenshot({ path: testInfo.outputPath(path.basename(path.dirname(relative)) + '.png') });
  }
  fs.writeFileSync(testInfo.outputPath('wiki-readback.json'), JSON.stringify({ owner: 'production PageViewer/parseWikiPage/markdownToHtml', articles: readback }, null, 2));
});
