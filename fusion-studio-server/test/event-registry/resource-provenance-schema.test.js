'use strict';

const definition = require('../../lib/event-registry/schemas/resource-provenance-v1.json');
const { createPayloadValidator } = require('../../lib/event-registry/schema-validator');

const id = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const validate = createPayloadValidator(definition, 'resource:provenance');

function item(snapshot) {
  return {
    eventId: id(1), eventType: 'resource.mutated', occurredAt: 20, acceptedAt: 10,
    operationId: id(2), commandId: id(3), commandAcceptedEventId: id(4),
    resourceId: id(5), fileVersionId: id(6), mutationKind: 'modify',
    canonicalPath: 'docs/a.md', ingress: { panel: 'file-viewer', path: 'docs/a.md' },
    origin: { kind: 'local_client', assurance: 'transport_only', connectionId: 'connection-1' },
    snapshot,
  };
}

describe('resource:provenance@1 locked schema', () => {
  test('accepts exact request/result/error branches and both snapshot discriminants', () => {
    expect(validate({
      type: 'resource:provenance:query', version: 1, requestId: 'request-1',
      workspaceId: 'workspace-1', workspaceEpoch: id(7), panel: 'file-viewer',
      path: 'docs/a.md', fileName: 'a.md', folderPrefix: '', operationId: id(2), since: 0, limit: 200,
    }).valid).toBe(true);
    expect(validate({
      type: 'resource:provenance:result', version: 1, requestId: 'request-1',
      workspaceId: 'workspace-1', workspaceEpoch: id(7),
      items: [
        item({ kind: 'bytes', sha256: 'a'.repeat(64), byteLength: 3, capturedAt: 9 }),
        item({ kind: 'absent', byteLength: 0, capturedAt: 9 }),
      ],
    }).valid).toBe(true);
    for (const error of [
      { type: 'resource:provenance:error', version: 1, code: 'invalid_request' },
      { type: 'resource:provenance:error', version: 1, code: 'invalid_request', requestId: 'request-1' },
      { type: 'resource:provenance:error', version: 1, code: 'workspace_unavailable', requestId: 'request-1' },
      { type: 'resource:provenance:error', version: 1, code: 'stale_workspace', requestId: 'request-1', workspaceId: 'workspace-1', workspaceEpoch: id(7) },
      { type: 'resource:provenance:error', version: 1, code: 'query_failed', requestId: 'request-1', workspaceId: 'workspace-1', workspaceEpoch: id(7) },
    ]) expect(validate(error).valid).toBe(true);
  });

  test('rejects unknown fields, malformed selectors, and invalid snapshot discriminants', () => {
    const base = {
      type: 'resource:provenance:result', version: 1, requestId: 'request-1',
      workspaceId: 'workspace-1', workspaceEpoch: id(7),
    };
    const invalid = [
      { type: 'resource:provenance:query', version: 1, requestId: 'request-1', workspaceId: 'workspace-1', workspaceEpoch: id(7), unknown: true },
      { type: 'resource:provenance:query', version: 1, requestId: 'request-1', workspaceId: 'workspace-1', workspaceEpoch: id(7), fileName: '../a.md' },
      { type: 'resource:provenance:query', version: 1, requestId: 'request-1', workspaceId: 'workspace-1', workspaceEpoch: id(7), fileName: '.' },
      { type: 'resource:provenance:query', version: 1, requestId: 'request-1', workspaceId: 'workspace-1', workspaceEpoch: id(7), fileName: '..' },
      { type: 'resource:provenance:query', version: 1, requestId: 'request-1', workspaceId: 'workspace-1', workspaceEpoch: id(7), since: Number.MAX_SAFE_INTEGER + 1 },
      { type: 'resource:provenance:query', version: 1, requestId: 'request-1', workspaceId: 'workspace-1', workspaceEpoch: id(7), since: 1e20 },
      { ...base, items: [item({ kind: 'bytes', byteLength: 3, capturedAt: 9 })] },
      { ...base, items: [item({ kind: 'bytes', sha256: 'A'.repeat(64), byteLength: 3, capturedAt: 9 })] },
      { ...base, items: [item({ kind: 'absent', sha256: 'a'.repeat(64), byteLength: 0, capturedAt: 9 })] },
      { ...base, items: [item({ kind: 'absent', byteLength: 1, capturedAt: 9 })] },
    ];
    for (const value of invalid) expect(validate(value).valid).toBe(false);
  });
});
