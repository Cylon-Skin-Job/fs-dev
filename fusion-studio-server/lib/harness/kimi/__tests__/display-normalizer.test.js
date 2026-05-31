const { countChangedLines, normalizeKimiToolResult } = require('../display-normalizer');

describe('Kimi display normalizer', () => {
  it('normalizes Kimi diff display into universal camelCase shape', () => {
    const result = normalizeKimiToolResult({
      is_error: false,
      output: '',
      message: 'File successfully overwritten. Current size: 71 bytes.',
      display: [{
        type: 'diff',
        path: '/tmp/example.md',
        old_text: '',
        new_text: 'alpha\nbeta\n',
        old_start: 1,
        new_start: 1,
        is_summary: false,
      }],
      files: ['/tmp/example.md'],
    });

    expect(result).toEqual({
      output: '',
      statusMessage: 'File successfully overwritten. Current size: 71 bytes.',
      isError: false,
      returnedDiff: true,
      display: [{
        type: 'diff',
        path: '/tmp/example.md',
        oldText: '',
        newText: 'alpha\nbeta\n',
        oldStart: 1,
        newStart: 1,
        removedLines: 0,
        addedLines: 2,
        isSummary: false,
      }],
      files: ['/tmp/example.md'],
    });
  });

  it('sets returnedDiff false when no structured diff is present', () => {
    const result = normalizeKimiToolResult({
      is_error: false,
      output: 'done',
      display: [],
    });

    expect(result.returnedDiff).toBe(false);
    expect(result.display).toEqual([]);
  });

  it('ignores one terminal newline when counting changed lines', () => {
    expect(countChangedLines('')).toBe(0);
    expect(countChangedLines('a\nb')).toBe(2);
    expect(countChangedLines('a\nb\n')).toBe(2);
  });
});
