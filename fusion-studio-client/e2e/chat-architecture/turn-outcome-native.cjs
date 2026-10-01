// Deterministic CLI substitute: emits native JSON only; production parsing,
// translation, runtime, auth, persistence and renderer remain unchanged.
const fs = require('node:fs');
const path = require('node:path');
if (process.argv.includes('--version')) { console.log('fixture-native-json-1'); process.exit(0); }
const mode = process.argv.at(-1).match(/TO_CASE:([a-z-]+)/)?.[1];
if (!mode || !process.argv.includes('--auto') || process.env.OPENCODE_DISABLE_CLAUDE_CODE !== '1') process.exit(71);
fs.appendFileSync(path.join(__dirname, 'native-invocations.ndjson'), JSON.stringify({ mode, pid: process.pid,
  auto: true, claudeDisabled: true, at: Date.now() }) + '\n');
const emit = (type, part = {}) => console.log(JSON.stringify({ type, sessionID: 'ses_native_fixture', timestamp: Date.now(), part }));
const text = value => emit('text', { type: 'text', text: value });
const tool = (status, exit, callID = 'call_fixture') => emit('tool_use', { type: 'tool', tool: 'bash', callID,
  state: { status, input: { command: 'fixture-only' }, output: status === 'completed' ? 'Retained tool result' : '',
    error: 'NATIVE_PRIVATE_DENIAL /private/fixture/provider-detail', ...(exit == null ? {} : { metadata: { exit } }) } });
const finish = reason => emit('step_finish', { type: 'step-finish', reason, messageID: 'msg_fixture' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  emit('step_start', { type: 'step-start' });
  await sleep(100);
  if (mode === 'empty') return;
  if (mode === 'reasoning') { emit('reasoning', { type: 'reasoning', text: 'Retained fixture reasoning' }); return; }
  if (!['denied-only', 'compat-tool'].includes(mode)) text(`Retained answer ${mode}`);
  if (['denied', 'denied-only', 'recovered', 'stop'].includes(mode)) tool('error', 0);
  if (['success', 'compat-tool', 'tool-calls'].includes(mode)) tool('completed', 0);
  if (mode === 'pending') tool('running');
  if (['denied', 'denied-only', 'recovered', 'tool-calls', 'stop'].includes(mode)) finish('tool-calls');
  if (mode === 'stop') { await sleep(20000); text('LATE_STOP_TEXT'); finish('stop'); return; }
  if (mode === 'recovered') { text('Recovered provider answer'); finish('stop'); }
  if (['success', 'terminal-nonzero', 'duplicate'].includes(mode)) finish('stop');
  if (mode === 'duplicate') { finish('stop'); text('LATE_DUPLICATE_TEXT'); }
  await sleep(200);
  if (['nonzero', 'terminal-nonzero'].includes(mode)) process.exitCode = 1;
})();
