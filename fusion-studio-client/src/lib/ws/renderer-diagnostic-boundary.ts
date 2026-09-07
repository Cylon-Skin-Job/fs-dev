type ConsoleMethod = 'debug' | 'error' | 'info' | 'log' | 'warn';

const markers: Record<ConsoleMethod, string> = {
  debug: '[WS] handler_debug',
  error: '[WS] handler_error',
  info: '[WS] handler_info',
  log: '[WS] handler_log',
  warn: '[WS] handler_warning',
};

let boundaryDepth = 0;

/**
 * Prevent any synchronously dispatched WebSocket field from becoming a
 * renderer diagnostic. The routed message itself remains untouched.
 */
export function runWithRendererMessageDiagnosticBoundary<T>(callback: () => T): T {
  if (boundaryDepth > 0) return callback();
  boundaryDepth += 1;
  const originals = {
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn,
  };
  const wrappers = Object.fromEntries(
    (Object.keys(markers) as ConsoleMethod[]).map((method) => [
      method,
      () => originals[method].call(console, markers[method]),
    ]),
  ) as Record<ConsoleMethod, (...args: unknown[]) => void>;

  console.debug = wrappers.debug;
  console.error = wrappers.error;
  console.info = wrappers.info;
  console.log = wrappers.log;
  console.warn = wrappers.warn;
  try {
    return callback();
  } finally {
    if (console.debug === wrappers.debug) console.debug = originals.debug;
    if (console.error === wrappers.error) console.error = originals.error;
    if (console.info === wrappers.info) console.info = originals.info;
    if (console.log === wrappers.log) console.log = originals.log;
    if (console.warn === wrappers.warn) console.warn = originals.warn;
    boundaryDepth -= 1;
  }
}
