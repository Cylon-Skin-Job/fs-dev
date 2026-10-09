/** Evidence for the legacy clean-exit fallback; never an authority over turn_end. */
class OpenCodeTurnOutcome {
  constructor() {
    this.hasAnswer = false;
    this.hasCompletedTool = false;
    this.failedTool = false;
    this.nonterminalFinish = false;
    this.pendingTools = new Set();
    this.toolError = '';
  }

  observe(native, translated) {
    if (!native || typeof native !== 'object') return;
    const part = native.part || {};
    if (native.type === 'step_finish' || part.type === 'step-finish') {
      this.nonterminalFinish = part.reason === 'tool-calls';
    }
    if (native.type === 'tool_use' || part.type === 'tool') {
      const state = part.state || {};
      const key = part.callID || part.id || 'unidentified-tool';
      const failed = state.status === 'error'
        || (typeof state.metadata?.exit === 'number' && state.metadata.exit !== 0);
      if (failed) {
        this.failedTool = true;
        // Only the existing diagnostic redactor may disclose this native text.
        if (typeof state.error === 'string') this.toolError = state.error;
      }
      if (state.status === 'completed' || state.status === 'error') {
        this.pendingTools.delete(key);
        if (!failed) this.hasCompletedTool = true;
      } else {
        this.pendingTools.add(key);
      }
    }
    if (translated.some(event => event.type === 'content' && String(event.text || '').trim())) {
      this.hasAnswer = true;
    }
  }

  permitsCleanExitCompletion() {
    return (this.hasAnswer || this.hasCompletedTool)
      && !this.failedTool && !this.nonterminalFinish && this.pendingTools.size === 0;
  }
}

module.exports = { OpenCodeTurnOutcome };
