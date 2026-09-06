'use strict';

const {
  FIXTURES,
  createAgentToolFixtureRoute,
} = require('../../lib/testing/agent-tool-fixture-route');

test('agent fixture route is production-inert and exposes only the closed scenario catalog', () => {
  expect(createAgentToolFixtureRoute({ enabled: false })).toBeNull();
  expect(Object.keys(FIXTURES)).toEqual([
    'edit-first-a',
    'edit-return-a',
    'read-a',
    'error-partial',
    'interrupt-partial',
    'read-absent-first',
    'read-absent-unchanged',
  ]);
  expect(FIXTURES['read-a']).toMatchObject({ nativeTool: 'read', mutation: 'none' });
  expect(FIXTURES['error-partial']).toMatchObject({ nativeTool: 'edit', status: 'error' });
  expect(FIXTURES['interrupt-partial']).toMatchObject({ status: 'interrupted' });
  expect(Object.isFrozen(FIXTURES)).toBe(true);
});

test('enabled fixture route requires isolated database and ownership nonce', () => {
  expect(() => createAgentToolFixtureRoute({ enabled: true }))
    .toThrow('fixture route requires the isolated database');
  expect(() => createAgentToolFixtureRoute({ enabled: true, db: () => {} }))
    .toThrow('fixture route requires the isolated ownership nonce');
});
