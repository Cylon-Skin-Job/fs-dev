'use strict';

jest.mock('../../lib/workspace/workspace-controller', () => ({
  listWorkspaces: jest.fn(async () => []),
  getActiveWorkspaceId: jest.fn(() => null),
}));
jest.mock('../../lib/cli-config', () => ({
  resolveCliConfig: jest.fn(async () => ({})),
}));
jest.mock('../../lib/workspace/workspace-state', () => ({
  get: jest.fn(() => null),
}));
jest.mock('../../lib/workspace/ai-paths', () => ({
  getLocalMachineName: jest.fn(() => 'test-machine'),
  getSystemStylesRoot: jest.fn(() => '/unused'),
}));

const { buildWorkspaceInit } = require('../../lib/ws/connection-init');

describe('resource provenance protocol advertisement', () => {
  test('initial workspace bind advertises v1 with the captured pair', async () => {
    const message = await buildWorkspaceInit(() => null, {
      workspaceId: 'workspace-A',
      workspaceEpoch: '123e4567-e89b-42d3-a456-426614174000',
      repoPath: null,
    });

    expect(message).toMatchObject({
      type: 'workspace:init',
      workspaceId: 'workspace-A',
      workspaceEpoch: '123e4567-e89b-42d3-a456-426614174000',
      fileSaveProtocolVersion: 1,
      resourceProvenanceProtocolVersion: 1,
      agentActivityProtocolVersion: 1,
      fileViewerReadProtocolVersion: 1,
    });
  });
});
