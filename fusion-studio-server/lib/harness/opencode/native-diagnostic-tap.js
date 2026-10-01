'use strict';
const { collectExactValueReplacements, redactFreeFormText } = require('./harness-diagnostic-redactor');

// Redaction and delivery run after the parser callback. The canonical iterator never awaits us.
function createNativeDiagnosticTap(observer, options) {
  let queue = [], units = 0, scheduled = false, finished = false;
  let replacementsPromise;
  let fallbackSequence = 0;
  const clear = () => { queue = []; units = 0; };
  try { observer?.onDiscard?.(clear); } catch { /* observer-only */ }
  const observed = () => { try { return observer?.isObserved() === true; } catch { return false; } };
  const emit = (event) => {
    if (!observed()) return;
    try { Promise.resolve(observer.emit(event)).catch(() => {}); } catch { /* observer-only failure */ }
  };
  try { observer?.available(); } catch { /* observation cannot affect translation */ }
  async function drain() {
    try {
      if (!queue.length || !observed()) { clear(); return; }
      if (!replacementsPromise) {
        replacementsPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('redaction unavailable')), 2000);
          collectExactValueReplacements(options).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
        });
      }
      const replacements = [...await replacementsPromise];
      for (const item of [...replacements]) {
        const escaped = JSON.stringify(item.find).slice(1, -1);
        if (escaped !== item.find) replacements.push({ find: escaped, replacement: item.replacement });
      }
      const prefixes = [{ prefix: options.workspaceRoot, token: '$WORKSPACE' },
        { prefix: options.homePath, token: '$HOME' }].sort((a, b) => b.prefix.length - a.prefix.length);
      while (queue.length) {
        const event = queue.shift(); units -= event.text.length;
        if (!observed()) continue;
        const redacted = redactFreeFormText(event.text, replacements, prefixes)
          .replace(/("(?:api[-_]?key|access[-_]?key|private[-_]?key|token|secret|password|passwd|authorization|credentials?)"\s*:\s*)"(?:\\.|[^"\\])*"/gi, '$1"[REDACTED]"');
        emit({ ...event, text: redacted, redacted: redacted !== event.text });
      }
    } catch {
      const loss = queue.reduce((total, event) => ({ sourceUnits: total.sourceUnits + event.sourceUnits,
        sourceBytes: total.sourceBytes + event.sourceBytes, count: total.count + event.count, seq: event.seq,
        firstSeq: total.firstSeq ?? event.firstSeq }), { sourceUnits: 0, sourceBytes: 0, count: 0, firstSeq: null });
      clear();
      if (loss.count) emit({ text: '', ...loss, dropped: true, redacted: true });
    }
    finally {
      scheduled = false;
      if (finished) { try { observer?.finish(); } catch { /* observation-only */ } }
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { void drain(); }, 0);
  }
  return {
    push(line) {
      if (!observed()) return;
      let seq;
      try { seq = observer?.reserveSequence?.() ?? ++fallbackSequence; } catch { return; }
      const sourceUnits = line.length, sourceBytes = Buffer.byteLength(line);
      // Drop the WHOLE oversize event before redaction, never reveal a partial secret.
      const dropped = sourceUnits > 65536 || units + sourceUnits > 262144 || queue.length >= 128;
      if (dropped) {
        // Bounded dropped marker, cumulative count retained without retaining native content.
        const tail = queue[queue.length - 1];
        if (tail?.dropped) { tail.sourceUnits += sourceUnits; tail.sourceBytes += sourceBytes; tail.count += 1; tail.seq = seq; }
        else queue.push({ text: '', sourceUnits, sourceBytes, dropped: true, count: 1, seq, firstSeq: seq });
      } else { queue.push({ text: line, sourceUnits, sourceBytes, count: 1, dropped: false, seq, firstSeq: seq }); units += sourceUnits; }
      schedule();
    },
    finish() {
      finished = true;
      if (queue.length) schedule();
      else if (!scheduled) { try { observer?.finish(); } catch { /* observer-only */ } }
    },
  };
}
module.exports = { createNativeDiagnosticTap };
