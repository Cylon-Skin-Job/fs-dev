const { runCapability } = require('./runner');
const { warmCapability, getCapabilityStatus } = require('./warm-service');

module.exports = {
  warmCapability,
  runCapability,
  getCapabilityStatus,
};
