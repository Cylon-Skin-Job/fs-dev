'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkSettingsBounce } = require('../lib/enforcement');

function symlinkDir(target, linkPath) {
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

function expectBounced(filePath) {
  expect(checkSettingsBounce('write_file', { file_path: filePath })).toEqual({
    message: expect.stringContaining('Cannot write to settings/ folders'),
  });
}

function expectAllowed(filePath) {
  expect(checkSettingsBounce('write_file', { file_path: filePath })).toBeNull();
}

function expectToolBounced(toolName, filePath) {
  expect(checkSettingsBounce(toolName, { file_path: filePath })).toEqual({
    message: expect.stringContaining('Cannot write to settings/ folders'),
  });
}

function makeFixture() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-enforcement-'));
  const workspace = path.join(tempRoot, 'workspace');
  const protectedDir = path.join(tempRoot, '.settings');
  const normalDir = path.join(tempRoot, 'normal');

  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(protectedDir, { recursive: true });
  fs.mkdirSync(normalDir, { recursive: true });
  fs.writeFileSync(path.join(protectedDir, 'existing.txt'), 'protected\n', 'utf8');
  fs.writeFileSync(path.join(normalDir, 'existing.txt'), 'normal\n', 'utf8');

  symlinkDir(protectedDir, path.join(workspace, 'linked-protected'));
  symlinkDir(normalDir, path.join(workspace, 'linked-normal'));
  symlinkDir(path.join(tempRoot, 'missing-target'), path.join(workspace, 'broken-link'));

  return {
    tempRoot,
    workspace,
    protectedDir,
    normalDir,
  };
}

describe('settings write-lock enforcement', () => {
  let fixture;

  beforeEach(() => {
    fixture = makeFixture();
  });

  afterEach(() => {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  });

  test('direct write into protected folder bounces', () => {
    expectBounced(path.join(fixture.protectedDir, 'existing.txt'));
    expectBounced(path.join(fixture.tempRoot, 'settings', 'new.txt'));
  });

  test('canonical and legacy write tool names bounce', () => {
    const protectedPath = path.join('settings', 'new-file.txt');
    expectToolBounced('write_file', protectedPath);
    expectToolBounced('edit_file', protectedPath);
    expectToolBounced('write', protectedPath);
    expectToolBounced('edit', protectedPath);
  });

  test('canonical write/edit path argument shapes bounce', () => {
    expect(checkSettingsBounce('write', {
      filePath: path.join('settings', 'config.json'),
    })).toEqual({
      message: expect.stringContaining('Cannot write to settings/ folders'),
    });
    expect(checkSettingsBounce('edit', {
      path: path.join('.settings', 'config.json'),
    })).toEqual({
      message: expect.stringContaining('Cannot write to settings/ folders'),
    });
  });

  test('write via symlink to protected folder bounces', () => {
    expectBounced(path.join(fixture.workspace, 'linked-protected', 'existing.txt'));
  });

  test('write via symlink to normal folder is allowed', () => {
    expectAllowed(path.join(fixture.workspace, 'linked-normal', 'existing.txt'));
  });

  test('new-file path under symlink to protected folder bounces by deepest existing ancestor', () => {
    expectBounced(path.join(fixture.workspace, 'linked-protected', 'new-file.txt'));
  });

  test('relative settings path bounces by logical segment', () => {
    expectBounced(path.join('settings', 'new-file.txt'));
    expectBounced(path.join('.settings', 'new-file.txt'));
  });

  test('relative path through symlink to protected folder bounces from current directory', () => {
    const previousCwd = process.cwd();
    process.chdir(fixture.workspace);
    try {
      expectBounced(path.join('linked-protected', 'new-file.txt'));
      expectAllowed(path.join('linked-normal', 'new-file.txt'));
    } finally {
      process.chdir(previousCwd);
    }
  });

  test('relative path through symlink uses supplied workspace root, not process cwd', () => {
    expectBounced(path.join(fixture.workspace, 'linked-protected', 'new-file.txt'));
    expectAllowed(path.join(fixture.workspace, 'linked-normal', 'new-file.txt'));

    expect(checkSettingsBounce('write_file', {
      file_path: path.join('linked-protected', 'new-file.txt'),
    }, fixture.workspace)).toEqual({
      message: expect.stringContaining('Cannot write to settings/ folders'),
    });
    expect(checkSettingsBounce('write_file', {
      file_path: path.join('linked-normal', 'new-file.txt'),
    }, fixture.workspace)).toBeNull();
  });

  test('broken link falls back to the logical path verdict', () => {
    expectAllowed(path.join(fixture.workspace, 'broken-link', 'new-file.txt'));
    expectBounced(path.join(fixture.workspace, 'broken-link', 'settings', 'new-file.txt'));
  });
});
