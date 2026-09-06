'use strict';

const { bootstrapAdmission } = require('./admission');

function bootstrapGovernedEventBus(options) {
  return bootstrapAdmission(options);
}

module.exports = { bootstrapGovernedEventBus };
