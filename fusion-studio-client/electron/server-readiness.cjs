'use strict';

function parseServerReadyLine(line) {
  if (!line.startsWith('SERVER_READY:')) return null;
  const value = line.slice('SERVER_READY:'.length);
  if (!/^[1-9]\d{0,4}$/.test(value)) throw new Error('Invalid server readiness port');
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65_535) throw new Error('Invalid server readiness port');
  return port;
}

function createServerReadinessParser(onReady, onInvalid) {
  let pending = '';
  let settled = false;
  return Object.freeze({
    push(chunk) {
      if (settled) return;
      pending += chunk;
      if (pending.length > 4096) pending = pending.slice(-4096);
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || '';
      for (const line of lines) {
        try {
          const port = parseServerReadyLine(line);
          if (port === null) continue;
          settled = true;
          onReady(port);
          return;
        } catch (error) {
          settled = true;
          onInvalid(error);
          return;
        }
      }
    },
  });
}

module.exports = { createServerReadinessParser, parseServerReadyLine };
