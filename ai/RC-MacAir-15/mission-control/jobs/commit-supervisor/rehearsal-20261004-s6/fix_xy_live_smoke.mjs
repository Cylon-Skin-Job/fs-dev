// Public-route observations through an already launched canonical candidate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const verified = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const mode = process.argv[4] || 'observe';
const output = process.argv[5];
assert(['observe', 'acceptance', 'fix-xy'].includes(mode), 'unsupported UI mode');
if (config.summaryFormat !== undefined) assert(['N remaining', 'N remaining of 3'].includes(config.summaryFormat),
  'unsupported summaryFormat');
if (mode !== 'observe') assert(['N remaining', 'N remaining of 3'].includes(config.summaryFormat),
  'acceptance requires a resolved supported summaryFormat');
assert.equal(verified.repo, config.candidate);
assert.equal(verified.profile, config.profile);
assert.equal(verified.machine, config.machine);
const require = createRequire(path.join(config.candidate, 'fusion-studio-client/package.json'));
const { chromium } = require('@playwright/test');
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${verified.debugPort}`);
const evidence = { kind: 'PUBLIC_UI_OBSERVATION', mode, candidate: config.candidate, profile: config.profile,
  machine: config.machine, samples: [], started: new Date().toISOString() };
try {
  const page = browser.contexts().flatMap((context) => context.pages()).find((p) => p.url() === 'fusion-shell://app/');
  assert(page);
  await page.locator('.rv-connection-status.connected').waitFor();
  assert((await page.locator('.rv-workspace-name').innerText()).includes('S6 Checklist'));
  await page.locator('button.rv-tool-btn[title="Checklist"]').click();
  const frame = page.frameLocator('iframe[title="Checklist"]');
  await frame.locator('#summary').waitFor();
  const label = mode === 'fix-xy' ? 'Review report' : 'Draft report';
  const labels = [label, 'Review sources', 'Send summary'];
  const sample = async (action, expected, expectedChecks) => {
    const summary = await frame.locator('#summary').innerText();
    const rows = await frame.locator('#tasks label').allTextContents();
    const checks = await frame.getByRole('checkbox').evaluateAll((nodes) => nodes.map((node) => node.checked));
    evidence.samples.push({ action, summary, rows, checks });
    assert.deepEqual(rows.map((row) => row.trim()), labels, `${action}: visible labels`);
    assert.deepEqual(checks, expectedChecks, `${action}: visible checkbox states`);
    if (mode !== 'observe') assert.equal(Number(summary.match(/\d+/)?.[0]), expected, action);
    if (mode !== 'observe' && config.summaryFormat === 'N remaining of 3') assert.equal(summary, `${expected} remaining of 3`);
    if (mode !== 'observe' && config.summaryFormat === 'N remaining') assert.equal(summary, `${expected} remaining`);
  };
  for (const checkbox of await frame.getByRole('checkbox').all()) await checkbox.uncheck();
  await sample('all incomplete', 3, [false, false, false]);
  await frame.getByRole('checkbox', { name: label, exact: true }).check();
  await sample('first completed', 2, [true, false, false]);
  await frame.getByRole('checkbox', { name: 'Review sources', exact: true }).check();
  await sample('second completed', 1, [true, true, false]);
  await frame.getByRole('checkbox', { name: label, exact: true }).uncheck();
  await sample('first reversed', 2, [false, true, false]);
  if (mode === 'fix-xy') {
    await page.reload();
    await page.locator('.rv-connection-status.connected').waitFor();
    await page.locator('button.rv-tool-btn[title="Checklist"]').click();
    await sample('original reversal ordinary reload retention', 2, [false, true, false]);
    await frame.getByRole('checkbox', { name: label, exact: true }).check();
    await sample('two completed before reset', 1, [true, true, false]);
    await frame.getByRole('button', { name: 'Reset completion', exact: true }).click();
    await sample('reset', 3, [false, false, false]);
    evidence.resetPersistedImmediately = await frame.locator('body').evaluate(() => localStorage.getItem('checklist-completed'));
    assert.deepEqual(JSON.parse(evidence.resetPersistedImmediately), []);
  }
  await page.reload();
  await page.locator('.rv-connection-status.connected').waitFor();
  await page.locator('button.rv-tool-btn[title="Checklist"]').click();
  await sample('shell reload', mode === 'fix-xy' ? 3 : 2,
    mode === 'fix-xy' ? [false, false, false] : [false, true, false]);
  for (const checkbox of await frame.getByRole('checkbox').all()) await checkbox.check();
  await sample('all complete', 0, [true, true, true]);
  for (const checkbox of await frame.getByRole('checkbox').all()) await checkbox.uncheck();
  await sample('all incomplete again', 3, [false, false, false]);
  await page.locator('button.rv-tool-btn[title="Wiki"]').click();
  await page.getByText('Checklist Guide', { exact: true }).first().click();
  await page.getByRole('heading', { name: 'Checklist Guide', exact: true }).first().waitFor();
  evidence.articleText = await page.locator('.rv-wiki-explorer').innerText();
  if (mode === 'fix-xy') {
    for (const phrase of ['Review report', 'Review sources', 'Send summary', 'Reset completion', 'N remaining of 3', 'reload', 'restart']) assert(evidence.articleText.includes(phrase), `Wiki missing ${phrase}`);
    assert(!evidence.articleText.includes('Draft report'));
  }
  await page.locator('button.rv-tool-btn[title="Checklist"]').click();
  await page.locator('button.rv-tool-btn[title="Wiki"]').click();
  await page.getByRole('heading', { name: 'Checklist Guide', exact: true }).first().waitFor();
  await page.reload();
  await page.locator('.rv-connection-status.connected').waitFor();
  await page.getByRole('heading', { name: 'Checklist Guide', exact: true }).first().waitFor();
  evidence.articleReload = await page.getByRole('heading', { name: 'Checklist Guide', exact: true }).first().innerText();
  await page.screenshot({ path: `${output}.png` });
  for (let i = 0; i < 11; i += 1) {
    assert.equal(await page.locator('.rv-connection-status.connected').count(), 1);
    await page.waitForTimeout(200);
  }
  evidence.finished = new Date().toISOString();
  evidence.sustainedConnectedAfterNavigationReload = true;
} finally {
  if (output) fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  await browser.close();
}
