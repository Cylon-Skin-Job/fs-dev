'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const pathService = require('../../lib/workspace/path-service');

describe('workspace path service', () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'Fusion-Workspace-Path-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('canonicalize preserves the exact filesystem path spelling', () => {
    const exactPath = fs.realpathSync(tempRoot);
    const inputPath = process.platform === 'darwin' ? exactPath.toLowerCase() : exactPath;

    expect(pathService.canonicalize(inputPath)).toBe(exactPath);
  });

  test('comparisonKey folds case only on macOS', () => {
    const exactPath = '/Users/Example/Project';
    const expected = process.platform === 'darwin'
      ? '/users/example/project'
      : exactPath;

    expect(pathService.comparisonKey(exactPath)).toBe(expected);
  });
});
