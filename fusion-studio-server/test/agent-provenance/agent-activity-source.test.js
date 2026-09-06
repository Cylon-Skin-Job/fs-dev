'use strict';

const fs = require('fs');
const path = require('path');
const definition = require('../../lib/event-registry/schemas/agent-activity-v1.json');

describe('agent activity public-source boundaries', () => {
  test('response schema and query projection have no raw detail or snapshot-byte surface', () => {
    expect(definition.$defs.toolItem.properties).not.toHaveProperty('arguments');
    expect(definition.$defs.toolItem.properties).not.toHaveProperty('result');
    expect(definition.$defs.edgeItem.properties).not.toHaveProperty('bytes');
    expect(definition.$defs.snapshotBytes.properties).not.toHaveProperty('bytes');

    const repositorySource = fs.readFileSync(path.join(
      __dirname, '../../lib/agent-provenance/query-repository.js',
    ), 'utf8');
    const routeSource = fs.readFileSync(path.join(__dirname, '../../lib/ws/agent-activity-route.js'), 'utf8');
    expect(repositorySource).not.toContain('agent_snapshot_blobs');
    expect(repositorySource).not.toMatch(/\b(?:arguments|result|bytes)\s*:/u);
    expect(repositorySource).not.toMatch(/\.(?:arguments|result|bytes)\b/u);
    expect(routeSource).not.toMatch(/console\.(?:log|warn|error)/u);
  });
});
