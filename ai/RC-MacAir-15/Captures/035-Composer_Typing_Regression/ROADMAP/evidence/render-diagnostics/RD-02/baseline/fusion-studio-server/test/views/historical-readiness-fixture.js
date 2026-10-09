'use strict';

// Test-only support for Slice 1-3 compatibility cases. Production runtime has
// no import, export, default, or fallback path to the retired-tree adapter.
const { createPreCutoverViewReadinessAdapter } = require('./fixtures/precutover-readiness-adapter');
const readinessRuntime = require('../../lib/views/readiness-runtime');
const aiPaths = require('../../lib/workspace/ai-paths');

function installHistoricalReadinessFixture(machineIdentity = aiPaths.getLocalMachineName()) {
  return readinessRuntime.installViewReadinessOwner(
    createPreCutoverViewReadinessAdapter({ machineIdentity }),
  );
}

module.exports = { installHistoricalReadinessFixture };
