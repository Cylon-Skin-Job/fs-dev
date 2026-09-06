'use strict';

const path = require('path');
const { commitIfChanged } = require('../versioning');

const CHECKPOINT_REASONS = new Set(['session_end', 'checkpoint', 'milestone']);

function createCheckpointAdapter({ commit = commitIfChanged, clock = () => new Date() } = {}) {
  return Object.freeze({
    async afterSave({ contentRoot, relativePath, saveReason, milestone }) {
      if (!CHECKPOINT_REASONS.has(saveReason)) return 'not_requested';
      const fileName = path.basename(relativePath);
      const message = saveReason === 'milestone'
        ? `milestone: ${milestone} — ${fileName}`
        : saveReason === 'checkpoint'
          ? `checkpoint: ${fileName} @ ${clock().toISOString()}`
          : `session: ${fileName}`;
      try {
        const result = await commit(contentRoot, relativePath, message);
        return result === false || result?.changed === false ? 'no_change' : 'committed';
      } catch (_error) {
        return 'failed';
      }
    },
  });
}

module.exports = { createCheckpointAdapter };
