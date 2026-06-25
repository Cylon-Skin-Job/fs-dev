'use strict';

const { getCollectors, mergeMetadata } = require('./exchange-metadata-registry');
require('./collectors/attachments');
require('./collectors/file-mentions');
require('./collectors/file-mutations');

async function aggregateExchangeMetadata(input) {
  let metadata = { ...(input.existingMetadata || {}) };

  for (const collector of getCollectors()) {
    try {
      const contribution = await collector.collect(input);
      metadata = mergeMetadata(metadata, contribution);
    } catch (err) {
      console.error(`[ExchangeMetadata] Collector failed: ${collector.id}`, err);
    }
  }

  return metadata;
}

module.exports = {
  aggregateExchangeMetadata,
};
