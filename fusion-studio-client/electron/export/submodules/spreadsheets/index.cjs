/**
 * @module export/submodules/spreadsheets
 * @role Spreadsheet → PDF export
 *
 * Future implementation: render sheet to HTML, then pipe through pdf-engine.
 */

module.exports = {
  async export({ sourceFormat }) {
    throw new Error(
      `Spreadsheet PDF export not yet implemented (requested format: ${sourceFormat})`
    );
  },
};
