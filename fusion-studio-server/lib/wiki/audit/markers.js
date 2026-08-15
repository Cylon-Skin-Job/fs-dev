/**
 * Marker-block helpers for script-owned regions inside wiki pages.
 *
 * Ownership rule (wiki-audit-decisions.md, Decision 2): inside markers =
 * script, outside markers = authored. Every generated region a wiki page
 * carries (section-toc today; children and appears-in in later phases)
 * goes through this module so the boundary logic lives in one place.
 */

function markerPair(name) {
  return {
    start: `<!-- ${name}:start -->`,
    end: `<!-- ${name}:end -->`,
  };
}

/**
 * Replace the contents of a marker block.
 *
 * @param {string} content - Full page content.
 * @param {string} name - Marker name (e.g. 'section-toc').
 * @param {string} generated - Replacement text for inside the block.
 * @returns {{ status: 'updated'|'unchanged'|'no-markers', content: string }}
 */
function replaceMarkerBlock(content, name, generated) {
  const { start, end } = markerPair(name);
  const startIdx = content.indexOf(start);
  const endIdx = content.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { status: 'no-markers', content };
  }

  const updated =
    content.slice(0, startIdx + start.length) +
    '\n' + generated + '\n' +
    content.slice(endIdx);

  return {
    status: updated === content ? 'unchanged' : 'updated',
    content: updated,
  };
}

module.exports = {
  markerPair,
  replaceMarkerBlock,
};
