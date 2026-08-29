/**
 * @module terminal-diagnostic-boundary
 * @role Keep best-effort diagnostic persistence from blocking terminalization.
 */

async function persistTerminalDiagnosticSafely(persistDiagnosticReport, binding, candidate) {
  try {
    return await persistDiagnosticReport(binding, candidate);
  } catch {
    // Treat the service contract as an external dependency boundary too. A
    // replacement, mock, or future implementation must not be able to leak a
    // rejection or prevent the authoritative error terminal from completing.
    console.warn('[HarnessDiagnostics] Terminal persistence dependency failed', {
      workspaceId: binding.workspaceId,
      threadId: binding.threadId,
      turnId: binding.turnId,
      marker: 'HARNESS_DIAGNOSTIC_DEPENDENCY_FAILED',
    });
    return null;
  }
}

module.exports = { persistTerminalDiagnosticSafely };
