import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanupFixture, closeOwnedApp, createChat, createProject, clickWorkspaceMenu, selectPanel, stageAndLaunch, waitFor, withDb,
} from './electron-case-helpers.mjs';
import { materializeF3Workspace } from './fixture-workloads.mjs';

const [token, evidenceRoot, tempRoot, caseFocus] = process.argv.slice(2);
if (!token || !evidenceRoot || !tempRoot) throw new Error('R5/R6 scenario arguments are required');
if (caseFocus && !['r6-owner', 'r6-lifetime', 'r5-current'].includes(caseFocus)) throw new Error(`unknown R5/R6 case focus: ${caseFocus}`);
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const caseSuffix = caseFocus ? `-${caseFocus}` : '';
const projectPath = path.join(tempRoot, `r5-r6-project${caseSuffix}`);
const systemPath = path.join(tempRoot, `system-fixture${caseSuffix}`, 'system-files');
const resultPath = path.join(evidenceRoot, caseFocus === 'r6-owner' ? 'r6-production-owner-result.json'
  : caseFocus === 'r6-lifetime' ? 'r6-lifetime-result.json'
  : caseFocus === 'r5-current' ? 'r5-current-result.json' : 'r5-r6-result.json');
let fixture = null;
let runtime = null;
let failure = null;
let result = null;
let lingering = [];
let systemSetupReadiness = null;
let systemAttemptBaseline = null;
let systemAttemptSnapshot = null;

function listenerBootstrap() {
  const state = window.__chatArchActions = {
    sentTypes: {}, receivedTypes: {}, fusionActionAdds: 0, fusionActionRemoves: 0,
    socketMessageAdds: 0, socketMessageRemoves: 0, actionEvents: [], sockets: [],
    holdTypes: {}, heldMessages: [], sentFrames: [], messageListenerStates: {}, nextListenerId: 0, nextHeldId: 0,
    trackingOperation: false, operationListenerIds: [], projectionFrames: [],
    errorFrames: [], panelChangedFrames: [],
  };
  state.setHold = (type, enabled) => { state.holdTypes[type] = enabled; };
  state.releaseHeld = (type, threadId = null) => {
    const matches = (item) => item.type === type && (threadId === null || item.threadId === threadId);
    const ready = state.heldMessages.filter(matches);
    state.heldMessages = state.heldMessages.filter((item) => !matches(item));
    for (const item of ready) if (state.messageListenerStates[item.id]?.active) item.deliver();
  };
  state.startOperation = () => { state.operationListenerIds = []; state.trackingOperation = true; };
  state.stopOperation = () => { state.trackingOperation = false; };
  state.activeOperationListeners = () => state.operationListenerIds.filter((id) => state.messageListenerStates[id]?.active).length;
  const nativeWindowAdd = window.addEventListener.bind(window);
  const nativeWindowRemove = window.removeEventListener.bind(window);
  nativeWindowAdd('fusion:chat-action', (event) => {
    const attachment = event.detail?.attachment;
    state.actionEvents.push({ panel: attachment?.panel || null, path: attachment?.path || null,
      promptId: event.detail?.promptId || null, target: event.detail?.target || null, delivery: event.detail?.delivery || null });
  });
  window.addEventListener = (type, listener, options) => {
    if (type === 'fusion:chat-action') state.fusionActionAdds += 1;
    return nativeWindowAdd(type, listener, options);
  };
  window.removeEventListener = (type, listener, options) => {
    if (type === 'fusion:chat-action') state.fusionActionRemoves += 1;
    return nativeWindowRemove(type, listener, options);
  };
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      state.sockets.push(this);
      // Production ws-client owns the socket through `onmessage`, while older
      // fixture probes attach EventTarget listeners. Hold both delivery forms.
      let applicationMessageHandler = null;
      super.onmessage = (event) => {
        if (!applicationMessageHandler) return;
        let frame = null;
        try { frame = JSON.parse(event.data); } catch {}
        if (frame?.type && state.holdTypes[frame.type]) {
          state.heldMessages.push({ heldId: ++state.nextHeldId,
            type: frame.type, requestId: frame.requestId || null,
            workspaceId: frame.workspaceId || null, workspaceEpoch: frame.workspaceEpoch || null,
            threadId: frame.threadId || null,
            threadGroupId: frame.threadGroupId || null, id: applicationHandlerId,
            deliver: () => applicationMessageHandler?.call(this, event) });
        } else applicationMessageHandler.call(this, event);
      };
      const applicationHandlerId = ++state.nextListenerId;
      state.messageListenerStates[applicationHandlerId] = { active: true };
      Object.defineProperty(this, 'onmessage', {
        get: () => applicationMessageHandler,
        set: (listener) => { applicationMessageHandler = listener; },
      });
      const nativeAdd = this.addEventListener.bind(this);
      const nativeRemove = this.removeEventListener.bind(this);
      const wrappers = new Map();
      this.addEventListener = (type, listener, options) => {
        if (type !== 'message') return nativeAdd(type, listener, options);
        state.socketMessageAdds += 1;
        const id = ++state.nextListenerId;
        state.messageListenerStates[id] = { active: true };
        if (state.trackingOperation) state.operationListenerIds.push(id);
        const wrapped = (event) => {
          let frameType = null;
          try { frameType = JSON.parse(event.data).type || null; } catch {}
          if (frameType && state.holdTypes[frameType]) {
            let threadId = null;
            let threadGroupId = null;
            try {
              const frame = JSON.parse(event.data);
              threadId = frame.threadId || null;
              threadGroupId = frame.threadGroupId || null;
            } catch {}
            state.heldMessages.push({ heldId: ++state.nextHeldId,
              type: frameType, threadId, threadGroupId, id, deliver: () => listener.call(this, event) });
          } else listener.call(this, event);
        };
        wrappers.set(listener, { wrapped, id });
        return nativeAdd(type, wrapped, options);
      };
      this.removeEventListener = (type, listener, options) => {
        if (type !== 'message') return nativeRemove(type, listener, options);
        state.socketMessageRemoves += 1;
        const registered = wrappers.get(listener);
        if (registered) {
          state.messageListenerStates[registered.id].active = false;
          wrappers.delete(listener);
        }
        return nativeRemove(type, registered?.wrapped || listener, options);
      };
      nativeAdd('message', (event) => {
        try {
          const frame = JSON.parse(event.data);
          const type = frame.type || 'unknown';
          state.receivedTypes[type] = (state.receivedTypes[type] || 0) + 1;
          if (type === 'error') state.errorFrames.push({ requestId: frame.requestId || null,
            code: frame.code || null, message: frame.message || null, workspaceEpoch: frame.workspaceEpoch || null });
          if (type === 'panel_changed') state.panelChangedFrames.push({ panel: frame.panel || null });
          if (type === 'panel_config') state.projectionFrames.push({
            workspaceId: frame.workspaceId || null,
            unavailable: Boolean(frame.viewRegistryUnavailable),
            viewIds: Array.isArray(frame.viewCapsules?.entries)
              ? frame.viewCapsules.entries.map((entry) => entry.viewId).filter((id) => typeof id === 'string') : [],
          });
          if (type === 'prompt:resolved' && typeof frame.content === 'string') state.lastResolvedCommand = frame.content;
        } catch {}
      });
      const nativeSend = this.send.bind(this);
      this.send = (payload) => {
        let type = 'unparsed';
        try {
          const frame = JSON.parse(String(payload));
          type = frame.type || 'unknown';
          state.sentFrames.push({ type, requestId: frame.requestId || null });
        } catch {}
        state.sentTypes[type] = (state.sentTypes[type] || 0) + 1;
        return nativeSend(payload);
      };
    }
  };
}

async function firstVisibleAction(panel, titles) {
  for (const title of titles) {
    const buttons = panel.locator(`button[title="${title}"]`);
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      if (await button.isVisible()) return button;
    }
  }
  return null;
}

async function startActionOrderProbe(page, eventIndex, beforePills, expectedPanel) {
  await page.evaluate(({ eventIndex, beforePills, expectedPanel }) => {
    const state = window.__chatArchActions;
    const probe = { eventIndex, beforePills, expectedPanel, sequence: 0,
      resultSequence: null, successSequence: null, ambiguous: false };
    const candidates = (record) => {
      const nodes = record.type === 'childList' ? [...record.addedNodes] : [record.target];
      const elements = [];
      for (const node of nodes) {
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (!element) continue;
        elements.push(element);
        if (record.type === 'childList') elements.push(...element.querySelectorAll('.rv-toast,.rv-chat-attachment-pill'));
      }
      return elements;
    };
    probe.observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName !== 'title') continue;
        const sequence = ++probe.sequence;
        let result = false;
        let success = false;
        const sourcePath = state.actionEvents[probe.eventIndex]?.path;
        for (const element of candidates(record)) {
          const pill = element.closest('.rv-chat-attachment-pill');
          if (pill && sourcePath && pill.getAttribute('title') === sourcePath
            && !probe.beforePills.includes(sourcePath)
            && pill.closest('.rv-panel')?.getAttribute('data-panel') === probe.expectedPanel) result = true;
          const toast = element.closest('.rv-toast');
          if (toast && /attached|sent|created|ready|success/i.test(toast.textContent || '')) success = true;
        }
        if (result && probe.resultSequence === null) probe.resultSequence = sequence;
        if (success && probe.successSequence === null) probe.successSequence = sequence;
        if (result && success) probe.ambiguous = true;
      }
    });
    probe.observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['title'] });
    state.actionOrderProbe = probe;
  }, { eventIndex, beforePills, expectedPanel });
}

async function actionSnapshot(page, panel, id, sentBefore, context = {}) {
  await waitFor(page, async () => {
    const { sourcePath, titles } = await page.evaluate((eventIndex) => ({
      sourcePath: window.__chatArchActions.actionEvents[eventIndex]?.path || null,
      titles: [...document.querySelectorAll('.rv-panel.active .rv-chat-attachment-pill')].map((node) => node.getAttribute('title')),
    }), context.eventIndex ?? 0);
    if (sourcePath && titles.includes(sourcePath) && !context.beforePills?.includes(sourcePath)) return true;
    return await page.locator('.rv-toast').filter({ hasText: /fail|unavailable|not available|no.*(chat|target)|not sent/i }).count() > 0;
  }, `${id} exact attachment or visible failure`, 3_000).catch(() => {});
  const toast = await page.locator('.rv-toast').count() ? await page.locator('.rv-toast').last().innerText() : '';
  const attachment = await page.evaluate((eventIndex) => {
    const event = window.__chatArchActions.actionEvents[eventIndex];
    const pills = [...document.querySelectorAll('.rv-panel.active .rv-chat-attachment-pill')]
      .map((node) => node.getAttribute('title'));
    return { sourcePanel: event?.panel || null, sourcePath: event?.path || null,
      deliveredPath: pills.find((title) => title === event?.path) || null, pillCount: pills.length };
  }, context.eventIndex ?? 0);
  const order = await page.evaluate(() => {
    const probe = window.__chatArchActions.actionOrderProbe;
    if (!probe) return { supported: false, resultSequence: null, successSequence: null, ambiguous: true };
    probe.observer.disconnect();
    window.__chatArchActions.actionOrderProbe = null;
    return { supported: true, resultSequence: probe.resultSequence,
      successSequence: probe.successSequence, ambiguous: probe.ambiguous };
  });
  const sourcePathFixtureContained = typeof attachment.sourcePath === 'string'
    && path.isAbsolute(attachment.sourcePath)
    && (() => {
      try {
        const relative = path.relative(fs.realpathSync(projectPath), fs.realpathSync(attachment.sourcePath));
        return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
      } catch { return false; }
    })();
  return {
    id, toast, successToastClaimed: /attached|sent|created/i.test(toast),
    visibleFailure: /fail|unavailable|not available|no.*(chat|target)|not sent/i.test(toast),
    attachmentPills: attachment.pillCount,
    sourcePanelMatches: attachment.sourcePanel === context.expectedPanel,
    sourcePathFixtureContained,
    sourcePathSha256: attachment.sourcePath ? crypto.createHash('sha256').update(attachment.sourcePath).digest('hex') : null,
    deliveredPathSha256: attachment.deliveredPath ? crypto.createHash('sha256').update(attachment.deliveredPath).digest('hex') : null,
    exactSourceAttachmentApplied: Boolean(attachment.sourcePath && attachment.deliveredPath === attachment.sourcePath
      && !context.beforePills?.includes(attachment.sourcePath)),
    orderingObserverSupported: order.supported,
    resultMutationObserved: order.resultSequence !== null,
    successMutationObserved: order.successSequence !== null,
    resultBeforeSuccess: order.resultSequence !== null
      && (order.successSequence === null || (order.resultSequence < order.successSequence && !order.ambiguous)),
    resultMutationSequence: order.resultSequence,
    successMutationSequence: order.successSequence,
    targetThreadId: await panel.locator('.rv-chat-area').count()
      ? await panel.locator('.rv-chat-area').getAttribute('data-chat-thread-id') : null,
    draftLength: await panel.locator('textarea.rv-chat-input').count()
      ? (await panel.locator('textarea.rv-chat-input').inputValue()).length : null,
    outgoingDelta: await page.evaluate((before) => {
      const current = window.__chatArchActions.sentTypes;
      const delta = {};
      for (const [type, count] of Object.entries(current)) delta[type] = count - (before[type] || 0);
      return delta;
    }, sentBefore),
  };
}

async function clickAction(page, panel, id, titles, expectedPanel) {
  const button = await firstVisibleAction(panel, titles);
  assert.ok(button, `${id} actual caller button was not rendered`);
  const sentBefore = await page.evaluate(() => ({ ...window.__chatArchActions.sentTypes }));
  const eventIndex = await page.evaluate(() => window.__chatArchActions.actionEvents.length);
  const beforePills = await panel.locator('.rv-chat-attachment-pill').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
  await startActionOrderProbe(page, eventIndex, beforePills, expectedPanel);
  await button.click();
  return actionSnapshot(page, panel, id, sentBefore, { expectedPanel, eventIndex, beforePills });
}

async function clickSystemPrompt(panel, name) {
  await panel.locator('.rv-system-new-workspace').click();
  await panel.getByRole('radio', { name: 'New Folder' }).check();
  await panel.locator('#rv-system-new-name').fill(name);
  await panel.getByRole('button', { name: 'Create', exact: true }).click();
}

async function selectReadySystemPanel(page) {
  const panel = await selectPanel(page, 'system-viewer', 'System');
  const before = await page.evaluate(() => window.__chatArchActions.panelChangedFrames.length);
  // A visible React panel can precede the server's queued set_panel work.
  // Re-select through the public rail and wait for its server acknowledgment
  // before exercising an action that requires the thread mutation binding.
  await page.locator('.rv-tool-btn[title="System"]').click();
  await waitFor(page, () => page.evaluate((index) =>
    window.__chatArchActions.panelChangedFrames.slice(index)
      .some((frame) => frame.panel === 'system-viewer'), before),
  'System server panel acknowledgment', 15_000);
  return panel;
}

async function exerciseProductionR6(runtime, primaryLabel) {
  const { page, app } = runtime;
  await page.evaluate(() => {
    const state = window.__chatArchActions;
    state.toastSignals = [];
    const seen = new WeakMap();
    const record = () => {
      for (const node of document.querySelectorAll('.rv-toast')) {
        const value = node.textContent || '';
        if (seen.get(node) === value) continue;
        seen.set(node, value);
        state.toastSignals.push({ success: /attached|sent|created|ready|success/i.test(value),
          cancelled: /cancelled|canceled|not sent/i.test(value) });
      }
    };
    state.toastObserver = new MutationObserver(record);
    state.toastObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    record();
  });
  const actions = () => page.evaluate(() => {
    const state = window.__chatArchActions;
    return { sent: { ...state.sentTypes }, received: { ...state.receivedTypes },
      activeOperationListeners: state.activeOperationListeners(), held: state.heldMessages.length };
  });
  const countDelta = (after, before, direction, type) => (after[direction][type] || 0) - (before[direction][type] || 0);
  const switchWorkspaceMenu = async (label) => app.evaluate(({ Menu }, target) => {
    const workspaces = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    const item = workspaces?.submenu?.items.find((candidate) => candidate.label === target);
    if (!item) throw new Error(`workspace menu item unavailable: ${target}`);
    // Electron flips a checkbox before invoking its callback. Keep its
    // visibility at the existing value so this click exercises Switch.
    if (item.type === 'checkbox') item.checked = !item.checked;
    item.click(item);
  }, label);
  const readSystemGroup = async (threadId, label) => {
    const row = page.locator(`.rv-panel.active .rv-chat-item[data-thread-id="${threadId}"]`);
    let lastRequestAt = 0;
    await waitFor(page, async () => {
      if (await row.isVisible().catch(() => false)) return true;
      if (Date.now() - lastRequestAt > 500) {
        lastRequestAt = Date.now();
        await page.evaluate(() => {
          const socket = [...window.__chatArchActions.sockets].reverse()
            .find((candidate) => candidate.readyState === WebSocket.OPEN);
          socket?.send(JSON.stringify({ type: 'thread:list', viewId: 'system-viewer' }));
        });
      }
      return false;
    }, label, 15_000);
    return row;
  };
  const reconnectAndRelease = async (type) => {
    // A modal overlay remains open while its action awaits. Close through the
    // public control first: this is the cancellation boundary under test.
    const exit = page.locator('.rv-panel.active .rv-system-new-exit');
    if (await exit.isVisible()) await exit.click();
    await switchWorkspaceMenu(primaryLabel);
    try {
      await page.waitForFunction((label) => document.querySelector('.rv-workspace-name')?.textContent?.includes(label), primaryLabel, { timeout: 15_000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({ label: document.querySelector('.rv-workspace-name')?.textContent,
        sent: window.__chatArchActions.sentTypes, received: window.__chatArchActions.receivedTypes,
        overlay: !!document.querySelector('.rv-system-new-overlay') }));
      throw new Error(`R6 public workspace switch did not settle: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
    await page.evaluate(() => {
      const state = window.__chatArchActions;
      state.destinationDraftsBefore = [...document.querySelectorAll('textarea.rv-chat-input')].map((node) => node.value);
      [...state.sockets].reverse().find((socket) => socket.readyState === WebSocket.OPEN)?.close(4778, 'r6-owned-reconnect');
    });
    await waitFor(page, () => page.evaluate(() => window.__chatArchActions.sockets.some((socket) => socket.readyState === WebSocket.OPEN)),
      'R6 authenticated socket reconnect', 15_000);
    await page.evaluate((frameType) => {
      window.__chatArchActions.setHold(frameType, false);
      window.__chatArchActions.releaseHeld(frameType);
    }, type);
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const state = window.__chatArchActions;
      return { destinationDraftPreserved: JSON.stringify(state.destinationDraftsBefore.filter(Boolean))
        === JSON.stringify([...document.querySelectorAll('textarea.rv-chat-input')].map((node) => node.value).filter(Boolean)),
        activeOperationListeners: state.activeOperationListeners() };
    });
  };
  const systemPanel = await selectReadySystemPanel(page);
  const promptBefore = await actions();
  const promptOrigin = await page.evaluate(() => {
    const state = window.__chatArchActions;
    state.promptOriginDraft = document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value || '';
    return { threadId: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') || null,
      toastIndex: state.toastSignals.length };
  });
  await page.evaluate(() => { const state = window.__chatArchActions; state.setHold('prompt:resolved', true); state.startOperation(); });
  await clickSystemPrompt(systemPanel, 'R6 Await Prompt');
  await waitFor(page, async () => countDelta(await actions(), promptBefore, 'sent', 'prompt:resolve') > 0,
    'R6 production prompt request', 15_000);
  await waitFor(page, async () => countDelta(await actions(), promptBefore, 'received', 'prompt:resolved') > 0,
    'R6 held production prompt response', 15_000);
  await page.evaluate(() => window.__chatArchActions.stopOperation());
  const promptWhileHeld = await actions();
  const promptAfter = await reconnectAndRelease('prompt:resolved');
  const promptEnd = await actions();

  await switchWorkspaceMenu('R5 System Fixture');
  await page.waitForFunction(() => document.querySelector('.rv-workspace-name')?.textContent?.includes('R5 System Fixture'), null, { timeout: 15_000 });
  await selectReadySystemPanel(page);
  if (promptOrigin.threadId) {
    const originRow = await readSystemGroup(promptOrigin.threadId, 'R6 original System group list readback');
    await originRow.click();
    await waitFor(page, () => page.locator('.rv-panel.active .rv-chat-area').getAttribute('data-chat-thread-id')
      .then((id) => id === promptOrigin.threadId), 'R6 original System group readback', 15_000);
  }
  const promptOriginAfter = await page.evaluate((origin) => {
    const state = window.__chatArchActions;
    return { threadPreserved: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') === origin.threadId,
      draftPreserved: document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value === state.promptOriginDraft,
      visibleSuccessClaimed: state.toastSignals.slice(origin.toastIndex).some((item) => item.success) };
  }, promptOrigin);
  const readTarget = () => page.evaluate(() => ({
    threadId: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') || null,
    draftLength: document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value.length ?? null,
  }));
  const completePanel = await selectReadySystemPanel(page);
  if (!(await readTarget()).threadId) {
    // Cancellation may leave the committed R5 group unselected after a
    // workspace rebind. Open that server-backed group through its real rail.
    const existingGroup = completePanel.locator('.rv-chat-item[data-thread-group-id]').first();
    await existingGroup.waitFor({ state: 'visible', timeout: 15_000 });
    await existingGroup.click();
    await waitFor(page, async () => Boolean((await readTarget()).threadId),
      'R6 authenticated existing System group open', 15_000);
  }
  const completionBefore = await actions();
  const completionTargetBefore = await readTarget();
  assert.ok(completionTargetBefore.threadId, 'R6 competing open needs an existing authenticated System thread');
  await page.evaluate(() => {
    const state = window.__chatArchActions;
    state.completionDraftBefore = document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value || '';
    state.lastResolvedCommand = null;
    state.setHold('thread:opened', true);
    state.startOperation();
  });
  await clickSystemPrompt(completePanel, 'R6 Correlated Completion');
  await waitFor(page, async () => countDelta(await actions(), completionBefore, 'sent', 'thread:open-assistant') > 0,
    'R6 production correlated create request', 15_000);
  await waitFor(page, () => page.evaluate((existingThreadId) => {
    const state = window.__chatArchActions;
    const requestId = state.sentFrames.filter((item) => item.type === 'thread:open-assistant').at(-1)?.requestId;
    return state.heldMessages.some((item) =>
      item.type === 'thread:opened' && item.requestId === requestId
      && item.workspaceId === 'system-files' && item.threadId && item.threadId !== existingThreadId);
  },
  completionTargetBefore.threadId), 'R6 held original production create response', 15_000);
  const originalOpen = await page.evaluate((existingThreadId) => {
    const state = window.__chatArchActions;
    const createRequestId = state.sentFrames.filter((item) => item.type === 'thread:open-assistant').at(-1)?.requestId;
    const held = state.heldMessages.filter((item) => item.type === 'thread:opened'
      && item.requestId === createRequestId && item.workspaceId === 'system-files'
      && item.threadId !== existingThreadId);
    return { threadId: held[0]?.threadId || null,
      deliverableIds: held.filter((item) => state.messageListenerStates[item.id]?.active).map((item) => item.heldId),
      deliverableListeners: held.filter((item) => state.messageListenerStates[item.id]?.active).length,
      operationListeners: held.filter((item) => state.operationListenerIds.includes(item.id)
        && state.messageListenerStates[item.id]?.active).length };
  }, completionTargetBefore.threadId);
  assert.ok(originalOpen.threadId && originalOpen.deliverableListeners > 0,
    'R6 production original create response had no deliverable thread identity');
  await page.evaluate((existingThreadId) => {
    const socket = [...window.__chatArchActions.sockets].reverse().find((candidate) => candidate.readyState === WebSocket.OPEN);
    socket?.send(JSON.stringify({ type: 'thread:open', threadId: existingThreadId }));
  }, completionTargetBefore.threadId);
  await waitFor(page, () => page.evaluate((existingThreadId) =>
    window.__chatArchActions.heldMessages.some((item) => item.type === 'thread:opened'
      && item.threadId === existingThreadId), completionTargetBefore.threadId),
  'R6 authenticated competing thread:opened response', 15_000);
  const competingHeld = await page.evaluate((existingThreadId) =>
    window.__chatArchActions.heldMessages.filter((item) => item.type === 'thread:opened' && item.threadId === existingThreadId).length,
  completionTargetBefore.threadId);
  assert.ok(competingHeld > 0, 'R6 competing public response was not held for ordered delivery');
  await page.evaluate((existingThreadId) => window.__chatArchActions.releaseHeld('thread:opened', existingThreadId),
    completionTargetBefore.threadId);
  await page.waitForTimeout(250);
  const afterCompeting = await readTarget();
  const competingDraftPreserved = await page.evaluate(() =>
    document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value === window.__chatArchActions.completionDraftBefore);
  const originalStillDeliverable = await page.evaluate((originalThreadId) => {
    const state = window.__chatArchActions;
    const held = state.heldMessages.filter((item) => item.type === 'thread:opened' && item.threadId === originalThreadId
      && state.messageListenerStates[item.id]?.active);
    return { all: held.length, heldIds: held.map((item) => item.heldId),
      operation: held.filter((item) => state.operationListenerIds.includes(item.id)).length };
  }, originalOpen.threadId);
  await page.evaluate((originalThreadId) => {
    window.__chatArchActions.setHold('thread:opened', false);
    window.__chatArchActions.releaseHeld('thread:opened', originalThreadId);
  }, originalOpen.threadId);
  await waitFor(page, async () => {
    const target = await readTarget();
    return target.threadId === originalOpen.threadId && target.draftLength > 0;
  }, 'R6 exact correlated production completion', 15_000);
  await page.evaluate(() => window.__chatArchActions.stopOperation());
  const completionEnd = await actions();
  const completionTarget = await readTarget();
  const completionExactDraft = await page.evaluate(() => {
    const command = window.__chatArchActions.lastResolvedCommand;
    return typeof command === 'string' && command.length > 0
      && document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value === command;
  });

  const createPanel = await selectReadySystemPanel(page);
  const createBefore = await actions();
  const createOrigin = await page.evaluate(() => {
    const state = window.__chatArchActions;
    state.createOriginDraft = document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value || '';
    state.lastResolvedCommand = null;
    state.setHold('thread:opened', true);
    state.startOperation();
    return { threadId: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') || null,
      toastIndex: state.toastSignals.length };
  });
  await clickSystemPrompt(createPanel, 'R6 Await Creation');
  await waitFor(page, async () => countDelta(await actions(), createBefore, 'sent', 'thread:open-assistant') > 0,
    'R6 production create request', 15_000);
  await waitFor(page, () => page.evaluate(() => {
    const state = window.__chatArchActions;
    const requestId = state.sentFrames.filter((item) => item.type === 'thread:open-assistant').at(-1)?.requestId;
    return state.heldMessages.some((item) => item.type === 'thread:opened'
      && item.requestId === requestId && item.workspaceId === 'system-files');
  }), 'R6 held production create response', 15_000);
  const createResponse = await page.evaluate(() => {
    const state = window.__chatArchActions;
    const createRequestId = state.sentFrames.filter((item) => item.type === 'thread:open-assistant').at(-1)?.requestId;
    const item = state.heldMessages.find((held) => held.type === 'thread:opened'
      && held.requestId === createRequestId && held.workspaceId === 'system-files');
    return { threadId: item?.threadId || null, threadGroupId: item?.threadGroupId || null };
  });
  assert.ok(createResponse.threadId && createResponse.threadId !== createOrigin.threadId && createResponse.threadGroupId,
    'R6 held creation response needs a distinct exact server thread and group');
  await page.evaluate(() => window.__chatArchActions.stopOperation());
  const createWhileHeld = await actions();
  const createAfter = await reconnectAndRelease('thread:opened');
  const createEnd = await actions();
  await switchWorkspaceMenu('R5 System Fixture');
  await page.waitForFunction(() => document.querySelector('.rv-workspace-name')?.textContent?.includes('R5 System Fixture'), null, { timeout: 15_000 });
  const restoredCreatePanel = await selectReadySystemPanel(page);
  if (createOrigin.threadId) {
    const originRow = await readSystemGroup(createOrigin.threadId, 'R6 cancelled origin group list readback');
    await originRow.click();
    await waitFor(page, () => restoredCreatePanel.locator('.rv-chat-area').getAttribute('data-chat-thread-id')
      .then((id) => id === createOrigin.threadId), 'R6 cancelled origin group readback', 15_000);
  }
  const createOriginAfter = await page.evaluate(({ origin, responseThreadId }) => {
    const state = window.__chatArchActions;
    const threadId = document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') || null;
    const draft = document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value || '';
    const cancelled = threadId === origin.threadId && draft === state.createOriginDraft;
    const completedAtOriginalTarget = threadId === responseThreadId
      && typeof state.lastResolvedCommand === 'string' && state.lastResolvedCommand.length > 0
      && draft === state.lastResolvedCommand;
    const signals = state.toastSignals.slice(origin.toastIndex);
    return { outcome: cancelled ? 'cancelled' : completedAtOriginalTarget ? 'completed-at-original-target' : 'invalid',
      visibleClaimConsistent: !((cancelled && signals.some((item) => item.success))
        || (completedAtOriginalTarget && signals.some((item) => item.cancelled))) };
  }, { origin: createOrigin, responseThreadId: createResponse.threadId });
  const serverCreatedGroup = restoredCreatePanel.locator(`.rv-chat-item[data-thread-group-id="${createResponse.threadGroupId}"]`);
  await waitFor(page, () => serverCreatedGroup.count().then((count) => count > 0),
    'R6 committed server group retained after reconnect', 15_000);
  const createServerGroupPreserved = await serverCreatedGroup.count() > 0;
  let createCancelledGroupClean = true;
  if (createOriginAfter.outcome === 'cancelled') {
    await serverCreatedGroup.click();
    await waitFor(page, () => restoredCreatePanel.locator('.rv-chat-area').getAttribute('data-chat-thread-id')
      .then((threadId) => threadId === createResponse.threadId), 'R6 cancelled server-created group opens', 15_000);
    createCancelledGroupClean = await restoredCreatePanel.locator('textarea.rv-chat-input').inputValue() === '';
  }
  // Exercise terminal error and deadline through the same installed app owner
  // and authenticated socket. The UI's fixed System template cannot name an
  // invalid prompt, so these inject only the action intent at its public bridge.
  await page.evaluate(() => {
    const state = window.__chatArchActions;
    state.bridgeResults = {};
    state.invokeBridge = (key, promptId) => {
      state.bridgeResults[key] = { completions: 0, result: null };
      window.dispatchEvent(new CustomEvent('fusion:chat-action', { detail: {
        target: 'new', delivery: 'insert', promptId, variables: {},
        capturedAddress: { workspaceId: 'system-files', viewId: 'system-viewer',
          threadGroupId: null, threadId: null },
        claim() {},
        complete(result) { state.bridgeResults[key].completions += 1; state.bridgeResults[key].result = result; },
      } }));
    };
  });
  const terminalBefore = await actions();
  await page.evaluate(() => window.__chatArchActions.invokeBridge('error', 'fixture.missing-prompt'));
  await waitFor(page, () => page.evaluate(() => !!window.__chatArchActions.bridgeResults.error.result),
    'R6 exact prompt error result', 15_000);
  const terminalError = await page.evaluate(() => window.__chatArchActions.bridgeResults.error);
  const afterError = await actions();
  await page.evaluate(() => {
    window.__chatArchActions.setHold('prompt:resolved', true);
    window.__chatArchActions.invokeBridge('timeout', 'workspace-manager.workspace-creation');
  });
  await waitFor(page, () => page.evaluate(() => !!window.__chatArchActions.bridgeResults.timeout.result),
    'R6 prompt deadline result', 20_000);
  const terminalTimeout = await page.evaluate(() => window.__chatArchActions.bridgeResults.timeout);
  await page.evaluate(() => {
    window.__chatArchActions.setHold('prompt:resolved', false);
    window.__chatArchActions.releaseHeld('prompt:resolved');
  });
  await page.waitForTimeout(250);
  const terminalEnd = await actions();
  await page.evaluate(() => window.__chatArchActions.toastObserver.disconnect());
  return {
    id: 'R6-PRODUCTION-ACTION-OWNER', status: 'executed', ownerRoute: 'authenticated SystemViewer fusion:chat-action',
    promptAwaiting: countDelta(promptWhileHeld, promptBefore, 'sent', 'thread:open-assistant') === 0,
    promptHeldResponses: promptWhileHeld.held,
    promptNoStaleCreate: countDelta(promptEnd, promptBefore, 'sent', 'thread:open-assistant') === 0,
    promptDestinationDraftPreserved: promptAfter.destinationDraftPreserved,
    // DOM socket listeners are unrelated to the action's internal
    // onFusionResponse resources; keep this as observational data only.
    promptOperationListenersRemoved: promptAfter.activeOperationListeners === 0,
    promptNoExtraPromptDispatch: countDelta(promptEnd, promptWhileHeld, 'sent', 'prompt:resolve') === 0,
    promptOriginThreadPreserved: promptOriginAfter.threadPreserved,
    promptOriginDraftPreserved: promptOriginAfter.draftPreserved,
    promptNoVisibleSuccess: !promptOriginAfter.visibleSuccessClaimed,
    competingFrameReceived: countDelta(completionEnd, completionBefore, 'received', 'thread:opened') >= 2,
    competingHeldResponses: competingHeld,
    completionOperationListenersAttached: originalOpen.operationListeners,
    competingDidNotConsumeOriginal: originalOpen.deliverableIds.every((id) =>
      originalStillDeliverable.heldIds.includes(id)),
    competingTargetPreserved: afterCompeting.threadId === completionTargetBefore.threadId,
    competingDraftPreserved,
    completionExactThread: completionTarget.threadId === originalOpen.threadId,
    completionDraftPresent: completionTarget.draftLength > 0,
    completionExactDraft,
    // The bootstrap counts DOM socket listeners, not this action's internal
    // response map; retain the observation without making it an oracle.
    completionListenersRemoved: originalOpen.operationListeners === 0
      ? originalStillDeliverable.operation === 0
      : completionEnd.activeOperationListeners === 0,
    completionNoExtraPromptDispatch: countDelta(completionEnd, completionBefore, 'sent', 'prompt:resolve') === 1,
    completionNoExtraThreadCreate: countDelta(completionEnd, completionBefore, 'sent', 'thread:open-assistant') === 1,
    createHeldResponses: createWhileHeld.held,
    createDestinationDraftPreserved: createAfter.destinationDraftPreserved,
    // This action subscribes through ws-client's internal onFusionResponse map.
    // The DOM socket listener count below also includes unrelated reconnect,
    // view tree and list subscriptions, so it is observational only. Assert
    // the exact action's late-response effects instead.
    createOperationListenersRemoved: createAfter.activeOperationListeners === 0,
    createNoExtraPromptDispatch: countDelta(createEnd, createWhileHeld, 'sent', 'prompt:resolve') === 0,
    createNoExtraThreadCreate: countDelta(createEnd, createWhileHeld, 'sent', 'thread:open-assistant') === 0,
    createOriginalTargetOutcome: createOriginAfter.outcome,
    createVisibleClaimConsistent: createOriginAfter.visibleClaimConsistent,
    createServerGroupPreserved,
    createCancelledGroupClean,
    requestErrorSettledOnce: terminalError.completions === 1 && terminalError.result?.status === 'failed'
      && countDelta(afterError, terminalBefore, 'sent', 'thread:open-assistant') === 0,
    promptTimeoutSettledOnce: terminalTimeout.completions === 1 && terminalTimeout.result?.status === 'cancelled'
      && countDelta(terminalEnd, afterError, 'sent', 'thread:open-assistant') === 0,
    contentRecorded: false,
  };
}

try {
  fixture = await stageAndLaunch({ repoRoot, tempRoot, token, casePrefix: 'r5-r6', evidenceRoot, initScript: listenerBootstrap });
  const promptRelativePath = 'System_Manager/Prompts/Workspace Manager/Workspace Creation/PROMPT.md';
  const bundledPrompt = path.join(repoRoot, promptRelativePath);
  const stagedPrompt = path.join(fixture.stageRoot, promptRelativePath);
  fs.mkdirSync(path.dirname(stagedPrompt), { recursive: true });
  fs.copyFileSync(bundledPrompt, stagedPrompt);
  const stagedPromptSha256 = crypto.createHash('sha256').update(fs.readFileSync(stagedPrompt)).digest('hex');
  runtime = await fixture.launch();
  await createProject(runtime.app, runtime.page, projectPath, `R5 R6 ${token.slice(-8)}`);
  lingering.push(...await closeOwnedApp(runtime));
  runtime = null;
  const f3 = materializeF3Workspace(projectPath);
  runtime = await fixture.launch();
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });

  const filePanel = await selectPanel(runtime.page, 'file-viewer', 'Files');
  await runtime.page.waitForTimeout(1_500);
  const dockToggle = filePanel.locator('button.rv-file-tree-dock-control').first();
  if (await dockToggle.count()) {
    await dockToggle.click();
    await runtime.page.waitForTimeout(250);
    await filePanel.locator('button.rv-file-tree-dock-control').first().click();
  }
  await waitFor(runtime.page, () => filePanel.locator('button[title="Send folder path to chat"], button[title="Send file path to chat"]').count()
    .then((count) => count > 0), 'file action caller');
  const noTarget = await clickAction(runtime.page, filePanel, 'R5-NO-TARGET-CONSUMER', ['Send file path to chat', 'Send folder path to chat'], 'file-viewer');
  await createChat(runtime.page, fixture.dbPath, 'file-viewer', 'Files');
  const fileResult = await clickAction(runtime.page, filePanel, 'R5-FILE-ACTION', ['Send file path to chat', 'Send folder path to chat'], 'file-viewer');
  const insertedText = 'R5 deterministic cross-surface insertion';
  const fileComposer = filePanel.locator('textarea.rv-chat-input');
  await fileComposer.fill('');
  const insertStartedAt = Date.now();
  await runtime.page.evaluate((text) => window.dispatchEvent(new CustomEvent('fusion:chat-insert', { detail: text })), insertedText);
  await runtime.page.waitForTimeout(300);
  const insertedDraft = await fileComposer.inputValue();
  const textInsert = {
    id: 'R5-TEXT-INSERT', exactDraftMutation: insertedDraft === insertedText,
    elapsedMs: Date.now() - insertStartedAt,
    expectedDraftLength: insertedText.length, observedDraftLength: insertedDraft.length,
    expectedDraftSha256: crypto.createHash('sha256').update(insertedText).digest('hex'),
    observedDraftSha256: crypto.createHash('sha256').update(insertedDraft).digest('hex'),
    visibleFailure: await runtime.page.locator('.rv-toast').filter({ hasText: /fail|unavailable|not available|target/i }).count() > 0,
    contentRecorded: false,
  };
  await fileComposer.fill('');

  const wikiPanel = await selectPanel(runtime.page, 'wiki-viewer', 'Wiki');
  await runtime.page.waitForTimeout(1_500);
  await createChat(runtime.page, fixture.dbPath, 'wiki-viewer', 'Wiki');
  const wikiResult = await clickAction(runtime.page, wikiPanel, 'R5-WIKI-ACTION', ['Send article path to chat', 'Send wiki guide path to chat', 'Send page path to chat'], 'wiki-viewer');

  const sourceSwitchBefore = await runtime.page.evaluate(() => ({ ...window.__chatArchActions.sentTypes }));
  await selectPanel(runtime.page, 'file-viewer', 'Files');
  for (const remove of await filePanel.locator('.rv-chat-attachment-pill-remove').all()) await remove.click();
  const sourceButton = await firstVisibleAction(filePanel, ['Send file path to chat', 'Send folder path to chat']);
  assert.ok(sourceButton);
  const sourceEventIndex = await runtime.page.evaluate(() => window.__chatArchActions.actionEvents.length);
  const filePillsBefore = await filePanel.locator('.rv-chat-attachment-pill').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
  const wikiPillsBefore = await wikiPanel.locator('.rv-chat-attachment-pill').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
  await startActionOrderProbe(runtime.page, sourceEventIndex, filePillsBefore, 'file-viewer');
  await sourceButton.click();
  await selectPanel(runtime.page, 'wiki-viewer', 'Wiki');
  await runtime.page.waitForTimeout(500);
  const wikiPillsAfter = await wikiPanel.locator('.rv-chat-attachment-pill').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
  const sourcePath = await runtime.page.evaluate((index) => window.__chatArchActions.actionEvents[index]?.path || null, sourceEventIndex);
  // The inactive panel can detach its pill DOM. Compare exact identities after
  // returning to the destination: its original Wiki path remains, and the File
  // action's source path never appears there.
  const destinationUnaffected = wikiPillsAfter.some((value) => value && crypto.createHash('sha256').update(value).digest('hex') === wikiResult.deliveredPathSha256)
    && !wikiPillsAfter.includes(sourcePath);
  await selectPanel(runtime.page, 'file-viewer', 'Files');
  const sourceSwitch = { ...await actionSnapshot(runtime.page, filePanel, 'R5-SOURCE-SWITCH', sourceSwitchBefore,
    { expectedPanel: 'file-viewer', eventIndex: sourceEventIndex, beforePills: filePillsBefore }), destinationUnaffected,
    destinationBeforeCount: wikiPillsBefore.length, destinationAfterCount: wikiPillsAfter.length };
  await selectPanel(runtime.page, 'wiki-viewer', 'Wiki');

  const officePanel = await selectPanel(runtime.page, 'office-viewer', 'Drive');
  await runtime.page.waitForTimeout(1_500);
  await createChat(runtime.page, fixture.dbPath, 'office-viewer', 'Office');
  let officeButton = await firstVisibleAction(officePanel, ['Send folder path to chat', 'Send path to chat']);
  if (!officeButton) {
    const folder = officePanel.locator('.rv-office-folder-card').filter({ hasText: /fixture/i }).first();
    await folder.waitFor({ state: 'visible', timeout: 15_000 });
    await folder.click();
    await runtime.page.waitForTimeout(500);
  }
  const officeResult = await clickAction(runtime.page, officePanel, 'R5-OFFICE-ACTION', ['Send folder path to chat', 'Send path to chat'], 'office-viewer');

  if (caseFocus === 'r5-current') {
    const receivedTypes = await runtime.page.evaluate(() => ({ ...window.__chatArchActions.receivedTypes }));
    result = {
      status: 'passed', authenticatedShell: (receivedTypes['shell-auth:authenticated'] || 0) >= 1,
      publicRouteResults: [noTarget, fileResult, textInsert, wikiResult, officeResult, sourceSwitch],
      fixtures: { f3: { id: f3.id, counts: f3.counts, totalContentBytes: f3.totalContentBytes, manifestHash: f3.manifestHash } },
    };
    assert.equal(result.authenticatedShell, true);
    if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') {
      assert.equal(noTarget.visibleFailure, true, 'no-target caller did not show a visible not-sent result');
      assert.equal(noTarget.successToastClaimed, false, 'no-target caller falsely claimed success');
      for (const item of [fileResult, wikiResult, officeResult, sourceSwitch]) {
        assert.equal(item.sourcePanelMatches, true, `${item.id} did not originate in its source view`);
        assert.equal(item.sourcePathFixtureContained, true, `${item.id} escaped the disposable fixture`);
        assert.equal(item.exactSourceAttachmentApplied, true, `${item.id} did not attach its exact source path to source chat`);
        assert.equal(item.orderingObserverSupported, true, `${item.id} had no result/success ordering observer`);
        assert.equal(item.resultBeforeSuccess, true, `${item.id} claimed success before the exact source result was applied`);
        assert.ok(item.targetThreadId, `${item.id} had no target session`);
      }
      assert.equal(sourceSwitch.destinationUnaffected, true, 'view switch redirected the source action');
      assert.equal(textInsert.exactDraftMutation, true, 'cross-surface insert did not change exact draft');
    }
  } else {
  const systemPanel = await selectPanel(runtime.page, 'system-viewer', 'System');
  const beforeSystem = await runtime.page.evaluate(() => ({ ...window.__chatArchActions.sentTypes }));
  await systemPanel.locator('.rv-system-new-workspace').click();
  await systemPanel.getByLabel('Workspace source').getByText('New Folder').click();
  await systemPanel.locator('#rv-system-new-name').fill('R5 Synthetic Workspace');
  await systemPanel.getByRole('button', { name: 'Create', exact: true }).click();
  await runtime.page.waitForTimeout(500);
  const systemResult = {
    id: 'R5-SYSTEM-PROMPT-NEW', entryPointAvailable: true,
    wrongWorkspaceTarget: true,
    visibleFailure: await runtime.page.locator('.rv-toast').filter({ hasText: /fail|unavailable|not available|target/i }).count() > 0,
    overlayStillOpen: await systemPanel.locator('.rv-system-new-overlay').isVisible(),
    outgoingDelta: await runtime.page.evaluate((before) => {
      const delta = {}; for (const [type, count] of Object.entries(window.__chatArchActions.sentTypes)) delta[type] = count - (before[type] || 0); return delta;
    }, beforeSystem),
  };

  await systemPanel.locator('button[aria-label="Close new workspace overlay"]').click();
  fs.mkdirSync(path.dirname(systemPath), { recursive: true });
  await createProject(runtime.app, runtime.page, systemPath, 'R5 System Fixture');
  const systemRegistry = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) =>
    db.prepare('SELECT id, repo_path FROM workspaces WHERE id = ?').get('system-files'));
  assert.equal(systemRegistry?.id, 'system-files', 'disposable public Create Project did not register system-files');
  assert.equal(fs.realpathSync(systemRegistry.repo_path), fs.realpathSync(systemPath));
  lingering.push(...await closeOwnedApp(runtime));
  runtime = null;
  const systemViewRelative = 'ai/RC-MacAir-15/System/Views/010-system-viewer';
  fs.cpSync(path.join(projectPath, systemViewRelative), path.join(systemPath, systemViewRelative), { recursive: true });
  const copiedSystemManifest = path.join(systemPath, systemViewRelative, 'manifest.md');
  assert.equal(fs.readFileSync(copiedSystemManifest, 'utf8'),
    fs.readFileSync(path.join(projectPath, systemViewRelative, 'manifest.md'), 'utf8'),
    'disposable System capsule did not match F3 fixture source');
  runtime = await fixture.launch();
  const systemReady = async () => runtime.page.evaluate(() => {
    const state = window.__chatArchActions;
    const frames = state.projectionFrames.filter((frame) => frame.workspaceId === 'system-files');
    return frames.some((frame) => !frame.unavailable && frame.viewIds.includes('system-viewer'))
      && document.querySelector('.rv-tool-btn[title="System"]') !== null
      && document.querySelector('.rv-workspace-name')?.textContent?.includes('R5 System Fixture')
      && document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-workspace-id') === 'system-files';
  });
  const systemSnapshot = async () => runtime.page.evaluate(() => ({
    workspaceLabel: document.querySelector('.rv-workspace-name')?.textContent || null,
    chatWorkspaceId: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-workspace-id') || null,
    connected: document.body?.innerText.includes('Connected') || false,
    projectionFrames: window.__chatArchActions.projectionFrames.filter((frame) => frame.workspaceId === 'system-files'),
    railTitles: [...document.querySelectorAll('.rv-tool-btn')].map((button) => button.getAttribute('title')),
  }));
  systemSetupReadiness = { id: 'R5-SYSTEM-FIXTURE-READINESS', sourceCapsuleVerified: true,
    boundedRebind: false, initial: null, final: null };
  try {
    await waitFor(runtime.page, systemReady, 'System fixture server projection and renderer rail', 12_000);
  } catch {
    systemSetupReadiness.initial = await systemSnapshot();
    // A new capsule was installed while this disposable workspace was offline.
    // Rebind once through the public workspace menu to request a fresh server
    // projection and renderer discovery; do not retry activation blindly.
    systemSetupReadiness.boundedRebind = true;
    await clickWorkspaceMenu(runtime.app, `R5 R6 ${token.slice(-8)}`);
    await runtime.page.waitForFunction((label) =>
      document.querySelector('.rv-workspace-name')?.textContent?.includes(label), `R5 R6 ${token.slice(-8)}`, { timeout: 15_000 });
    await clickWorkspaceMenu(runtime.app, 'R5 System Fixture');
    await waitFor(runtime.page, systemReady, 'System fixture projection after one public rebind', 12_000);
  }
  systemSetupReadiness.final = await systemSnapshot();
  assert.equal(systemSetupReadiness.final.workspaceLabel.includes('R5 System Fixture'), true);
  const activeSystemPanel = await selectReadySystemPanel(runtime.page);
  const systemSuccessBefore = await runtime.page.evaluate(() => ({sent:{...window.__chatArchActions.sentTypes},
    received:{...window.__chatArchActions.receivedTypes},events:window.__chatArchActions.actionEvents.length,
    frames:window.__chatArchActions.sentFrames.length,
    originThreadId:document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') || null}));
  systemAttemptBaseline = systemSuccessBefore;
  await runtime.page.evaluate((before) => {
    window.__chatArchActions.lastResolvedCommand = null;
    const observation = window.__chatArchSystemResultTiming = {
      sequence: 0, resultSequence: null, successSequence: null, sameBatch: false,
      sawResult: false, sawSuccess: false,
    };
    const resultReady = () => {
      const state = window.__chatArchActions;
      const received = (type) => (state.receivedTypes[type] || 0) - (before.received[type] || 0);
      const draft = document.querySelector('.rv-panel.active textarea.rv-chat-input');
      const target = document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id');
      return received('prompt:resolved') > 0 && received('thread:opened') > 0
        && typeof state.lastResolvedCommand === 'string' && state.lastResolvedCommand.length > 0
        && draft?.value === state.lastResolvedCommand && Boolean(target) && target !== before.originThreadId;
    };
    observation.process = (records) => {
      if (records.length === 0) return;
      let successInBatch = false;
      for (const record of records) {
        const nodes = record.type === 'childList' ? [...record.addedNodes] : [record.target];
        for (const node of nodes) {
          const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
          if (!element) continue;
          const toasts = [element.closest('.rv-toast'), ...element.querySelectorAll('.rv-toast')].filter(Boolean);
          if (toasts.some((toast) => /created|sent|ready|success/i.test(toast.textContent || ''))) successInBatch = true;
        }
      }
      if (successInBatch) {
        observation.sawSuccess = true;
        if (observation.successSequence === null) observation.successSequence = ++observation.sequence;
      }
      if (resultReady()) {
        observation.sawResult = true;
        if (successInBatch && observation.resultSequence === null) observation.sameBatch = true;
        if (observation.resultSequence === null) observation.resultSequence = ++observation.sequence;
      }
    };
    observation.observer = new MutationObserver(observation.process);
    observation.observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['data-chat-thread-id'] });
  }, systemSuccessBefore);
  await activeSystemPanel.locator('.rv-system-new-workspace').click();
  await activeSystemPanel.getByRole('radio', { name: 'New Folder' }).check();
  await activeSystemPanel.locator('#rv-system-new-name').fill('R5 Synthetic Workspace');
  await activeSystemPanel.getByRole('button', { name: 'Create', exact: true }).click();
  systemAttemptSnapshot = await runtime.page.evaluate((before) => {
    const state = window.__chatArchActions;
    const delta = (counts, prior) => Object.fromEntries(Object.entries(counts)
      .map(([type, count]) => [type, count - (prior[type] || 0)]).filter(([, count]) => count > 0));
    return {
      phase: 'after-create-click',
      radio: [...document.querySelectorAll('.rv-panel.active input[name="rv-system-workspace-mode"]')]
        .map((input) => ({ value: input.closest('label')?.textContent?.trim() || null, checked: input.checked })),
      name: document.querySelector('.rv-panel.active #rv-system-new-name')?.value || null,
      selectedFolder: document.querySelector('.rv-panel.active .rv-system-new-selected-folder')?.textContent?.trim() || null,
      overlay: !!document.querySelector('.rv-panel.active .rv-system-new-overlay'),
      actionEvents: state.actionEvents.slice(before.events),
      sentFrames: state.sentFrames.slice(before.frames)
        .filter((frame) => ['prompt:resolve', 'thread:open-assistant', 'thread:open'].includes(frame.type)),
      sentDelta: delta(state.sentTypes, before.sent),
      receivedDelta: delta(state.receivedTypes, before.received),
      errorFrames: state.errorFrames.slice(-8),
      toast: [...document.querySelectorAll('.rv-toast')].at(-1)?.textContent?.trim() || null,
      activeThreadId: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') || null,
      chatWorkspaceId: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-workspace-id') || null,
      workspaceLabel: document.querySelector('.rv-workspace-name')?.textContent?.trim() || null,
      resolvedCommandObserved: typeof state.lastResolvedCommand === 'string' && state.lastResolvedCommand.length > 0,
    };
  }, systemSuccessBefore);
  await waitFor(runtime.page, () => runtime.page.evaluate(() => {
    const state = window.__chatArchActions;
    const target = document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id');
    const draft = document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value;
    return !document.querySelector('.rv-panel.active .rv-system-new-overlay')
      && Boolean(target) && typeof state.lastResolvedCommand === 'string'
      && state.lastResolvedCommand.length > 0 && draft === state.lastResolvedCommand;
  }), 'System prompt/new applied and overlay closed', 20_000);
  const timing = await runtime.page.evaluate(() => {
    const observation = window.__chatArchSystemResultTiming;
    observation.process(observation.observer.takeRecords());
    observation.observer.disconnect();
    return { resultSequence: observation.resultSequence, successSequence: observation.successSequence,
      sameBatch: observation.sameBatch, sawResult: observation.sawResult, sawSuccess: observation.sawSuccess };
  });
  const systemSuccess = await runtime.page.evaluate((before) => {
    const state = window.__chatArchActions;
    const sentDelta = (name) => (state.sentTypes[name] || 0) - (before.sent[name] || 0);
    const receivedDelta = (name) => (state.receivedTypes[name] || 0) - (before.received[name] || 0);
    const event = state.actionEvents[before.events];
    const text = document.querySelector('.rv-panel.active textarea.rv-chat-input')?.value || '';
    const toast = [...document.querySelectorAll('.rv-toast')].at(-1)?.textContent || '';
    return { id:'R5-SYSTEM-PROMPT-NEW-SUCCESS', promptActionEmitted:event?.promptId==='workspace-manager.workspace-creation'
      && event.target==='new' && event.delivery==='insert', promptResolveSent:sentDelta('prompt:resolve'),
      promptResolved:receivedDelta('prompt:resolved'), threadOpenSent:sentDelta('thread:open-assistant'),
      threadOpened:receivedDelta('thread:opened'), draftLength:text.length,
      exactResolvedDraft:typeof state.lastResolvedCommand === 'string' && state.lastResolvedCommand.length > 0
        && text === state.lastResolvedCommand,
      targetThreadId:document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') || null,
      successToastClaimed:/created|sent|ready|success/i.test(toast),
      visibleFailure:/fail|unavailable|not available|not sent/i.test(toast),
      overlayStillOpen:document.querySelector('.rv-panel.active .rv-system-new-overlay') != null,
      contentRecorded:false};
  }, systemSuccessBefore);
  systemSuccess.authenticatedSystemWorkspace = systemRegistry.id === 'system-files';
  systemSuccess.systemSetupBoundedRebind = systemSetupReadiness.boundedRebind;
  systemSuccess.stagedPromptSha256 = stagedPromptSha256;
  systemSuccess.newTarget = Boolean(systemSuccess.targetThreadId)
    && systemSuccess.targetThreadId !== systemSuccessBefore.originThreadId;
  systemSuccess.commandResultApplied = systemSuccess.promptResolved > 0 && systemSuccess.threadOpened > 0
    && systemSuccess.exactResolvedDraft && systemSuccess.newTarget
    && timing.sawResult && timing.resultSequence !== null;
  systemSuccess.resultObservedBeforeSuccess = timing.successSequence === null
    || (timing.resultSequence !== null && !timing.sameBatch && timing.resultSequence < timing.successSequence);
  systemSuccess.resultMutationSequence = timing.resultSequence;
  systemSuccess.successMutationSequence = timing.successSequence;
  systemSuccess.sameMutationBatch = timing.sameBatch;
  systemSuccess.resultMutationObserved = timing.sawResult;
  systemSuccess.successMutationObserved = timing.sawSuccess;

  const productionOwnerRegistered = await runtime.page.evaluate(() => {
    const state = window.__chatArchActions;
    return state.fusionActionAdds - state.fusionActionRemoves > 0;
  });
  const r6ProductionBoundary = productionOwnerRegistered
    ? await exerciseProductionR6(runtime, `R5 R6 ${token.slice(-8)}`)
    : { id: 'R6-PRODUCTION-ACTION-OWNER', status: 'blocked_missing_consumer',
      reason: 'authenticated production view-bound host registered no fusion:chat-action consumer',
      laterOwner: 'SPEC-03/03B', sourceOnlyLegacyHazard: 'R6-LIFETIME-BOUNDARIES', contentRecorded: false };

  const listeners = await runtime.page.evaluate(() => {
    const state = window.__chatArchActions;
    return { sentTypes: { ...state.sentTypes }, receivedTypes: { ...state.receivedTypes },
      fusionActionAdds: state.fusionActionAdds, fusionActionRemoves: state.fusionActionRemoves,
      socketMessageAdds: state.socketMessageAdds, socketMessageRemoves: state.socketMessageRemoves,
      actionEvents: state.actionEvents.slice(), listenerBalance: state.socketMessageAdds - state.socketMessageRemoves };
  });
  const publicResults = [noTarget, fileResult, textInsert, wikiResult, officeResult, sourceSwitch, systemResult, systemSuccess];
  const falseSuccess = publicResults.filter((item) => item.successToastClaimed && item.attachmentPills === 0).map((item) => item.id);
  const reproducedDefects = falseSuccess.map((id) => `${id}: success toast without target attachment/result`);
  if (!textInsert.exactDraftMutation) reproducedDefects.push('R5-TEXT-INSERT: production fusion:chat-insert has no active consumer/draft mutation');
  if (!textInsert.exactDraftMutation && !textInsert.visibleFailure) reproducedDefects.push('R5-TEXT-INSERT: missing consumer has no visible failure');
  if (!systemResult.visibleFailure) reproducedDefects.push('R5-SYSTEM-PROMPT-NEW: unavailable system target has no visible failure');
  if (!systemSuccess.commandResultApplied) reproducedDefects.push('R5-SYSTEM-PROMPT-NEW-SUCCESS: connected disposable System caller produced no prompt/new-chat command result');
  if (!systemSuccess.resultObservedBeforeSuccess) reproducedDefects.push('R5-SYSTEM-PROMPT-NEW-SUCCESS: success notification preceded command result');
  result = {
    status: 'passed', characterization: true, startupPanelReadiness: 'exact-rail-before-activation', systemSetupReadiness,
    authenticatedShell: (listeners.receivedTypes['shell-auth:authenticated'] || 0) >= 1,
    publicRouteResults: publicResults,
    fixtures: {
      f3: { id: f3.id, counts: f3.counts, totalContentBytes: f3.totalContentBytes, manifestHash: f3.manifestHash },
    },
    r5Classification: reproducedDefects.length ? 'confirmed-current-product-violation' : 'observed-no-false-success',
    reproducedDefects,
    r6ProductionBoundary: { ...r6ProductionBoundary, listeners,
      classification: r6ProductionBoundary.status === 'blocked_missing_consumer'
        ? 'public-route-R6-blocked-missing-consumer; Legacy listener finding source-only'
        : 'authenticated-production-action-owner-lifetime-executed',
      laterOwner: 'SPEC-03/03B' },
  };
  assert.equal(result.authenticatedShell, true);
  if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') {
    if (r6ProductionBoundary.status === 'executed') {
      for (const key of ['promptAwaiting', 'promptNoStaleCreate', 'promptDestinationDraftPreserved',
        'promptNoExtraPromptDispatch', 'promptOriginThreadPreserved', 'promptOriginDraftPreserved',
        'promptNoVisibleSuccess', 'competingFrameReceived', 'competingDidNotConsumeOriginal',
        'competingTargetPreserved', 'competingDraftPreserved', 'completionExactThread', 'completionDraftPresent',
        'completionExactDraft',
        'completionNoExtraPromptDispatch', 'completionNoExtraThreadCreate', 'createDestinationDraftPreserved',
        'createNoExtraPromptDispatch', 'createNoExtraThreadCreate', 'createVisibleClaimConsistent',
        'createServerGroupPreserved', 'createCancelledGroupClean']) {
        assert.equal(r6ProductionBoundary[key], true, `R6 production action owner failed ${key}`);
      }
      assert.equal(r6ProductionBoundary.requestErrorSettledOnce, true,
        'R6 correlated prompt error did not settle once without creation');
      assert.equal(r6ProductionBoundary.promptTimeoutSettledOnce, true,
        'R6 prompt timeout did not cancel once without stale creation');
      assert.ok(r6ProductionBoundary.promptHeldResponses > 0);
      assert.ok(r6ProductionBoundary.competingHeldResponses > 0);
      assert.ok(r6ProductionBoundary.createHeldResponses > 0);
      assert.ok(['cancelled', 'completed-at-original-target'].includes(r6ProductionBoundary.createOriginalTargetOutcome),
        'R6 original System target has neither a cancelled nor exact completed outcome');
    }
    if (caseFocus !== 'r6-owner' && caseFocus !== 'r6-lifetime') {
    assert.equal(noTarget.visibleFailure, true, 'no-target caller did not show a visible not-sent result');
    assert.equal(noTarget.successToastClaimed, false, 'no-target caller falsely claimed success');
    for (const item of [fileResult, wikiResult, officeResult, sourceSwitch]) {
      assert.equal(item.sourcePanelMatches, true, `${item.id} did not originate in its source view`);
      assert.equal(item.sourcePathFixtureContained, true, `${item.id} escaped the disposable fixture`);
      assert.equal(item.exactSourceAttachmentApplied, true, `${item.id} did not attach its exact source path to source chat`);
      assert.equal(item.orderingObserverSupported, true, `${item.id} had no result/success ordering observer`);
      assert.equal(item.resultBeforeSuccess, true, `${item.id} claimed success before the exact source result was applied`);
      assert.ok(item.targetThreadId, `${item.id} had no target session`);
    }
    assert.equal(sourceSwitch.destinationUnaffected, true, 'view switch redirected the source action into the later active chat');
    assert.equal(systemResult.visibleFailure, true, 'unavailable System target did not show a visible failure');
    assert.equal(systemSuccess.authenticatedSystemWorkspace, true);
    assert.equal(systemSuccess.promptActionEmitted, true, 'SystemViewer did not dispatch its prompt-based new-chat action');
    assert.equal(systemSuccess.commandResultApplied, true, 'System prompt/new-chat command had no actual target draft/result');
    assert.equal(systemSuccess.overlayStillOpen, false, 'System new-chat overlay remained after applied completion');
    assert.equal(systemSuccess.resultObservedBeforeSuccess, true, 'System success notification preceded command result');
    assert.equal(textInsert.exactDraftMutation, true);
    }
  }
  }
} catch (error) {
  failure = error;
  if (systemAttemptBaseline && runtime?.page) {
    const atFailure = await runtime.page.evaluate((before) => {
      const state = window.__chatArchActions;
      const delta = (counts, prior) => Object.fromEntries(Object.entries(counts)
        .map(([type, count]) => [type, count - (prior[type] || 0)]).filter(([, count]) => count > 0));
      return {
        phase: 'failure',
        radio: [...document.querySelectorAll('.rv-panel.active input[name="rv-system-workspace-mode"]')]
          .map((input) => ({ value: input.closest('label')?.textContent?.trim() || null, checked: input.checked })),
        name: document.querySelector('.rv-panel.active #rv-system-new-name')?.value || null,
        selectedFolder: document.querySelector('.rv-panel.active .rv-system-new-selected-folder')?.textContent?.trim() || null,
        overlay: !!document.querySelector('.rv-panel.active .rv-system-new-overlay'),
        actionEvents: state.actionEvents.slice(before.events),
        sentFrames: state.sentFrames.slice(before.frames)
          .filter((frame) => ['prompt:resolve', 'thread:open-assistant', 'thread:open'].includes(frame.type)),
        sentDelta: delta(state.sentTypes, before.sent),
        receivedDelta: delta(state.receivedTypes, before.received),
        errorFrames: state.errorFrames.slice(-8),
        toast: [...document.querySelectorAll('.rv-toast')].at(-1)?.textContent?.trim() || null,
        activeThreadId: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-thread-id') || null,
        chatWorkspaceId: document.querySelector('.rv-panel.active .rv-chat-area')?.getAttribute('data-chat-workspace-id') || null,
        workspaceLabel: document.querySelector('.rv-workspace-name')?.textContent?.trim() || null,
        resolvedCommandObserved: typeof state.lastResolvedCommand === 'string' && state.lastResolvedCommand.length > 0,
      };
    }, systemAttemptBaseline).catch(() => null);
    systemAttemptSnapshot = { afterClick: systemAttemptSnapshot, atFailure };
  }
  if (runtime?.page) await runtime.page.screenshot({ path: path.join(evidenceRoot, 'r5-r6-failure.png'), fullPage: true }).catch(() => {});
} finally {
  if (runtime) lingering.push(...await closeOwnedApp(runtime));
  const cleanup = fixture ? cleanupFixture(fixture, token) : null;
  fs.writeFileSync(resultPath, `${JSON.stringify({ ...result, systemSetupReadiness, systemAttemptSnapshot, cleanup: { lingering, ...cleanup },
    failure: failure ? { name: failure.name, message: failure.message, stack: failure.stack } : null }, null, 2)}\n`);
}

assert.deepEqual(lingering, []);
if (failure) throw failure;
process.stdout.write('CHAT_ARCH_R5_R6_OK\n');
