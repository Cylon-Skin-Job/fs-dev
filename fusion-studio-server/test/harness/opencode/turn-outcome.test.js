const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');
const { OpenCodeHarness } = require('../../../lib/harness/opencode');
const text = { type: 'text', part: { type: 'text', text: 'Retained partial answer' } };
const reasoning = { type: 'reasoning', part: { type: 'reasoning', text: 'Retained reasoning' } };
const finish = reason => ({ type: 'step_finish', part: { type: 'step-finish', reason } });
const tool = (status, exit, callID = 'call_1') => ({ type: 'tool_use', part: {
  type: 'tool', tool: 'bash', callID, state: { status, input: { command: 'fixture' },
    output: status === 'completed' ? 'tool output' : '', error: 'Rejected at /private/fixture/workspace/safe.txt',
    ...(exit === undefined ? {} : { metadata: { exit } }) },
} });
async function run(sequence, code = 0, stop = false) {
  const proc = new EventEmitter();
  Object.assign(proc, { stdout: new PassThrough(), stderr: new PassThrough(), pid: 424242,
    kill: jest.fn(() => true) });
  spawn.mockReturnValueOnce(proc);
  const harness = new OpenCodeHarness();
  await harness.initialize({ getConfiguredSecrets: async () => ['configured-secret-long-value'] });
  const session = await harness.startThread('outcome', '/private/fixture/workspace');
  const events = [];
  const drain = (async () => {
    try { for await (const event of session.sendMessage('outcome', { pollIntervalMs: 1 })) events.push(event); }
    catch (error) { return error; }
  })();
  for (const event of sequence) proc.stdout.emit('data', JSON.stringify(event === null ? null : { sessionID: 'ses_fixture', ...event }) + '\n');
  if (stop) session.stopRequested = true;
  proc.emit('exit', code, stop ? 'SIGTERM' : null);
  proc.emit('close', code, stop ? 'SIGTERM' : null);
  return { events, error: await drain };
}

describe('OpenCode native premature turn outcomes', () => {
  beforeEach(() => spawn.mockReset());
  test.each([
    ['rejected tool alone', [tool('error')]],
    ['rejected tool after text', [text, tool('error')]],
    ['explicit error beats zero tool exit', [text, tool('error', 0)]],
    ['completed status with failing exit', [text, tool('completed', 1)]],
    ['rejected tool after earlier successful tool', [tool('completed', 0), tool('error', undefined, 'call_2'), finish('tool-calls')]],
    ['intermediate tool-calls after text', [text, finish('tool-calls')]],
    ['intermediate tool-calls after successful tool', [tool('completed', 0), finish('tool-calls')]],
    ['reasoning only', [reasoning]],
    ['empty text', [{ type: 'text', part: { text: '' } }]],
    ['empty run', []],
    ['step start only', [{ type: 'step_start' }]],
    ['unfinished tool', [text, tool('running')]],
    ['unfinished legacy tool', [text, { type: 'tool_use', part: { state: { status: 'running' } } }]],
    ['new pending tool after completed tool', [tool('completed', 0), tool('running', undefined, 'call_2')]],
  ])('%s cannot synthesize success', async (_name, sequence) => {
    const { events, error } = await run(sequence);
    expect(events.filter(event => event.type === 'turn_end')).toHaveLength(0);
    expect(error).toMatchObject({ code: 'HARNESS_PROCESS_EXIT' });
    if (sequence.includes(text)) expect(events).toContainEqual(expect.objectContaining({ type: 'content', text: text.part.text }));
  });
  test.each([
    ['ordinary success', [text, tool('completed', 0), finish('stop')]],
    ['recovered rejection', [tool('error'), finish('tool-calls'), text, finish('stop')]],
    ['recovered zero-exit error status', [tool('error', 0), text, finish('stop')]],
    ['compatible text exit', [text]],
    ['compatible completed tool exit', [tool('completed', 0)]],
    ['compatible reasoning plus text exit', [reasoning, text]],
    ['pending tool completed before exit', [tool('running'), tool('completed', 0)]],
    ['ignored null JSON', [null, text]],
  ])('%s retains success', async (_name, sequence) => {
    const { events, error } = await run(sequence);
    expect(error).toBeUndefined();
    expect(events.filter(event => event.type === 'turn_end')).toHaveLength(1);
  });
  test('nonzero exit before terminal preserves partial output and failure', async () => {
    const { events, error } = await run([text], 1);
    expect(error).toMatchObject({ code: 'HARNESS_PROCESS_EXIT' });
    expect(events.map(e => e.type)).toEqual(['turn_begin', 'content']);
  });
  test('authoritative terminal then abnormal shutdown retains the terminal before the existing iterator failure', async () => {
    const { events, error } = await run([text, finish('stop')], 1);
    expect(events.filter(e => e.type === 'turn_end')).toHaveLength(1);
    expect(events.at(-1).reason).toBe('stop');
    expect(error).toMatchObject({ code: 'HARNESS_PROCESS_EXIT' });
  });
  test('Stop racing failed native output/close produces no adapter terminal or failure', async () => {
    const { events, error } = await run([text, tool('error'), finish('tool-calls')], null, true);
    expect(error).toBeUndefined();
    expect(events.filter(e => e.type === 'turn_end')).toHaveLength(0);
  });
  test('native failure detail survives only in the redacted diagnostic candidate', async () => {
    const { error } = await run([tool('error')]);
    expect(error.candidate.message).toContain('$WORKSPACE/safe.txt');
    expect(error.message).not.toContain('Rejected');
    expect(error.message).not.toContain('/private/fixture');
  });
  test('native failure detail is redacted before truncation', async () => {
    const event = tool('error');
    event.part.state.error = 'x'.repeat(4080) + 'configured-secret-long-value';
    const { error } = await run([event]);
    expect(JSON.stringify(error.candidate)).not.toContain('configured-s');
    expect(error.candidate.message).toContain('[REDACTED]');
  });
});
