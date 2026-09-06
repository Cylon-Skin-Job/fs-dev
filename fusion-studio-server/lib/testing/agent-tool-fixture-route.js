'use strict';

const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { OpenCodeJsonEventTranslator } = require('../harness/opencode/json-event-translator');
const { getSharedAgentActivityOwner } = require('../agent-provenance/activity-owner');
const { createAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');
const ThreadWebSocketHandler = require('../thread/ThreadWebSocketHandler');

const FIXTURE_TYPE = 'provenance:test:agent_tool';
const FIXTURE_VERSION = 1;
const FIXTURES = Object.freeze({
  'edit-first-a': Object.freeze({
    callId: 'fixture-edit-first-a', nativeTool: 'edit', status: 'completed',
    path: 'target/live.txt', mutation: 'write', content: 'agent state A Ω\n',
    start: 1_800_000_000_101, end: 1_800_000_000_202, envelope: 1_800_000_000_303,
  }),
  'edit-return-a': Object.freeze({
    callId: 'fixture-edit-return-a', nativeTool: 'edit', status: 'completed',
    path: 'target/live.txt', mutation: 'write', content: 'agent state A Ω\n',
    start: 1_800_000_001_101, end: 1_800_000_001_202, envelope: 1_800_000_001_303,
  }),
  'read-a': Object.freeze({
    callId: 'fixture-read-a', nativeTool: 'read', status: 'completed',
    path: 'target/live.txt', mutation: 'none',
    start: 1_800_000_002_101, end: 1_800_000_002_202, envelope: 1_800_000_002_303,
  }),
  'error-partial': Object.freeze({
    callId: 'fixture-error-partial', nativeTool: 'edit', status: 'error',
    path: 'target/live.txt', mutation: 'write', content: 'partial error state ε\n',
    start: 1_800_000_003_101, end: 1_800_000_003_202, envelope: 1_800_000_003_303,
  }),
  'interrupt-partial': Object.freeze({
    callId: 'fixture-interrupt-partial', nativeTool: 'edit', status: 'interrupted', providerStatus: 'running',
    path: 'target/live.txt', mutation: 'write', content: 'partial interrupted state ι\n',
    start: 1_800_000_004_101, end: null, envelope: 1_800_000_004_303,
  }),
  'read-absent-first': Object.freeze({
    callId: 'fixture-read-absent-first', nativeTool: 'read', status: 'completed',
    path: 'target/absent.txt', mutation: 'delete',
    start: 1_800_000_005_101, end: 1_800_000_005_202, envelope: 1_800_000_005_303,
  }),
  'read-absent-unchanged': Object.freeze({
    callId: 'fixture-read-absent-unchanged', nativeTool: 'read', status: 'completed',
    path: 'target/absent.txt', mutation: 'delete',
    start: 1_800_000_006_101, end: 1_800_000_006_202, envelope: 1_800_000_006_303,
  }),
});

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}

function createEnvelope(fixture) {
  return {
    type: 'tool_use',
    timestamp: fixture.envelope,
    part: {
      type: 'tool',
      id: `part-${fixture.callId}`,
      callID: fixture.callId,
      tool: fixture.nativeTool,
      state: {
        status: fixture.providerStatus || fixture.status,
        input: { filePath: fixture.path },
        time: { start: fixture.start, end: fixture.end },
        output: fixture.status === 'error' ? 'fixture reported error' : 'fixture completed',
        metadata: { exit: fixture.status === 'error' ? 1 : 0 },
      },
    },
  };
}

async function applyMutation(workspaceRoot, fixture) {
  const target = path.join(workspaceRoot, ...fixture.path.split('/'));
  const relative = path.relative(workspaceRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('fixture target escaped its owned workspace');
  }
  if (fixture.mutation === 'write') {
    await fs.writeFile(target, fixture.content, { encoding: 'utf8', flag: 'w' });
  } else if (fixture.mutation === 'delete') {
    try { await fs.unlink(target); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

function createAgentToolFixtureRoute({ db, enabled, nonce }) {
  if (!enabled) return null;
  if (!db || typeof db !== 'function') throw new TypeError('fixture route requires the isolated database');
  if (typeof nonce !== 'string' || !/^[0-9a-f-]{36}$/u.test(nonce)) {
    throw new TypeError('fixture route requires the isolated ownership nonce');
  }
  const activeSessions = new WeakSet();

  async function ensureThread(ws, session) {
    let threadId = ThreadWebSocketHandler.getCurrentThreadId(ws);
    if (!threadId) {
      await ThreadWebSocketHandler.handleThreadOpenAssistant(ws, {
        name: 'Agent provenance isolated fixture',
        harnessId: 'opencode',
      });
      threadId = ThreadWebSocketHandler.getCurrentThreadId(ws);
    }
    if (!threadId) throw new Error('fixture thread could not be established');
    session.currentThreadId = threadId;
    session.currentScope = 'project';
    session.currentViewId = null;
    return threadId;
  }

  async function handle({ ws, session, message, handleCanonicalHarnessEvent }) {
    if (!exactKeys(message, ['type', 'version', 'requestId', 'nonce', 'fixture'])) {
      throw new TypeError('agent tool fixture request is invalid');
    }
    if (message.type !== FIXTURE_TYPE || message.version !== FIXTURE_VERSION
      || message.nonce !== nonce || typeof message.requestId !== 'string'
      || !/^[a-z0-9-]{1,64}$/u.test(message.requestId)) {
      throw new TypeError('agent tool fixture request is invalid');
    }
    const fixture = FIXTURES[message.fixture];
    if (!fixture) throw new TypeError('agent tool fixture is not allowlisted');
    if (activeSessions.has(session)) throw new Error('agent tool fixture session is busy');
    if (typeof handleCanonicalHarnessEvent !== 'function'
      || typeof handleCanonicalHarnessEvent.finalizeTurn !== 'function') {
      throw new Error('canonical harness fixture boundary is unavailable');
    }
    if (typeof session.currentWorkspaceId !== 'string' || !session.currentWorkspaceId
      || typeof session.projectRoot !== 'string' || !path.isAbsolute(session.projectRoot)) {
      throw new Error('agent tool fixture workspace is unavailable');
    }

    activeSessions.add(session);
    try {
      const threadId = await ensureThread(ws, session);
      const turnId = randomUUID();
      const authority = await createAgentTurnAuthorityRef({
        workspaceId: session.currentWorkspaceId,
        threadId,
        turnId,
        harnessId: 'opencode',
        provider: 'opencode',
        workspaceRoot: session.projectRoot,
      });
      session.pendingAgentTurnAuthority = authority;
      session.pendingTurnId = turnId;
      session.pendingUserInput = `isolated fixture ${message.fixture}`;
      session.pendingAttachments = [];
      const translator = new OpenCodeJsonEventTranslator();
      await handleCanonicalHarnessEvent(translator.beginTurn(session.pendingUserInput), ws);
      await applyMutation(authority.canonicalRoot, fixture);
      const events = translator.translate(createEnvelope(fixture));

      if (fixture.status === 'interrupted') {
        if (events.length !== 2 || events[0].type !== 'tool_call' || events[1].type !== 'tool_call_args') {
          throw new Error('OpenCode interruption fixture did not produce incremental tool events');
        }
        // Production terminal capture is snapshot-owned. The isolated fixture
        // explicitly seeds its translated in-flight OpenCode call so the real
        // shared turn finalizer can exercise the no-terminal interruption path.
        const activityOwner = getSharedAgentActivityOwner({ db });
        await activityOwner.announce(authority, {
          ...events[0],
          nativeToolName: fixture.nativeTool,
          harnessId: 'opencode',
          provider: 'opencode',
        });
        await activityOwner.acceptArguments(authority, {
          ...events[1],
          hasCompleteArgs: true,
          completeArgs: { filePath: fixture.path },
        });
        for (const event of events) await handleCanonicalHarnessEvent(event, ws);
        await handleCanonicalHarnessEvent.finalizeTurn({
          type: 'turn_end', observedAt: Date.now(), timestamp: Date.now(),
          timestampSource: 'host_observed', reason: 'interrupted', partial: true,
          finalizationSource: 'isolated_fixture',
        }, ws, authority);
      } else {
        if (events.length !== 1 || events[0].type !== 'tool_snapshot') {
          throw new Error('OpenCode fixture did not produce one terminal snapshot');
        }
        await handleCanonicalHarnessEvent(events[0], ws);
        await handleCanonicalHarnessEvent({
          type: 'content', observedAt: Date.now(), timestamp: Date.now(),
          timestampSource: 'host_observed', text: 'fixture complete',
        }, ws);
        await handleCanonicalHarnessEvent({
          type: 'turn_end', observedAt: Date.now(), timestamp: Date.now(),
          timestampSource: 'host_observed', reason: 'complete', partial: false,
          finalizationSource: 'isolated_fixture',
        }, ws);
      }

      ws.send(JSON.stringify({
        type: 'provenance:test:agent_tool_result', version: 1,
        requestId: message.requestId, fixture: message.fixture,
        workspaceId: authority.workspaceId, threadId, turnId,
        toolCallId: fixture.callId,
      }));
    } finally {
      activeSessions.delete(session);
    }
  }

  return Object.freeze({ handle });
}

module.exports = { FIXTURE_TYPE, FIXTURE_VERSION, FIXTURES, createAgentToolFixtureRoute };
