'use strict';

const {
  createElectronWorkspaceBindingChannel,
  MAX_BINDING_FRAME_BYTES,
} = require('../../lib/workspace/electron-binding-channel');

describe('Electron workspace binding channel', () => {
  test('publishes one exact private frame with complete-write handling', () => {
    const chunks = [];
    const channel = createElectronWorkspaceBindingChannel({
      enabled: true,
      fd: 9,
      writeSync(_fd, bytes, offset, length) {
        const written = Math.min(length, 7);
        chunks.push(Buffer.from(bytes.subarray(offset, offset + written)));
        return written;
      },
    });
    expect(channel.publish('workspace-one', '/private/tmp/workspace-one', 1)).toBe(true);
    expect(JSON.parse(Buffer.concat(chunks).toString('utf8').trim())).toEqual({
      version: 1,
      bindingRevision: 1,
      workspaceId: 'workspace-one',
      repoPath: '/private/tmp/workspace-one',
    });
  });

  test('publishes the exact no-workspace clear and rejects invalid authority', () => {
    const frames = [];
    const channel = createElectronWorkspaceBindingChannel({
      enabled: true,
      writeSync(_fd, bytes, offset, length) {
        frames.push(Buffer.from(bytes.subarray(offset, offset + length)));
        return length;
      },
    });
    expect(channel.publish(null, null, 2)).toBe(true);
    expect(frames[0].length).toBeLessThanOrEqual(MAX_BINDING_FRAME_BYTES);
    expect(JSON.parse(frames[0].toString('utf8'))).toEqual({
      version: 1, bindingRevision: 2, workspaceId: null, repoPath: null,
    });
    expect(() => channel.publish('workspace-one', 'relative', 3)).toThrow('electron_workspace_binding_invalid');
    expect(() => channel.publish(null, '/private/tmp/forged', 3)).toThrow('electron_workspace_binding_invalid');
    expect(() => channel.publish('bad\nworkspace', '/private/tmp/workspace', 3)).toThrow('electron_workspace_binding_invalid');
    expect(() => channel.publish('workspace-one', '/private/tmp/workspace', 0)).toThrow('electron_workspace_binding_invalid');
  });

  test('standalone server mode has no inherited-channel effect', () => {
    const writeSync = jest.fn();
    const channel = createElectronWorkspaceBindingChannel({ enabled: false, writeSync });
    expect(channel.publish('workspace-one', '/private/tmp/workspace-one', 1)).toBe(false);
    expect(writeSync).not.toHaveBeenCalled();
  });
});
