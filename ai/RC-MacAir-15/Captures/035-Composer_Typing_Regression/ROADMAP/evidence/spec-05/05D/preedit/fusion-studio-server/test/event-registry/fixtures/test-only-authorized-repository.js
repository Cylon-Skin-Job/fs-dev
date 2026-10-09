'use strict';

const { createTestOnlyAuthorizedRegistry } = require('../../../lib/event-registry/repository');

if (process.env.NODE_ENV !== 'test' || typeof createTestOnlyAuthorizedRegistry !== 'function') {
  throw new Error('The human-authorization repository fixture is test-only');
}

module.exports = { createTestOnlyAuthorizedRegistry };
