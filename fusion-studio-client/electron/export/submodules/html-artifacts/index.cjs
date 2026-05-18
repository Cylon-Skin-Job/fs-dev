/**
 * @module export/submodules/html-artifacts
 * @role HTML-based artifacts (slides, presentations, custom layouts) → PDF
 *
 * Future implementation: load HTML content directly into pdf-engine.
 */

module.exports = {
  async export({ sourceFormat }) {
    throw new Error(
      `HTML artifact PDF export not yet implemented (requested format: ${sourceFormat})`
    );
  },
};
