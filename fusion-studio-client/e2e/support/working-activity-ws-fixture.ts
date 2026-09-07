/**
 * @module e2e/support/working-activity-ws-fixture
 * @role Deterministic WebSocket routing/proxy fixture owning SPEC-04's
 *       @routing/@frontier browser cases (SPEC-04 §3 Slice D item 2).
 *
 * DESIGN
 * Built on Playwright's native WebSocket routing (`page.routeWebSocket`) —
 * NO product-visible hooks and NO global tampering in the renderer: the app
 * boots its real connect/reconnect/log path unchanged against the dev
 * server while this module sits BETWEEN socket peers (see header of the old
 * prototype patch attempts in git history — routing beats constructor
 * swapping because server-pushed `thread:list` broadcasts around
 * workspace:init made one-directional interception nondeterministic).
 *
 * One chokepoint per direction:
 *   - APP → SERVER: chat-domain REQUEST types in INTERCEPTED_REQUEST_TYPES
 *     never reach the network; they are answered from a per-scenario table
 *     (`setReplies`, seeded before navigation so it wins every startup race)
 *     or swallowed silently (documented silence-not-error semantics).
 *   - SERVER → APP: every frame passes verbatim EXCEPT unsolicited
 *     `thread:list` broadcasts, which the dev server pushes with EMPTY/real
 *     DB contents and which would otherwise clobber scenario state at
 *     nondeterministic moments.
 * Scenario-authored downstream frames enter through `push()` in exact order;
 * raw intercepted requests are recorded by `sentFrames()`.
 *
 * SHELL DISCOVERY SHIM (outbound, read-only, deterministic): this checkout's
 * real workspace registry has no views.json and its `__panels__`/`__apps__`
 * probes are not filesystem-backed, so panel discovery returns ZERO configs
 * and the packaged shell stays in its "Discovering panels…" loading gate
 * forever — no chat surface renders at all. The fixture answers exactly two
 * discovery probe shapes (`__workspace__/views.json`, empty `__apps__` tree)
 * with one static canned view so the RCC-0095 unconditional chat column /
 * sidebar mount. It also cans the VIEW-STATE family (`state:get`/`state:set`)
 * both directions — see inline note at the interception site; without it,
 * persisted UI state poisons every later boot and lane runs write runtime
 * view state into owner ai/** files. These replies are deliberately NOT
 * logged in sentFrames() and NOT counted by settled(): only scenario-meaningful chat requests count,
 * keeping open-count bookkeeping exact. Everything else on the discovery path
 * (index/content/layout/icon probes) passes through to the real server, whose
 * instant failure replies drive the fast registryFallback config path.
 *
 * TRADE-OFFS
 * - Proxy-over-mock: the packaged client runs for real (config webServer),
 *   proving packaged behavior including ws-client console redaction; cost is
 *   dependence on Playwright's WebSocket-route plumbing.
 * - Silence-not-error for unanswered intercepted requests keeps scenarios
 *   order-independent instead of timing-sensitive.
 * SPEC-05 extends this artifact for @working/@terminal-error without
 * changing its ops surface contract.
 */

import { installTrustedShellBrowserFixture } from './trusted-shell-browser-fixture';

/** Scenario reply table consulted by the intercepting outbound path. */
export interface WaReplyConfig {
  /** Reply served for intercepted `thread:list` requests. */
  list?: { threads: Array<Record<string, unknown>> };
  /** Replies keyed by requested threadId for intercepted `thread:open`. */
  openByThreadId?: Record<string, Record<string, unknown>>;
}

/** Node-side handle returned by installWaFixture. */
export interface WaFixture {
  /** Push one or more downstream server-shaped frames, in exact order. */
  push(frames: unknown | unknown[]): Promise<void>;
  /** Merge-replace parts of the scenario reply table (later wins). */
  setReplies(patch: WaReplyConfig): void;
  /** Drop the whole reply table (intercepted requests become silent). */
  resetReplies(): void;
  /** Parsed copies of every OUTBOUND intercepted frame (oldest first). */
  sentFrames(): Array<Record<string, unknown>>;
  /** Resolves once the app has opened its first routed socket. */
  whenOpen(): Promise<void>;
  /**
   * Resolves after at least `min` scenario replies have been SERVED to the
   * app plus one pump-flush timeout, i.e., every earlier authored answer
   * has definitely been handed to the renderer task queue.
   */
  settled(min: number): Promise<void>;
  /**
   * Resolves once `count` intercepted `thread:open` REQUESTS for `threadId`
   * have been HANDLED (served from the table or silently swallowed), plus
   * one pump-flush timeout. Per-thread barriers stay immune to unrelated
   * background request volume (e.g., boot-time emoji_recents chatter).
   */
  openHandled(threadId: string, count: number): Promise<void>;
}

const INTERCEPTED_REQUEST_TYPES = new Set([
  'thread:list',
  'thread:open',
  'thread:create',
  'thread:warm',
  'prompt',
  'chat-turn:diagnostic:get',
  'clipboard:append',
  'emoji_recents:list',
  'emoji_recents:record',
]);

// ── Shell discovery shim constants (see module header) ────────────────────

/** Single canned view id the fixture's registry serves to unlock the shell. */
const SHELL_VIEW_ID = 'wa-view';

const DISCOVERY_VIEWS_JSON = {
  version: 2,
  views: [{ id: SHELL_VIEW_ID, label: 'WA Shell View', enabled: true }],
};

/**
 * Install the deterministic proxy. Must run BEFORE the first page is
 * created in the context (Chromium WS interception requires the handler be
 * attached ahead of any extant page); drive it via the returned controller.
 */
export async function installWaFixture(
  context: import('@playwright/test').BrowserContext,
  initialReplies?: WaReplyConfig,
): Promise<WaFixture> {
  await installTrustedShellBrowserFixture(context);
  let replies: WaReplyConfig = JSON.parse(
    JSON.stringify(initialReplies ?? {}),
  ) as WaReplyConfig;
  const sentLog: Array<Record<string, unknown>> = [];
  const pendingDownstream: unknown[] = [];
  let notifyOpen: (() => void) | null = null;
  const whenOpen = new Promise<void>((resolve) => { notifyOpen = resolve; });
  let servedCount = 0;
  const servedWaiters: Array<{ min: number; done: () => void }> = [];
  const opensHandledByThread = new Map<string, number>();
  const openWaiters: Array<{ threadId: string; count: number; done: () => void }> = [];
  function notifyServed(): void {
    for (const waiter of [...servedWaiters]) {
      if (servedCount >= waiter.min) {
        servedWaiters.splice(servedWaiters.indexOf(waiter), 1);
        setTimeout(waiter.done, 15); // let the IPC queue drain to the renderer
      }
    }
  }
  /** Count one handled `thread:open` (answered or deliberately silent). */
  function noteOpenHandled(threadId: string): void {
    const next = (opensHandledByThread.get(threadId) ?? 0) + 1;
    opensHandledByThread.set(threadId, next);
    for (const waiter of [...openWaiters]) {
      if (waiter.threadId === threadId && next >= waiter.count) {
        openWaiters.splice(openWaiters.indexOf(waiter), 1);
        setTimeout(waiter.done, 15); // pump-flush to the renderer task queue
      }
    }
  }
  /** Client-side send channel once the app's first socket is routed. */
  let clientSend: ((text: string) => void) | null = null;

  function serveIntercepted(request: Record<string, unknown>): unknown | null {
    const type = String(request.type);
    servedCount += 1;
    notifyServed();
    if (type === 'thread:list') {
      return replies.list
        ? { type: 'thread:list', threads: replies.list.threads }
        : null;
    }
    if (type === 'thread:open') {
      const threadId = typeof request.threadId === 'string' ? request.threadId : '';
      const reply = threadId ? replies.openByThreadId?.[threadId] : undefined;
      // Round-trip so later pushes can never mutate served scenario sources.
      const served = reply ? (JSON.parse(JSON.stringify(reply)) as Record<string, unknown>) : null;
      noteOpenHandled(threadId);
      return served;
    }
    // thread:create / emoji_recents:* stay silently intercepted: canned
    // silence avoids unprompted real-server traffic entirely.
    return null;
  }

  // The test-owned runtime descriptor uses the exact 127.0.0.1 production
  // host, while any browser-tool socket remains on the page's localhost
  // origin. The matched connection is therefore the app channel directly.
  // Installed on the CONTEXT: page-level routeWebSocket does not fire in the
  // current Playwright build, context-level does (verified by probe).
  await context.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+(?:\/.*)?$/, (route) => {
    let isAppSocket = false;
    const downstreamQueue: FramePayload[] = [];

    function becomeAppChannel(): void {
      isAppSocket = true;
      notifyOpen?.();
      clientSend = (text: string): void => route.send(text);
      for (const text of downstreamQueue.splice(0)) route.send(typeof text === 'string' ? text : String(text));
    }

    const server = route.connectToServer();
    becomeAppChannel();

    route.onMessage((message: FramePayload) => {
      const text = typeof message === 'string' ? message : String(message);
      if (!isAppSocket) {
        server.send(text);
        return;
      }
      let parsed: Record<string, unknown> | null = null;
      try {
        const value: unknown = JSON.parse(text);
        if (
          value && typeof value === 'object' &&
          typeof (value as Record<string, unknown>).type === 'string'
        ) {
          parsed = value as Record<string, unknown>;
        }
      } catch { parsed = null; }
      // Shell discovery shim (outbound, precise sub-shapes only — never
      // logged, never counted toward scenario reply bookkeeping).
      if (
        parsed.type === 'file_content_request' &&
        parsed.panel === '__workspace__' &&
        parsed.path === 'views.json'
      ) {
        route.send(JSON.stringify({
          type: 'file_content_response',
          panel: parsed.panel,
          path: parsed.path,
          requestId: parsed.requestId,
          success: true,
          content: JSON.stringify(DISCOVERY_VIEWS_JSON),
        }));
        return;
      }
      if (parsed.type === 'file_tree_request' && parsed.panel === '__apps__') {
        route.send(JSON.stringify({
          type: 'file_tree_response',
          panel: parsed.panel,
          path: '',
          success: true,
          nodes: [],
        }));
        return;
      }
      // VIEW-STATE NEUTRALITY SHIM (outbound): the packaged shell persists
      // per-view UI state through passthrough writes. Once ANY prior session
      // (real or earlier lane run) leaves stale state on disk, later boots
      // hydrate it and the chat lane's post-boot store→DOM updates freeze
      // (observed lane-wide incl. legacy specs — evidence in Slice D run-3
      // log). Canning BOTH directions keeps every scenario independent of
      // whatever UI state persists in the workspace tree and stops the lane
      // from writing runtime view state into owner ai/** files during runs.
      // Mirrors ws-client expectations: state:get/state:set resolve via a
      // full-state `state:result`; set echoes the patch + clientMutationId.
      if (parsed.type === 'state:get') {
        route.send(JSON.stringify({
          type: 'state:result', view: parsed.view ?? '', state: {},
        }));
        return;
      }
      if (parsed.type === 'state:set') {
        route.send(JSON.stringify({
          type: 'state:result',
          view: parsed.view ?? '',
          state: parsed.state ?? {},
          ...(parsed.clientMutationId !== undefined
            ? { clientMutationId: parsed.clientMutationId }
            : {}),
        }));
        return;
      }
      if (parsed && INTERCEPTED_REQUEST_TYPES.has(String(parsed.type))) {
        sentLog.push({ ...parsed });
        const reply = serveIntercepted(parsed);
        if (reply !== null) route.send(JSON.stringify(reply));
        return;
      }
      server.send(text);
    });

    server.onMessage((message: FramePayload) => {
      if (!isAppSocket) {
        route.send(typeof message === 'string' ? message : String(message));
        return;
      }
      const text = typeof message === 'string' ? message : String(message);
      try {
        const value: unknown = JSON.parse(text);
        if (
          value && typeof value === 'object' &&
          String((value as Record<string, unknown>).type) === 'thread:list'
        ) {
          return; // unsolicited real-DB broadcast would clobber scenarios
        }
      } catch { /* non-JSON frames always pass */ }
      route.send(text);
    });

    // Downstream frames pushed before ANY socket existed attach to the app
    // channel the moment it identifies itself.
    downstreamQueue.push(...pendingDownstream.splice(0).map((f) => JSON.stringify(f)));
  });

  return {
    push(frames: unknown | unknown[]): void {
      const list = Array.isArray(frames) ? frames : [frames];
      if (!clientSend) {
        // Before the app's socket exists: buffered, flushed at route setup.
        pendingDownstream.push(...list);
        return;
      }
      for (const frame of list) clientSend(JSON.stringify(frame));
    },
    setReplies(patch: WaReplyConfig): void {
      const next: WaReplyConfig = {
        ...(replies.list ? { list: replies.list } : {}),
        ...(replies.openByThreadId ? { openByThreadId: replies.openByThreadId } : {}),
      };
      if (patch.list !== undefined) next.list = patch.list;
      if (patch.openByThreadId !== undefined) {
        next.openByThreadId = { ...(next.openByThreadId ?? {}), ...patch.openByThreadId };
      }
      replies = next;
    },
    resetReplies(): void {
      replies = {};
    },
    sentFrames(): Array<Record<string, unknown>> {
      return sentLog.map((entry) => ({ ...entry }));
    },
    whenOpen(): Promise<void> {
      return whenOpen;
    },
    settled(min: number): Promise<void> {
      if (servedCount >= min) {
        return new Promise((resolve) => { setTimeout(resolve, 15); });
      }
      return new Promise((resolve) => { servedWaiters.push({ min, done: resolve }); });
    },
    openHandled(threadId: string, count: number): Promise<void> {
      if ((opensHandledByThread.get(threadId) ?? 0) >= count) {
        return new Promise((resolve) => { setTimeout(resolve, 15); });
      }
      return new Promise((resolve) => {
        openWaiters.push({ threadId, count, done: resolve });
      });
    },
  };
}
