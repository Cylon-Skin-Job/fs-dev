'use strict';

const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const {
  GATE_OWNERS,
  evaluateGate,
  parseSchedule,
  resetGateCounts,
} = require('./fixture-fault-runtime.cjs');

const DEFAULT_EVENT_SCRIPT = Object.freeze({
  frameIntervalMs: 50,
  textFrames: 100,
  includeThinking: true,
  includeTool: true,
  includeUsage: true,
  workingDelayMs: 0,
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendEvent(event) {
  const target = process.env.FUSION_CHAT_ARCH_ADAPTER_LOG;
  if (!target) return;
  fs.appendFileSync(target, `${JSON.stringify({ at: Date.now(), ...event })}\n`);
}

async function atGate(schedule, gate, expectedOwner = 'adapter') {
  return evaluateGate(schedule, gate, expectedOwner);
}

function eventScript() {
  if (!process.env.FUSION_CHAT_ARCH_EVENT_SCRIPT) return { ...DEFAULT_EVENT_SCRIPT };
  const input = JSON.parse(process.env.FUSION_CHAT_ARCH_EVENT_SCRIPT);
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error('event script must be an object');
  }
  return {
    frameIntervalMs: Math.max(1, Math.min(1_000, Number(input.frameIntervalMs) || DEFAULT_EVENT_SCRIPT.frameIntervalMs)),
    textFrames: Math.max(1, Math.min(10_000, Number(input.textFrames) || DEFAULT_EVENT_SCRIPT.textFrames)),
    includeThinking: input.includeThinking !== false,
    includeTool: input.includeTool !== false,
    includeUsage: input.includeUsage !== false,
    workingDelayMs: Math.max(0, Math.min(1_000, Number(input.workingDelayMs) || 0)),
  };
}

function createProcessProxy(stop) {
  const proc = new EventEmitter();
  proc.pid = null;
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.killed = false;
  proc.kill = (signal = 'SIGTERM') => {
    if (proc.killed) return false;
    proc.killed = true;
    void stop(signal).finally(() => {
      proc.emit('exit', null, signal);
      proc.emit('close', null, signal);
    });
    return true;
  };
  return proc;
}

class OpenCodeHarness extends EventEmitter {
  constructor() {
    super();
    this.id = 'opencode';
    this.name = 'OpenCode';
    this.provider = 'opencode';
    this.sessions = new Map();
    this.config = {};
  }

  async initialize(config = {}) {
    this.config = { ...this.config, ...config };
  }

  async startThread(threadId, projectRoot, scopeContext = {}, threadOptions = {}) {
    const harness = this;
    const schedule = parseSchedule();
    const script = eventScript();
    const sessionKey = threadOptions.sessionKey || threadId;
    let stopRequested = false;
    let stopSignal = null;
    let active = false;
    const stop = async (signal = 'SIGTERM') => {
      await atGate(schedule, 'before-stop');
      stopRequested = true;
      stopSignal = signal;
      await atGate(schedule, 'after-stop');
    };
    const processProxy = createProcessProxy(stop);
    const session = {
      threadId,
      projectRoot,
      scopeContext,
      process: processProxy,
      applyHarnessConfig() {},
      async *sendMessage(_message) {
        active = true;
        stopRequested = false;
        stopSignal = null;
        await atGate(schedule, 'before-dispatch');
        await atGate(schedule, 'after-dispatch');
        await atGate(schedule, 'before-turn-begin');
        const now = Date.now();
        yield {
          type: 'turn_begin',
          timestamp: now,
          timestampSource: 'host_observed',
          observedAt: now,
          turnId: `fixture-turn-${now}`,
          userInput: '[fixture input]',
        };
        await atGate(schedule, 'after-turn-begin');
        yield { type: 'step_begin', timestamp: Date.now(), stepId: 'fixture-step-1' };
        if (script.workingDelayMs) await delay(script.workingDelayMs);
        if (script.includeThinking) {
          yield {
            type: 'thinking', timestamp: Date.now(), timestampSource: 'host_observed',
            observedAt: Date.now(), text: 'Deterministic fixture reasoning',
          };
        }
        if (script.includeTool) {
          const timing = { timestamp: Date.now(), timestampSource: 'host_observed', observedAt: Date.now() };
          yield { type: 'tool_call', ...timing, toolCallId: 'fixture-tool-1', toolName: 'read' };
          yield { type: 'tool_call_args', ...timing, toolCallId: 'fixture-tool-1', argsChunk: '{"path":"fixture.txt"}' };
          yield {
            type: 'tool_result', ...timing, toolCallId: 'fixture-tool-1', toolName: 'read',
            output: 'fixture result', statusMessage: 'Fixture read completed', display: [],
            returnedDiff: false, isError: false, files: [],
          };
        }
        if (script.includeUsage) {
          yield {
            type: 'status_update', timestamp: Date.now(), timestampSource: 'host_observed',
            observedAt: Date.now(), tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          };
        }
        let frame = 0;
        const fullText = [];
        while (!stopRequested && frame < script.textFrames) {
          frame += 1;
          const text = frame === 1 ? 'Deterministic fixture reply ' : `frame-${frame} `;
          fullText.push(text);
          yield {
            type: 'content',
            timestamp: Date.now(),
            timestampSource: 'host_observed',
            observedAt: Date.now(),
            text,
          };
          await delay(script.frameIntervalMs);
        }
        if (!stopRequested) {
          yield {
            type: 'turn_end',
            timestamp: Date.now(),
            timestampSource: 'host_observed',
            observedAt: Date.now(),
            fullText: fullText.join(''),
            hasToolCalls: script.includeTool,
            reason: 'complete',
          };
        }
        active = false;
        appendEvent({ type: 'iterator-end', stopRequested, stopSignal, frames: frame });
      },
      async stop(signal) {
        await stop(signal);
        if (!active) {
          await atGate(schedule, 'before-shutdown');
          await atGate(schedule, 'after-shutdown');
        }
        if (harness.sessions.get(sessionKey) === session) harness.sessions.delete(sessionKey);
        appendEvent({ type: 'session-retired', threadId, sessionKey, retainedSessions: harness.sessions.size });
      },
    };
    this.sessions.set(sessionKey, session);
    appendEvent({ type: 'session-start', threadId, sessionKey, externalProcess: false });
    return session;
  }

  getSession(threadId) {
    const exact = this.sessions.get(threadId);
    if (exact) return exact;
    const matches = [...this.sessions.values()].filter((session) => session.threadId === threadId);
    return matches.length === 1 ? matches[0] : undefined;
  }

  async dispose() {
    await Promise.all([...this.sessions.values()].map((session) => session.stop('SIGTERM')));
    this.sessions.clear();
  }

  async isInstalled() { return true; }
  async getVersion() { return 'chat-architecture-fixture-v1'; }
}

module.exports = {
  OpenCodeHarness,
  FIXTURE_GATE_OWNERS: GATE_OWNERS,
  DEFAULT_EVENT_SCRIPT,
  evaluateFixtureFaultGate: atGate,
  parseFixtureFaultSchedule: parseSchedule,
  resetFixtureFaultGateCounts: resetGateCounts,
};
