'use strict';

const { registerCollector } = require('../exchange-metadata-registry');

function normalizeAttachment(item) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.kind !== 'string' || typeof item.label !== 'string' || typeof item.path !== 'string') {
    return null;
  }
  return {
    kind: item.kind,
    label: item.label,
    path: item.path,
    sourceName: typeof item.sourceName === 'string' ? item.sourceName : item.label,
    ...(typeof item.panel === 'string' ? { panel: item.panel } : {}),
    ...(typeof item.relativePath === 'string' ? { relativePath: item.relativePath } : {}),
  };
}

registerCollector({
  id: 'attachments',
  collect(input) {
    const attachments = Array.isArray(input.attachments)
      ? input.attachments.map(normalizeAttachment).filter(Boolean)
      : [];
    return { attachments };
  },
});
