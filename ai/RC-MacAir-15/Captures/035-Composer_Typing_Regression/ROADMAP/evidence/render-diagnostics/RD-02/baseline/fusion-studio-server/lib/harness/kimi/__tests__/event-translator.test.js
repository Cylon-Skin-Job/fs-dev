const { EventTranslator } = require('../event-translator');
const { KimiSessionState } = require('../session-state');

describe('EventTranslator', () => {
  it('should translate TurnBegin to canonical turn_begin', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    const msg = {
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'TurnBegin',
        payload: { user_input: 'Hello' }
      }
    };
    
    const event = translator.translate(msg);
    
    expect(event).toMatchObject({
      type: 'turn_begin',
      userInput: 'Hello'
    });
    expect(event.timestamp).toBeDefined();
    expect(event.turnId).toMatch(/^turn-/);
  });

  it('should map KIMI tool names to canonical', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    // First TurnBegin to initialize state
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnBegin', payload: {} }
    });
    
    const msg = {
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'ToolCall',
        payload: {
          id: 'tc-1',
          function: { name: 'ReadFile' }
        }
      }
    };
    
    const event = translator.translate(msg);
    
    expect(event.toolName).toBe('read'); // Not 'ReadFile'
  });

  it('should translate ContentPart text to content event', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    // First TurnBegin to initialize state
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnBegin', payload: {} }
    });
    
    const msg = {
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'ContentPart',
        payload: { type: 'text', text: 'Hello world' }
      }
    };
    
    const event = translator.translate(msg);
    
    expect(event).toMatchObject({
      type: 'content',
      text: 'Hello world'
    });
  });

  it('should translate ContentPart think to thinking event', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    // First TurnBegin to initialize state
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnBegin', payload: {} }
    });
    
    const msg = {
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'ContentPart',
        payload: { type: 'think', think: 'Let me think...' }
      }
    };
    
    const event = translator.translate(msg);
    
    expect(event).toMatchObject({
      type: 'thinking',
      text: 'Let me think...'
    });
  });

  it('should accumulate text content in state', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnBegin', payload: {} }
    });
    
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'ContentPart', payload: { type: 'text', text: 'Hello ' } }
    });
    
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'ContentPart', payload: { type: 'text', text: 'world' } }
    });
    
    expect(state.currentTurn.text).toBe('Hello world');
    expect(state.assistantParts).toHaveLength(1);
    expect(state.assistantParts[0].content).toBe('Hello world');
  });

  it('should handle ToolCall and ToolCallPart', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnBegin', payload: {} }
    });
    
    const toolCallEvent = translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'ToolCall',
        payload: { id: 'tc-1', function: { name: 'Bash' } }
      }
    });
    
    expect(toolCallEvent).toMatchObject({
      type: 'tool_call',
      toolCallId: 'tc-1',
      toolName: 'shell'
    });
    expect(state.hasToolCalls).toBe(true);
    expect(state.activeToolId).toBe('tc-1');
    
    const argsEvent = translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'ToolCallPart',
        payload: { arguments_part: '{"command": "ls"}' }
      }
    });
    
    expect(argsEvent).toMatchObject({
      type: 'tool_call_args',
      argsChunk: '{"command": "ls"}'
    });
    expect(state.toolArgs['tc-1']).toBe('{"command": "ls"}');
  });

  it('should handle StatusUpdate and include metadata in TurnEnd', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnBegin', payload: {} }
    });
    
    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'StatusUpdate',
        payload: {
          context_usage: 0.5,
          token_usage: { input_other: 100, output: 50 },
          message_id: 'msg-123',
          plan_mode: true
        }
      }
    });
    
    expect(state.contextUsage).toBe(0.5);
    expect(state.tokenUsage).toEqual({ input_other: 100, output: 50 });
    expect(state.messageId).toBe('msg-123');
    expect(state.planMode).toBe(true);
    
    const turnEndEvent = translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnEnd', payload: {} }
    });
    
    expect(turnEndEvent._meta).toMatchObject({
      contextUsage: 0.5,
      tokenUsage: { input_other: 100, output: 50 },
      messageId: 'msg-123',
      planMode: true
    });
  });

  it('should return null for non-event methods', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    const result = translator.translate({
      jsonrpc: '2.0',
      method: 'request',
      params: { type: 'some_request' }
    });
    
    expect(result).toBeNull();
  });

  it('should return null for unknown event types', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);
    
    const result = translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'UnknownEvent', payload: {} }
    });
    
    expect(result).toBeNull();
  });

  describe('tool name canonicalization', () => {
    /**
     * Helper: initialize state with a TurnBegin so ToolCall has a turn context.
     */
    function initState(translator) {
      translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'TurnBegin', payload: {} }
      });
    }

    it('maps Bash -> shell', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'Bash' } } }
      });
      expect(event.toolName).toBe('shell');
    });

    it('maps ReadFile -> read', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'ReadFile' } } }
      });
      expect(event.toolName).toBe('read');
    });

    it('maps WriteFile -> write', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'WriteFile' } } }
      });
      expect(event.toolName).toBe('write');
    });

    it('maps EditFile -> edit', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'EditFile' } } }
      });
      expect(event.toolName).toBe('edit');
    });

    // FINDING: StrReplaceFile is not currently mapped. The Kimi wire protocol
    // is not known to emit this alias; it uses EditFile. If future wire
    // analysis shows StrReplaceFile in the wild, add it to tool-mapper.js.
    it('falls back to lowercase for unmapped StrReplaceFile', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'StrReplaceFile' } } }
      });
      expect(event.toolName).toBe('strreplacefile');
    });

    it('maps WebSearch -> web_search', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'WebSearch' } } }
      });
      expect(event.toolName).toBe('web_search');
    });

    // FINDING: SearchWeb is not currently mapped. The Kimi wire protocol
    // is not known to emit this alias; it uses WebSearch. If future wire
    // analysis shows SearchWeb in the wild, add it to tool-mapper.js.
    it('falls back to lowercase for unmapped SearchWeb', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'SearchWeb' } } }
      });
      expect(event.toolName).toBe('searchweb');
    });

    it('maps WebFetch -> fetch', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'WebFetch' } } }
      });
      expect(event.toolName).toBe('fetch');
    });

    // FINDING: FetchURL is not currently mapped. The Kimi wire protocol
    // is not known to emit this alias; it uses WebFetch. If future wire
    // analysis shows FetchURL in the wild, add it to tool-mapper.js.
    it('falls back to lowercase for unmapped FetchURL', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'FetchURL' } } }
      });
      expect(event.toolName).toBe('fetchurl');
    });

    it('maps Agent -> subagent', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'Agent' } } }
      });
      expect(event.toolName).toBe('subagent');
    });

    // FINDING: Task is not currently mapped. The Kimi wire protocol
    // is not known to emit this alias; it uses Agent. If future wire
    // analysis shows Task in the wild, add it to tool-mapper.js.
    it('falls back to lowercase for unmapped Task', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'Task' } } }
      });
      expect(event.toolName).toBe('task');
    });

    it('maps TodoWrite -> todo', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'TodoWrite' } } }
      });
      expect(event.toolName).toBe('todo');
    });

    // FINDING: SetTodoList is not currently mapped. The Kimi wire protocol
    // is not known to emit this alias; it uses TodoWrite. If future wire
    // analysis shows SetTodoList in the wild, add it to tool-mapper.js.
    it('falls back to lowercase for unmapped SetTodoList', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);
      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'SetTodoList' } } }
      });
      expect(event.toolName).toBe('settodolist');
    });
  });

  describe('ToolResult normalization', () => {
    function initState(translator) {
      translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'TurnBegin', payload: {} }
      });
    }

    it('normalizes Kimi return_value into canonical tool_result fields', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);

      // First start a tool call
      translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'Bash' } } }
      });

      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'ToolResult',
          payload: {
            tool_call_id: 'tc-1',
            function: { name: 'Bash' },
            return_value: {
              output: 'hello world',
              message: 'Command completed',
              is_error: false,
              display: [],
              files: ['/tmp/output.txt']
            }
          }
        }
      });

      expect(event).toMatchObject({
        type: 'tool_result',
        toolCallId: 'tc-1',
        toolName: 'shell',
        output: 'hello world',
        statusMessage: 'Command completed',
        isError: false,
        returnedDiff: false,
        display: [],
        files: ['/tmp/output.txt']
      });
    });

    it('normalizes display diffs and sets returnedDiff true', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);

      translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'EditFile' } } }
      });

      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'ToolResult',
          payload: {
            tool_call_id: 'tc-1',
            function: { name: 'EditFile' },
            return_value: {
              output: '',
              is_error: false,
              display: [{
                type: 'diff',
                path: '/tmp/example.md',
                old_text: 'old\ncontent\n',
                new_text: 'new\ncontent\n',
                old_start: 1,
                new_start: 1,
                is_summary: false
              }]
            }
          }
        }
      });

      expect(event.returnedDiff).toBe(true);
      expect(event.display).toHaveLength(1);
      expect(event.display[0]).toMatchObject({
        type: 'diff',
        path: '/tmp/example.md',
        oldText: 'old\ncontent\n',
        newText: 'new\ncontent\n',
        oldStart: 1,
        newStart: 1,
        isSummary: false
      });
    });

    it('sets isError true when return_value.is_error is true', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);

      translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'Bash' } } }
      });

      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'ToolResult',
          payload: {
            tool_call_id: 'tc-1',
            function: { name: 'Bash' },
            return_value: {
              output: 'Error: command not found',
              is_error: true,
              display: []
            }
          }
        }
      });

      expect(event.isError).toBe(true);
      expect(event.output).toBe('Error: command not found');
    });

    it('defaults files to empty array when absent', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      initState(translator);

      translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: { type: 'ToolCall', payload: { id: 'tc-1', function: { name: 'Bash' } } }
      });

      const event = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'ToolResult',
          payload: {
            tool_call_id: 'tc-1',
            function: { name: 'Bash' },
            return_value: {
              output: 'done',
              is_error: false
            }
          }
        }
      });

      expect(event.files).toEqual([]);
    });
  });

  it('StatusUpdate emits canonical status_update and updates state for TurnEnd metadata', () => {
    const state = new KimiSessionState();
    const translator = new EventTranslator(state);

    translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnBegin', payload: {} }
    });

    const result = translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'StatusUpdate',
        payload: {
          context_usage: 0.75,
          token_usage: { input_other: 200, output: 100 },
          message_id: 'msg-456',
          plan_mode: false
        }
      }
    });

    expect(result).toMatchObject({
      type: 'status_update',
      contextUsage: 0.75,
      tokenUsage: { input_other: 200, output: 100 },
      messageId: 'msg-456',
      planMode: false
    });
    expect(result.timestamp).toBeDefined();

    // But state is updated for TurnEnd
    expect(state.contextUsage).toBe(0.75);
    expect(state.tokenUsage).toEqual({ input_other: 200, output: 100 });
    expect(state.messageId).toBe('msg-456');
    expect(state.planMode).toBe(false);

    const turnEnd = translator.translate({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnEnd', payload: {} }
    });

    expect(turnEnd._meta).toMatchObject({
      contextUsage: 0.75,
      tokenUsage: { input_other: 200, output: 100 },
      messageId: 'msg-456',
      planMode: false
    });
  });

  describe('SubagentEvent translation', () => {
    it('maps SubagentEvent to canonical subagent_event', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);

      const result = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'tc-1',
            agent_id: 'agent-1',
            subagent_type: 'task',
            event: {
              type: 'ToolCall',
              payload: { id: 'sub-tc-1', function: { name: 'Bash' } }
            }
          }
        }
      });

      expect(result).toMatchObject({
        type: 'subagent_event',
        parentToolCallId: 'tc-1',
        agentId: 'agent-1',
        subagentType: 'task',
        subagentEventType: 'ToolCall',
        subagentPayload: { id: 'sub-tc-1', function: { name: 'Bash' } }
      });
      expect(result.timestamp).toBeDefined();
    });

    it('preserves inner event names exactly (ToolCall, TurnBegin, etc.)', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);

      const eventNames = ['ToolCall', 'TurnBegin', 'ContentPart', 'ToolResult', 'TurnEnd', 'StatusUpdate'];
      for (const name of eventNames) {
        const result = translator.translate({
          jsonrpc: '2.0',
          method: 'event',
          params: {
            type: 'SubagentEvent',
            payload: {
              parent_tool_call_id: 'tc-1',
              agent_id: 'agent-1',
              subagent_type: 'task',
              event: { type: name, payload: {} }
            }
          }
        });
        expect(result.subagentEventType).toBe(name);
      }
    });

    it('defaults missing nested payload to empty object', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);

      const result = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'tc-1',
            agent_id: 'agent-1',
            subagent_type: 'task',
            event: { type: 'TurnBegin' }
          }
        }
      });

      expect(result.subagentPayload).toEqual({});
    });

    it('passes through nested payload without mutation', () => {
      const state = new KimiSessionState();
      const translator = new EventTranslator(state);
      const originalPayload = { text: 'hello', nested: { key: 'value' } };

      const result = translator.translate({
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'tc-1',
            agent_id: 'agent-1',
            subagent_type: 'task',
            event: { type: 'ContentPart', payload: originalPayload }
          }
        }
      });

      expect(result.subagentPayload).toEqual(originalPayload);
      expect(result.subagentPayload).not.toBe(originalPayload);
    });
  });
});
