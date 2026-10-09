'use strict';

const { createScopedCapabilityFactory } = require('./capability-factory');
const { createSubscriptionController } = require('./controller');
const { compileGeneration } = require('./generation-compiler');
const { createHandlerCatalog } = require('./handler-catalog');

module.exports = {
  compileGeneration,
  createHandlerCatalog,
  createScopedCapabilityFactory,
  createSubscriptionController,
};
