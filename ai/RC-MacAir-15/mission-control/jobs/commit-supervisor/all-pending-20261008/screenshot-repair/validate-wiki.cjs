const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { createRequire } = require('module');
const crypto = require('crypto');
const root = '/private/tmp/fusion-main-consolidation-95vxg0_h/candidate';
const report = __dirname;
const clientRequire = createRequire(path.join(root, 'fusion-studio-client/package.json'));
const page = path.join(root, 'ai/RC-MacAir-15/Wiki/004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md');
const raw = fs.readFileSync(page, 'utf8');
const metadata = clientRequire('gray-matter')(raw).data;
assert.equal(metadata.name, 'Screenshot Capture');
assert.ok(metadata.description.trim());
assert.equal(typeof metadata.metadata['last-modified'], 'string');
assert.match(metadata.metadata['last-modified'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
assert.match(raw, /last-modified: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
for (const forbidden of ['incoming-edges', 'outgoing-edges', 'connected-skills', 'related-trigger-files']) {
  assert.equal(metadata.metadata[forbidden], undefined);
}
const sources = metadata.metadata['source-files'];
assert.ok(Array.isArray(sources));
assert.equal(sources.length, new Set(sources).size);
for (const source of sources) {
  assert.ok(!path.isAbsolute(source) && !source.includes('*'));
  assert.ok(fs.statSync(path.join(root, source)).isFile());
}
const result = clientRequire('esbuild').buildSync({
  stdin: {
    contents: `export { parseWikiPage } from ${JSON.stringify(path.join(root, 'fusion-studio-client/src/lib/wiki-frontmatter.ts'))}; export { markdownToHtml } from ${JSON.stringify(path.join(root, 'fusion-studio-client/src/lib/transforms/markdown.ts'))};`,
    resolveDir: path.join(root, 'fusion-studio-client'),
    loader: 'ts',
  }, bundle: true, platform: 'node', format: 'cjs', write: false,
});
const loaded = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(loaded, loaded.exports, clientRequire);
const parsed = loaded.exports.parseWikiPage(raw);
assert.equal(parsed.frontmatter.name, metadata.name);
assert.deepEqual(parsed.frontmatter.metadata['source-files'], sources);
const html = loaded.exports.markdownToHtml(parsed.body);
assert.ok(html.includes('timestamp plus a server-generated UUID'));
assert.ok(html.includes('<code>screenshot:error</code> without overwriting its bytes'));
assert.ok(html.includes('<code>screenshot:file-captured</code>'));
const links = [...parsed.body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
for (const link of links) {
  if (link.startsWith('http') || link.startsWith('#')) continue;
  assert.ok(fs.existsSync(path.resolve(path.dirname(page), link.split('#')[0])), link);
}
const edit = JSON.parse(fs.readFileSync(path.join(report, 'wiki-edit-evidence.json'), 'utf8'));
const preimage = fs.readFileSync(edit.complete_adjacent_preimage);
const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(hash(preimage), edit.preimage_sha256);
assert.equal(hash(fs.readFileSync(page)), edit.current_sha256);
assert.equal(hash(fs.readFileSync(edit.source)), edit.source_sha256);
assert.equal(metadata.metadata['last-modified'], edit.actual_utc_write_timestamp);
fs.writeFileSync(path.join(report, 'wiki-render-readback.html'), html);
const dependencies = ['fusion-studio-client/src/lib/wiki-frontmatter.ts', 'fusion-studio-client/src/lib/front-matter.ts', 'fusion-studio-client/src/lib/transforms/markdown.ts', 'fusion-studio-client/src/components/wiki/PageViewer.tsx'].map((file) => ({ path: file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
console.log(JSON.stringify({ result: 'PASS', article: page, source_count: sources.length, local_links_resolved: links.length, version_preimage_equal: true, timestamp: metadata.metadata['last-modified'], renderer: 'Current production parseWikiPage + markdownToHtml exported via in-memory esbuild bundle', html_sha256: hash(html), dependencies, limits: 'Markdown/frontmatter and HTML readback only; no native app or visual UI gate. No navigation change; no audit generation required.' }, null, 2));
