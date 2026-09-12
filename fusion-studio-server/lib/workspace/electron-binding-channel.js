'use strict';

const fs = require('fs');
const path = require('path');

const ELECTRON_BINDING_FD = 4;
const MAX_BINDING_FRAME_BYTES = 8192;

function createElectronWorkspaceBindingChannel({
  enabled = process.env.FUSION_ELECTRON_SERVER === '1',
  fd = ELECTRON_BINDING_FD,
  writeSync = fs.writeSync,
} = {}) {
  function publish(workspaceId, repoPath, bindingRevision) {
    if (!enabled) return false;
    const isClear = workspaceId === null && repoPath === null;
    if (!Number.isSafeInteger(bindingRevision) || bindingRevision < 1 || (!isClear && (
      typeof workspaceId !== 'string'
      || workspaceId.length === 0
      || Buffer.byteLength(workspaceId, 'utf8') > 256
      || /[\u0000-\u001f\u007f]/.test(workspaceId)
      || typeof repoPath !== 'string'
      || !path.isAbsolute(repoPath)
      || repoPath.includes('\0')
      || Buffer.byteLength(repoPath, 'utf8') > 4096
    ))) throw new Error('electron_workspace_binding_invalid');
    const frame = Buffer.from(`${JSON.stringify({
      version: 1, bindingRevision, workspaceId, repoPath,
    })}\n`, 'utf8');
    if (frame.length > MAX_BINDING_FRAME_BYTES) throw new Error('electron_workspace_binding_invalid');
    let offset = 0;
    while (offset < frame.length) {
      const written = writeSync(fd, frame, offset, frame.length - offset);
      if (!Number.isSafeInteger(written) || written <= 0) {
        throw new Error('electron_workspace_binding_unavailable');
      }
      offset += written;
    }
    return true;
  }

  return Object.freeze({ publish });
}

const channel = createElectronWorkspaceBindingChannel();

module.exports = {
  ELECTRON_BINDING_FD,
  MAX_BINDING_FRAME_BYTES,
  createElectronWorkspaceBindingChannel,
  publishElectronWorkspaceBinding: (workspaceId, repoPath, bindingRevision) => (
    channel.publish(workspaceId, repoPath, bindingRevision)
  ),
};
