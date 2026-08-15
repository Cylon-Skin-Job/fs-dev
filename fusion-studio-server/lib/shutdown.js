function createShutdownHandler({
  server,
  sessions,
  closeWatchers,
  closeDatabase,
  exit = process.exit,
  logger = console,
  forceAfterMs = 2500,
}) {
  let shutdownPromise = null;

  return function requestShutdown(signal = 'SIGTERM') {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      logger.log(`[Shutdown] received ${signal}`);
      const forceTimer = setTimeout(() => {
        logger.error(`[Shutdown] cleanup exceeded ${forceAfterMs}ms; forcing exit`);
        exit(1);
      }, forceAfterMs);
      forceTimer.unref?.();

      try {
        // Stop accepting new work and disconnect renderer clients before
        // waiting for persistent resources such as SQLite to close.
        try { server.close(); } catch {}
        try { server.closeIdleConnections?.(); } catch {}
        try { server.closeAllConnections?.(); } catch {}
        logger.log('[Shutdown] HTTP listener closed');

        for (const [ws] of sessions) {
          try { ws.terminate?.(); } catch {}
        }
        sessions.clear();
        logger.log('[Shutdown] renderer clients disconnected');

        logger.log('[Shutdown] closing file watchers');
        await closeWatchers();
        logger.log('[Shutdown] file watchers closed');
        logger.log('[Shutdown] closing database');
        await closeDatabase();
        logger.log('[Shutdown] database closed');
        clearTimeout(forceTimer);
        logger.log('[Shutdown] cleanup complete');
        exit(0);
      } catch (error) {
        clearTimeout(forceTimer);
        logger.error(`[Shutdown] cleanup failed: ${error.message}`);
        exit(1);
      }
    })();

    return shutdownPromise;
  };
}

module.exports = { createShutdownHandler };
