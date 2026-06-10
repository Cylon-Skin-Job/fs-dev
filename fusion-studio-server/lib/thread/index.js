/**
 * Thread Management Module
 * 
 * Provides persistent, named conversations with lifecycle management.
 * 
 * @see ../../../ai/views/doc-viewer/specs/SPEC.md - Full specification
 */

const { ThreadIndex } = require('./ThreadIndex');
const { ChatFile, TOOL_CALL_MARKER } = require('./ChatFile');
const { ThreadManager } = require('./ThreadManager');
const { HistoryFile, SCHEMA_VERSION } = require('./HistoryFile');
const ThreadWebSocketHandler = require('./ThreadWebSocketHandler');
const { search } = require('./chat-search');
const { RUNTIME_STATES, ThreadRuntimeManager, threadRuntimeManager } = require('./thread-runtime-manager');
const threadRuntimeController = require('./thread-runtime-controller');
const threadRuntimeAutomation = require('./thread-runtime-automation');
const { getAutomationRuntimeStatus, sendAutomationPrompt } = threadRuntimeAutomation;
const threadManagerRegistry = require('./thread-manager-registry');

module.exports = {
  ThreadIndex,
  ChatFile,
  ThreadManager,
  HistoryFile,
  ThreadWebSocketHandler,
  RUNTIME_STATES,
  ThreadRuntimeManager,
  threadRuntimeManager,
  threadRuntimeController,
  threadRuntimeAutomation,
  getAutomationRuntimeStatus,
  sendAutomationPrompt,
  threadManagerRegistry,
  TOOL_CALL_MARKER,
  SCHEMA_VERSION,
  search,
};
