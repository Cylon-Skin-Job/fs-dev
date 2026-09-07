'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const {
  attachShellNavigationPolicy,
  installSubframeHeaderPolicy,
} = require('./shell-navigation-policy.cjs');

function event() {
  return { prevented: false, preventDefault() { this.prevented = true; } };
}

test('navigation policy confines the main frame and denies shell subframes and popups', () => {
  const webContents = new EventEmitter();
  let openHandler;
  let acceptedMainNavigations = 0;
  webContents.setWindowOpenHandler = (handler) => { openHandler = handler; };
  attachShellNavigationPolicy(webContents, {
    onMainFrameNavigation: () => { acceptedMainNavigations += 1; },
  });

  const allowed = event();
  webContents.emit('will-navigate', allowed, 'fusion-shell://app/');
  assert.equal(allowed.prevented, false);
  const pathDenied = event();
  webContents.emit('will-navigate', pathDenied, 'fusion-shell://app/settings?token=secret#fragment');
  assert.equal(pathDenied.prevented, true);
  const denied = event();
  webContents.emit('will-navigate', denied, 'https://example.com/');
  assert.equal(denied.prevented, true);
  assert.equal(acceptedMainNavigations, 1);

  const subframe = event();
  subframe.url = 'fusion-shell://app/';
  subframe.isMainFrame = false;
  webContents.emit('will-frame-navigate', subframe);
  assert.equal(subframe.prevented, true);
  const contentSubframe = event();
  contentSubframe.url = 'fusion-studio://wiki-viewer/app/index.html';
  contentSubframe.isMainFrame = false;
  webContents.emit('will-frame-navigate', contentSubframe);
  assert.equal(contentSubframe.prevented, false);
  assert.equal(acceptedMainNavigations, 1);
  assert.deepEqual(openHandler({ url: 'fusion-shell://app/' }), { action: 'deny' });
  assert.equal(openHandler({ url: 'https://example.com/' }).action, 'allow');

  const childContents = new EventEmitter();
  childContents.setWindowOpenHandler = () => {};
  webContents.emit('did-create-window', { webContents: childContents });
  const childNavigation = event();
  childNavigation.url = 'fusion-shell://app/';
  childContents.emit('will-navigate', childNavigation);
  assert.equal(childNavigation.prevented, true);
});

test('subframe header rewriting never weakens shell responses', () => {
  let handler;
  const webContents = {
    session: { webRequest: { onHeadersReceived: (_filter, value) => { handler = value; } } },
  };
  installSubframeHeaderPolicy(webContents);
  const shellHeaders = {
    'Content-Security-Policy': ["default-src 'self'; frame-ancestors 'none'"],
    'X-Frame-Options': ['DENY'],
  };
  let result;
  handler({ resourceType: 'subFrame', url: 'fusion-shell://app/', responseHeaders: shellHeaders }, (value) => { result = value; });
  assert.deepEqual(result.responseHeaders, shellHeaders);

  handler({ resourceType: 'subFrame', url: 'https://example.com/', responseHeaders: shellHeaders }, (value) => { result = value; });
  assert.equal(result.responseHeaders['X-Frame-Options'], undefined);
  assert.deepEqual(result.responseHeaders['Content-Security-Policy'], ["default-src 'self';"]);
});
