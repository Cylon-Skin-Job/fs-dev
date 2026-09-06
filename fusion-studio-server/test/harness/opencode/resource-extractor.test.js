'use strict';

const { extractOpenCodeCandidates } = require('../../../lib/harness/opencode/resource-extractor');
const { normalizeCandidate } = require('../../../lib/agent-provenance/values');

const ROOT = '/workspace/root';

function extract(command) {
  return extractOpenCodeCandidates({
    nativeToolName: 'bash',
    args: { command },
    canonicalRoot: ROOT,
  });
}

describe('OpenCode v1 resource extractor', () => {
  test.each([
    ['cat -- a b', [['a', 'read'], ['b', 'read']]],
    ['cat -- -a', [['-a', 'read']]],
    ['head a', [['a', 'read']]],
    ['tail a', [['a', 'read']]],
    ['wc a', [['a', 'read']]],
    ['stat a', [['a', 'read']]],
    ['file a', [['a', 'read']]],
    ['grep -- needle a', [['a', 'read']]],
    ['grep -- -needle -a', [['-a', 'read']]],
    ['rg needle a', [['a', 'read']]],
    ['touch a', [['a', 'write']]],
    ['truncate -s 0 -- a', [['a', 'write']]],
    ['truncate --size 12 a', [['a', 'write']]],
    ['rm -- a', [['a', 'delete']]],
    ['unlink a', [['a', 'delete']]],
    ['tee -a -- a', [['a', 'write']]],
    ['cp source target', [['source', 'read'], ['target', 'write']]],
    ['cp -- -source -target', [['-source', 'read'], ['-target', 'write']]],
    ['mv source target', [['source', 'move_from'], ['target', 'move_to']]],
  ])('extracts exact known grammar: %s', (command, expected) => {
    const result = extract(command);
    expect(result.candidates.map((item) => [item.canonicalPath, item.accessKind])).toEqual(expected);
  });

  test('orders redirections before operands and preserves dual-role redirection', () => {
    const result = extract('cp <input <>duplex source target >output');
    expect(result.candidates.map((item) => [item.canonicalPath, item.accessFamily, item.extractionBasis])).toEqual([
      ['input', 'read', 'shell_input_redirection'],
      ['duplex', 'read', 'shell_input_redirection'],
      ['duplex', 'write', 'shell_output_redirection'],
      ['output', 'write', 'shell_output_redirection'],
      ['source', 'read', 'shell_known_operand'],
      ['target', 'write', 'shell_known_operand'],
    ]);
    expect(extract('cat input >"output file"').candidates.map(item => item.canonicalPath))
      .toEqual(['output file', 'input']);
    expect(extract('cat input > "other output"').candidates.map(item => item.canonicalPath))
      .toEqual(['other output', 'input']);
  });

  test('accepts whole quoted Unicode paths and multiple literal segments', () => {
    const result = extract("cat 'folder/é file.txt'; touch \"other file.txt\"");
    expect(result.candidates.map((item) => item.canonicalPath)).toEqual(['folder/é file.txt', 'other file.txt']);
  });

  test.each([
    'head -n 2 file', 'grep -e p file', 'cp -R a b', 'sed -i file', '/bin/cat file',
    'env cat file', 'sudo cat file', 'command cat file', 'bash -c "cat file"',
    '"cat" file',
    'npm run thing', 'node x.js', 'python3 x.py', 'cat $FILE', 'cat `pwd`',
    'cat *.txt', 'cat foo\\ bar', 'cat foo&touch bar', 'cat <&0 file', 'cat <<EOF',
    'cat foo > <victim', 'cat foo <> >victim',
    'cat "a"b', 'cat (a)', `cat a${String.fromCharCode(0x7f)}b`,
    'cat "a\\ b"', 'cat "a\tb"', 'cat "a\nb"',
  ])('ignores unsupported or dynamic form: %s', (command) => {
    expect(extract(command).candidates).toEqual([]);
  });

  test('deduplicates by exact role/basis and saturates at the 65th unique candidate', () => {
    const sixtyFour = Array.from({ length: 64 }, (_, index) => `f${index}`).join(' ');
    expect(extract(`cat ${sixtyFour}`).retainedCount).toBe(64);
    const capped = extract(`cat ${sixtyFour} f64 f65`);
    expect(capped).toMatchObject({ reportedCount: 65, retainedCount: 64, truncated: true });
    expect(capped.candidates.at(-1).canonicalPath).toBe('f63');
    const duplicate = extract('cp x x');
    expect(duplicate.candidates.map((item) => item.accessFamily)).toEqual(['read', 'write']);
  });

  test('structured aliases are exact and only the allowlisted native tools extract', () => {
    const diagnostics = [];
    const run = (nativeToolName, args) => extractOpenCodeCandidates({
      nativeToolName, args, canonicalRoot: ROOT, onDiagnostic: (code) => diagnostics.push(code),
    });
    expect(run('read', { filePath: 'a' }).candidates[0]).toMatchObject({ canonicalPath: 'a', accessFamily: 'read' });
    expect(run('edit', { file_path: 'a' }).candidates[0]).toMatchObject({ canonicalPath: 'a', accessFamily: 'write' });
    expect(run('write', { filePath: 'a', file_path: 'a' }).retainedCount).toBe(1);
    expect(run('write', { filePath: 'a', file_path: 'b' }).retainedCount).toBe(0);
    expect(run('grep', { filePath: 'a' }).retainedCount).toBe(0);
    expect(diagnostics).toEqual(['agent_tool_structured_path_invalid']);
  });

  test.each([
    ['a//./b/../c.txt', { canonicalPath: 'a/c.txt' }],
    ['/workspace/root/a.txt', { canonicalPath: 'a.txt' }],
    ['/workspace/root-ab/a.txt', { reason: 'outside_workspace' }],
    ['../outside.txt', { reason: 'outside_workspace' }],
    ['/', { reason: 'outside_workspace' }],
    ['/workspace/root', { reason: 'invalid_path' }],
    ['missing/parent/file.txt', { canonicalPath: 'missing/parent/file.txt' }],
    ['possible-symlink/final', { canonicalPath: 'possible-symlink/final' }],
  ])('applies purely lexical captured-root admission for %s', (filePath, expected) => {
    const result = extractOpenCodeCandidates({
      nativeToolName: 'read', args: { filePath }, canonicalRoot: ROOT,
    });
    expect(result.candidates[0]).toMatchObject(expected);
  });

  test('an over-bound structured path becomes one fingerprint-only invalid edge', () => {
    const raw = 'a'.repeat(4_097);
    const result = extractOpenCodeCandidates({ nativeToolName: 'write', args: { filePath: raw }, canonicalRoot: ROOT });
    expect(result).toMatchObject({ reportedCount: 1, retainedCount: 1, truncated: false });
    expect(result.candidates[0]).toMatchObject({ reason: 'invalid_path', accessFamily: 'write' });
    expect(result.candidates[0]).not.toHaveProperty('canonicalPath');
    expect(result.candidates[0].candidateSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  test('identical and suffix-different over-cap paths share the same bounded normalized record', () => {
    const chargedPrefix = 'a'.repeat(4_097);
    const first = extractOpenCodeCandidates({
      nativeToolName: 'write', args: { filePath: `${chargedPrefix}X` }, canonicalRoot: ROOT,
    }).candidates[0];
    const replay = extractOpenCodeCandidates({
      nativeToolName: 'write', args: { filePath: `${chargedPrefix}X` }, canonicalRoot: ROOT,
    }).candidates[0];
    const suffixDifferent = extractOpenCodeCandidates({
      nativeToolName: 'write', args: { filePath: `${chargedPrefix}Y` }, canonicalRoot: ROOT,
    }).candidates[0];
    const normalize = candidate => normalizeCandidate({
      ...candidate,
      edgeId: '11111111-1111-4111-8111-111111111111',
    }, 0);

    expect(normalize(replay)).toEqual(normalize(first));
    expect(normalize(suffixDifferent)).toEqual(normalize(first));
    expect(normalize(first)).not.toHaveProperty('candidateValue');
  });

  test('rejects over-bound shell input without evaluating or retaining candidates', () => {
    const diagnostics = [];
    const result = extractOpenCodeCandidates({
      nativeToolName: 'bash', args: { command: `cat ${'a'.repeat(65_536)}` }, canonicalRoot: ROOT,
      onDiagnostic: (code) => diagnostics.push(code),
    });
    expect(result).toMatchObject({ reportedCount: 0, retainedCount: 0, truncated: false });
    expect(diagnostics).toEqual(['agent_tool_shell_input_invalid']);
  });
});
