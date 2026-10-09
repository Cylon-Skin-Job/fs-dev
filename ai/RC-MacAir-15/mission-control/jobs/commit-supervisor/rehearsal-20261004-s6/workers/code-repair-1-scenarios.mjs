import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const app = '/private/tmp/mc-s6-commit-supervisor-20261004/candidate/rehearsal-workspace/ai/MC-S6/System/Views/006-custom-viewer/app/';
const sources = Object.fromEntries(['checklist-controller.js', 'checklist-view.js', 'index.html', 'checklist.css'].map((name) => [name, readFileSync(app + name, 'utf8')]));
const hashes = Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, createHash('sha256').update(source).digest('hex')]));
assert.match(sources['index.html'], /<script type="module" src="checklist-controller\.js"><\/script>/);
assert.match(sources['index.html'], /id="summary" aria-live="polite"/);
assert.match(sources['index.html'], /id="tasks"/);
assert.match(sources['index.html'], /href="checklist\.css"/);

const storage = new Map();
const writes = [];
const localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, value); writes.push({ key, value }); },
};
async function load() {
  const summary = { textContent: '' };
  const tasks = { children: [], replaceChildren(...children) { this.children = children; } };
  const document = {
    querySelector(selector) {
      assert.ok(['#summary', '#tasks'].includes(selector));
      return selector === '#summary' ? summary : tasks;
    },
    createElement(tag) {
      assert.ok(['label', 'input'].includes(tag));
      return {
        tag, children: [], events: {},
        append(...children) { this.children.push(...children); },
        addEventListener(type, handler) { this.events[type] = handler; },
      };
    },
    createTextNode(textContent) { return { textContent }; },
  };
  const context = vm.createContext({ document, localStorage });
  const view = new vm.SourceTextModule(sources['checklist-view.js'], { context, identifier: app + 'checklist-view.js' });
  const controller = new vm.SourceTextModule(sources['checklist-controller.js'], { context, identifier: app + 'checklist-controller.js' });
  await controller.link((specifier) => {
    assert.equal(specifier, './checklist-view.js');
    return view;
  });
  await controller.evaluate();
  return { summary, tasks };
}

let ui = await load();
const samples = [];
function sample(action, count, checked) {
  const actual = {
    action, summary: ui.summary.textContent,
    labels: ui.tasks.children.map((row) => row.children[1].textContent),
    checks: ui.tasks.children.map((row) => row.children[0].checked),
    rowClasses: ui.tasks.children.map((row) => row.className),
    storage: localStorage.getItem('checklist-completed'),
  };
  assert.equal(actual.summary, `${count} remaining of 3`);
  assert.deepEqual(actual.labels, ['Draft report', 'Review sources', 'Send summary']);
  assert.deepEqual(actual.checks, checked);
  assert.deepEqual(actual.rowClasses, Array(3).fill('rv-checklist-row'));
  assert.equal(ui.tasks.children.length, 3);
  for (const row of ui.tasks.children) assert.equal(row.children[0].type, 'checkbox');
  const expectedIds = ['draft', 'review', 'send'].filter((id, i) => checked[i]);
  if (actual.storage !== null) assert.deepEqual(JSON.parse(actual.storage), expectedIds);
  samples.push(actual);
}
function change(index, checked) {
  const checkbox = ui.tasks.children[index].children[0];
  checkbox.checked = checked;
  assert.equal(typeof checkbox.events.change, 'function');
  checkbox.events.change();
}

sample('initial empty storage', 3, [false, false, false]);
change(0, true);
sample('check Draft report', 2, [true, false, false]);
change(1, true);
sample('check Review sources', 1, [true, true, false]);
change(0, false);
sample('uncheck Draft report', 2, [false, true, false]);
const storedBeforeReload = localStorage.getItem('checklist-completed');
ui = await load();
assert.equal(localStorage.getItem('checklist-completed'), storedBeforeReload);
sample('fresh modules with retained in-memory storage', 2, [false, true, false]);
change(0, true);
change(2, true);
sample('all complete', 0, [true, true, true]);
ui = await load();
sample('all complete module reload', 0, [true, true, true]);
change(0, false);
change(1, false);
change(2, false);
sample('all incomplete', 3, [false, false, false]);
ui = await load();
sample('all incomplete module reload', 3, [false, false, false]);
assert.equal(writes.length, 8);
assert.ok(writes.every(({ key }) => key === 'checklist-completed'));
console.log(JSON.stringify({
  result: 'PASS', kind: 'ISOLATED_ACTUAL_SOURCE_SCENARIOS', live_app_evidence: false,
  browser_storage_touched: false, canonical_restart_executed: false,
  sources: hashes, samples, writes,
  limits: 'Minimal DOM and in-memory localStorage exercise exact unchanged event/render/hydration code; actual custom iframe, browser localStorage, shell reload and canonical restart remain Supervisor runtime gates.',
}, null, 2));
