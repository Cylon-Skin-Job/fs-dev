/**
 * Normalize Kimi tool display payloads into the universal tool result shape.
 */

function normalizeKimiToolResult(returnValue = {}) {
  const display = normalizeDisplay(returnValue.display);
  const returnedDiff = display.some((item) => item && item.type === 'diff');
  const output = typeof returnValue.output === 'string' ? returnValue.output : '';
  const statusMessage = typeof returnValue.message === 'string' ? returnValue.message : undefined;
  const isError = Boolean(returnValue.is_error);

  return {
    output,
    statusMessage,
    isError,
    returnedDiff,
    display,
    files: Array.isArray(returnValue.files) ? returnValue.files : [],
  };
}

function normalizeDisplay(display) {
  if (!Array.isArray(display)) return [];
  return display.map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (item.type !== 'diff') return item;

    const oldText = typeof item.old_text === 'string'
      ? item.old_text
      : typeof item.oldText === 'string'
        ? item.oldText
        : '';
    const newText = typeof item.new_text === 'string'
      ? item.new_text
      : typeof item.newText === 'string'
        ? item.newText
        : '';

    return {
      type: 'diff',
      path: typeof item.path === 'string' ? item.path : '',
      oldText,
      newText,
      oldStart: numberOrDefault(item.old_start ?? item.oldStart, 1),
      newStart: numberOrDefault(item.new_start ?? item.newStart, 1),
      removedLines: countChangedLines(oldText),
      addedLines: countChangedLines(newText),
      isSummary: Boolean(item.is_summary ?? item.isSummary),
    };
  });
}

function countChangedLines(text) {
  if (!text) return 0;
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

function numberOrDefault(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

module.exports = {
  normalizeKimiToolResult,
  countChangedLines,
};
