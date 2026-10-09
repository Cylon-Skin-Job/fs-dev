import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app = '/private/tmp/mc-s6-commit-supervisor-20261004/candidate/rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app';
const files = ['checklist-controller.js', 'checklist-view.js', 'index.html', 'checklist.css'];
const sources = Object.fromEntries(files.map((name) => [name, fs.readFileSync(path.join(app, name), 'utf8')]));
const hashes = Object.fromEntries(files.map((name) => [name, crypto.createHash('sha256').update(sources[name]).digest('hex')]));
const html = sources['index.html'];
assert.match(html, /<button id="reset-completion" class="rv-checklist-reset" type="button">Reset completion<\/button>/);
assert.match(html, /<script type="module" src="checklist-controller.js"><\/script>/);
assert.match(html, /<link rel="stylesheet" href="checklist.css">/);
assert.match(sources['checklist.css'], /\.rv-checklist-reset/);
const labels = ['Review report', 'Review sources', 'Send summary'];
const ids = ['draft', 'review', 'send'];
const storage = new Map();
const writes = [];
const samples = [];

class Element {
  constructor(tag, text = '') { this.tag = tag; this.textContent = text; this.children = []; this.listeners = {}; this.checked = false; }
  addEventListener(kind, handler) { this.listeners[kind] = handler; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
}
async function load() {
  const summary = new Element('p');
  const tasks = new Element('div');
  const reset = new Element('button', 'Reset completion');
  const nodes = { '#summary': summary, '#tasks': tasks, '#reset-completion': reset };
  for (const id of Object.keys(nodes)) assert.ok(html.includes('id="' + id.slice(1) + '"'));
  const document = {
    querySelector(selector) { assert.ok(nodes[selector]); return nodes[selector]; },
    createElement(tag) { return new Element(tag); },
    createTextNode(text) { return new Element('#text', text); },
  };
  const localStorage = {
    getItem(key) { assert.equal(key, 'checklist-completed'); return storage.get(key) ?? null; },
    setItem(key, value) { assert.equal(key, 'checklist-completed'); storage.set(key, value); writes.push(JSON.parse(value)); },
  };
  const context = vm.createContext({ document, localStorage });
  const view = new vm.SourceTextModule(sources['checklist-view.js'], { context, identifier: 'checklist-view.js' });
  const controller = new vm.SourceTextModule(sources['checklist-controller.js'], { context, identifier: 'checklist-controller.js' });
  await controller.link((specifier) => { assert.equal(specifier, './checklist-view.js'); return view; });
  await controller.evaluate();
  function sample(action, expectedChecks) {
    const rows = tasks.children;
    const text = rows.map((row) => row.children[1].textContent);
    const checks = rows.map((row) => row.children[0].checked);
    assert.equal(rows.length, 3);
    assert.deepEqual(text, labels);
    assert.deepEqual(checks, expectedChecks);
    assert.equal(summary.textContent, expectedChecks.filter((checked) => !checked).length + ' remaining of 3');
    assert.equal(reset.textContent, 'Reset completion');
    assert.equal(typeof reset.onclick, 'function');
    const persisted = JSON.parse(storage.get('checklist-completed') || '[]');
    assert.deepEqual(persisted, ids.filter((id, index) => expectedChecks[index]));
    samples.push({ action, rows: text, checks, summary: summary.textContent, persisted });
  }
  function change(index, checked) {
    const checkbox = tasks.children[index].children[0];
    assert.equal(checkbox.type, 'checkbox');
    checkbox.checked = checked;
    checkbox.listeners.change();
  }
  function resetCompletion() {
    const before = writes.length;
    reset.onclick();
    assert.equal(writes.length, before + 1, 'one reset click persists once, including after refresh');
    assert.equal(storage.get('checklist-completed'), '[]', 'reset immediately persists empty completion list');
  }
  return { sample, change, resetCompletion };
}

let screen = await load();
screen.sample('initial', [false, false, false]);
screen.change(0, true); screen.sample('check revised draft label with stable draft ID', [true, false, false]);
screen.change(1, true); screen.sample('check review', [true, true, false]);
screen.change(0, false); screen.sample('reverse draft', [false, true, false]);
screen = await load(); screen.sample('ordinary reload retains review/count2', [false, true, false]);
screen.change(0, true); screen.change(2, true); screen.sample('all complete count0', [true, true, true]);
screen = await load(); screen.sample('ordinary reload all complete', [true, true, true]);
for (let i = 0; i < 3; i += 1) screen.change(i, false);
screen.sample('all reversed count3', [false, false, false]);
screen = await load(); screen.sample('ordinary reload all incomplete', [false, false, false]);
screen.change(0, true); screen.change(1, true); screen.sample('two complete before reset', [true, true, false]);
screen.resetCompletion(); screen.sample('reset immediately unchecks retains labels/count3', [false, false, false]);
screen = await load(); screen.sample('ordinary reload retains reset', [false, false, false]);
screen.change(2, true); screen.sample('postreset completion remains reversible', [false, false, true]);
screen.change(2, false); screen.sample('postreset reversal', [false, false, false]);
screen.resetCompletion(); screen.sample('idempotent reset when all incomplete', [false, false, false]);
for (let mask = 0; mask < 8; mask += 1) {
  const checks = ids.map((id, index) => Boolean(mask & (1 << index)));
  checks.forEach((checked, index) => screen.change(index, checked));
  screen.sample('completion mask ' + mask, checks);
  screen.resetCompletion(); screen.sample('reset completion mask ' + mask, [false, false, false]);
  screen = await load(); screen.sample('reload after reset mask ' + mask, [false, false, false]);
}
console.log(JSON.stringify({ sourceFiles: hashes, samples, persistedWrites: writes, sourceOnly: true, realAppEvidence: false }, null, 2));

