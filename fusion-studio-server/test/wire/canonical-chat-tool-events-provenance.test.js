'use strict';

const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
} = require('../../lib/thread/canonical-drain-context');
const {
  createCanonicalChatToolEvents,
} = require('../../lib/wire/canonical-chat-tool-events');

describe('drain-owned terminal tool snapshot persistence', () => {
  const runtimeKey = { workspaceId: 'workspace-a', scope: 'project', threadId: 'thread-a' };

  function setup(checkSettingsBounce = () => null) {
    const control = createCanonicalDrainControl({
      drainId: 'drain-a',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    });
    const route = createCanonicalRouteContext({
      workspaceId: runtimeKey.workspaceId,
      workspace: `workspace:${runtimeKey.workspaceId}`,
      projectRoot: '/tmp/workspace-a',
      scope: runtimeKey.scope,
      threadId: runtimeKey.threadId,
      acceptedUserInput: 'test terminal snapshot',
      attachments: [],
    });
    threadRuntimeManager.claimActiveDrain(runtimeKey, control, route);
    expect(threadRuntimeManager.beginCanonicalTurn(runtimeKey, control.drainId, {
      turnId: 'turn-a',
      userInput: route.acceptedUserInput,
    }).accepted).toBe(true);
    expect(threadRuntimeManager.bindTurnToDrain(runtimeKey, control.drainId, 'turn-a')).toBe(true);
    const handlers = createCanonicalChatToolEvents({ emit: () => {}, checkSettingsBounce });
    handlers.handleToolCall({
      payload: { toolCallId: 'call-a', toolName: 'edit' },
      route,
      control,
    });
    threadRuntimeManager.getActiveDrain(runtimeKey).turn.toolArgsBuffers
      .set('call-a', '{"filePath":"target/live.txt"}');
    return { control, handlers, route };
  }

  beforeEach(() => {
    threadRuntimeManager.runtimes.clear();
  });

  test('persists the exact fingerprinted result and terminal expansion proof', () => {
    const { control, handlers, route } = setup();
    const result = {
      output: 'fixture completed',
      display: [],
      returnedDiff: false,
      isError: false,
      files: [],
    };

    handlers.applyToolOutcome({
      payload: {
        toolCallId: 'call-a',
        toolName: 'edit',
        origin: 'terminal_snapshot',
        result,
      },
      route,
      control,
    });

    expect(threadRuntimeManager.getLiveTurn(runtimeKey).parts[0]).toEqual({
      type: 'tool_call',
      toolCallId: 'call-a',
      name: 'edit',
      arguments: { filePath: 'target/live.txt' },
      result,
      terminalSnapshotExpansionVersion: 1,
      terminalSnapshotExpansionComplete: true,
    });
  });

  test('terminal enforcement persists its fingerprinted result with the same proof', () => {
    const message = 'Writes to settings are blocked';
    const { control, handlers, route } = setup(() => ({ message }));
    const result = {
      output: message,
      statusMessage: message,
      display: [],
      returnedDiff: false,
      isError: true,
      error: message,
      files: [],
      enforcementPhase: 'tool_result',
    };

    handlers.applyToolOutcome({
      payload: {
        toolCallId: 'call-a',
        toolName: 'edit',
        origin: 'terminal_snapshot',
        result,
      },
      route,
      control,
    });

    expect(threadRuntimeManager.getLiveTurn(runtimeKey).parts[0]).toMatchObject({
      result,
      terminalSnapshotExpansionVersion: 1,
      terminalSnapshotExpansionComplete: true,
    });
  });

  test('ordinary incremental outcomes retain their prior unproved shape', () => {
    const { control, handlers, route } = setup();
    handlers.applyToolOutcome({
      payload: {
        toolCallId: 'call-a',
        toolName: 'edit',
        result: { output: 'incremental', isError: false },
      },
      route,
      control,
    });

    const part = threadRuntimeManager.getLiveTurn(runtimeKey).parts[0];
    expect(part.result).toEqual({
      output: 'incremental',
      statusMessage: undefined,
      display: [],
      returnedDiff: false,
      isError: false,
      error: undefined,
      files: [],
    });
    expect(part).not.toHaveProperty('terminalSnapshotExpansionVersion');
    expect(part).not.toHaveProperty('terminalSnapshotExpansionComplete');
  });
});
