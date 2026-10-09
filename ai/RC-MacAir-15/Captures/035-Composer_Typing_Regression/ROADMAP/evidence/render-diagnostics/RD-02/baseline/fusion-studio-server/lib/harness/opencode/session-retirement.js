'use strict';

// Adapter registry lifetime ends only when the captured provider has closed.
async function retireSession(sessions, key, session, signal) {
  session.stopRequested = true;
  const provider = session.activeProcess;
  const closed = session.activeProcessClose;
  const evict = () => {
    if (sessions.get(key) === session) sessions.delete(key);
  };
  if (!provider || !closed) { evict(); return; }
  // killed means signal accepted, not process closed; allow escalation.
  provider.kill(signal || 'SIGTERM');
  if (signal !== undefined) {
    await closed;
    evict();
  } else {
    // Preserve the direct no-argument stop contract (signal-only completion).
    void closed.then(evict);
  }
}

module.exports = { retireSession };
