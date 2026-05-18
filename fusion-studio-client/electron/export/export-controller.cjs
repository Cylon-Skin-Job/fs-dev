/**
 * @module export-controller
 * @role Central router for all export operations.
 *
 * Submodules register themselves by sourceType ('document', 'html-artifact',
 * 'spreadsheet'). The controller delegates incoming export requests to the
 * appropriate handler.
 */

const handlers = new Map();

function register(sourceType, handler) {
  if (handlers.has(sourceType)) {
    throw new Error(`Export handler already registered for source type: ${sourceType}`);
  }
  handlers.set(sourceType, handler);
}

/**
 * Export a piece of content to the requested format.
 * @param {object} params
 * @param {string} params.sourceType - 'document' | 'html-artifact' | 'spreadsheet'
 * @param {string} params.sourceFormat - 'markdown' | 'html' | 'csv' | ...
 * @param {string} params.content
 * @param {string} params.filename
 * @param {object} [params.options]
 * @returns {Promise<{buffer: Buffer, filename: string}>}
 */
async function exportDocument({ sourceType, sourceFormat, content, filename, options }) {
  const handler = handlers.get(sourceType);
  if (!handler) {
    throw new Error(`No export handler registered for source type: ${sourceType}`);
  }
  const buffer = await handler.export({ sourceFormat, content, options });
  return { buffer, filename };
}

module.exports = { register, exportDocument };
