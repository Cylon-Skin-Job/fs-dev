/**
 * Thread Message Handlers Tests
 *
 * Runtime-1R: verify explicit threadId overrides mutable selection state.
 */

const { createMessageHandlers } = require('../../lib/thread/thread-messages');

describe('createMessageHandlers', () => {
  let wsState;
  let ws;
  let mockManager;
  let handlers;

  beforeEach(() => {
    mockManager = {
      addMessage: jest.fn(() => Promise.resolve()),
      addMessageWithMetadata: jest.fn(() => Promise.resolve()),
    };

    ws = { send: jest.fn() };

    wsState = new Map();
    wsState.set(ws, {
      threadIds: { view: 'thread-B' },
      threadManagers: { view: mockManager },
    });

    handlers = createMessageHandlers({ wsState });
  });

  describe('addAssistantMessage', () => {
    test('uses explicit threadId when provided, ignoring mutable selection state', async () => {
      // Simulate: wsState says thread-B is selected (passive browse),
      // but the in-flight turn belongs to thread-A.
      await handlers.addAssistantMessage(
        ws,
        'Hello from A',
        false,
        null,
        'view',
        'thread-A'
      );

      expect(mockManager.addMessage).toHaveBeenCalledTimes(1);
      expect(mockManager.addMessage).toHaveBeenCalledWith('thread-A', {
        role: 'assistant',
        content: 'Hello from A',
        hasToolCalls: false,
      });
    });

    test('falls back to state.threadIds when no explicit threadId given', async () => {
      await handlers.addAssistantMessage(ws, 'Hello from B', false, null, 'view');

      expect(mockManager.addMessage).toHaveBeenCalledTimes(1);
      expect(mockManager.addMessage).toHaveBeenCalledWith('thread-B', {
        role: 'assistant',
        content: 'Hello from B',
        hasToolCalls: false,
      });
    });

    test('no-ops when neither explicit threadId nor state selection exists', async () => {
      wsState.set(ws, {
        threadIds: {},
        threadManagers: { view: mockManager },
      });

      await handlers.addAssistantMessage(ws, 'Hello', false, null, 'view');

      expect(mockManager.addMessage).not.toHaveBeenCalled();
    });

    test('no-ops when ws has no state entry', async () => {
      wsState.delete(ws);
      await handlers.addAssistantMessage(ws, 'Hello', false, null, 'view', 'thread-A');
      expect(mockManager.addMessage).not.toHaveBeenCalled();
    });

    test('uses addMessageWithMetadata when metadata is present', async () => {
      const metadata = { contextUsage: 42 };
      await handlers.addAssistantMessage(
        ws,
        'Hello',
        true,
        metadata,
        'view',
        'thread-A'
      );

      expect(mockManager.addMessageWithMetadata).toHaveBeenCalledTimes(1);
      expect(mockManager.addMessageWithMetadata).toHaveBeenCalledWith(
        'thread-A',
        {
          role: 'assistant',
          content: 'Hello',
          hasToolCalls: true,
        },
        metadata
      );
    });
  });
});
