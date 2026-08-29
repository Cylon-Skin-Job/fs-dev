'use strict';

const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
  normalizeRouteAttachments,
} = require('../../lib/thread/canonical-drain-context');

function makeRouteInput(overrides = {}) {
  return {
    workspaceId: 'ws-1',
    workspace: 'workspace:ws-1',
    projectRoot: '/tmp/project',
    scope: 'project',
    threadId: 'thread-1',
    acceptedUserInput: 'hello',
    attachments: [
      {
        kind: 'file',
        label: 'a.txt',
        path: '/tmp/a.txt',
        sourceName: 'a.txt',
        panel: 'explorer',
        relativePath: 'a.txt',
      },
      { path: '/tmp/b.txt' },
    ],
    ...overrides,
  };
}

describe('canonical drain context', () => {
  describe('createCanonicalRouteContext', () => {
    test('deep-copies attachments and recursively freezes plain data', () => {
      const context = createCanonicalRouteContext(makeRouteInput());

      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(context.attachments)).toBe(true);
      context.attachments.forEach((attachment) => {
        expect(Object.isFrozen(attachment)).toBe(true);
      });
    });

    test('mutating the source attachments after creation does not affect the context', () => {
      const input = makeRouteInput();
      const context = createCanonicalRouteContext(input);

      input.attachments.shift();
      input.attachments[0].path = '/tmp/hacked';
      input.attachments.push({ path: '/tmp/evil' });

      expect(context.attachments).toEqual([
        {
          kind: 'file',
          label: 'a.txt',
          path: '/tmp/a.txt',
          sourceName: 'a.txt',
          panel: 'explorer',
          relativePath: 'a.txt',
        },
        { kind: 'file', label: 'attachment', path: '/tmp/b.txt', sourceName: 'attachment' },
      ]);
    });

    test('frozen fields reject later mutation attempts', () => {
      const context = createCanonicalRouteContext(makeRouteInput());

      expect(() => { context.acceptedUserInput = 'changed'; }).toThrow(TypeError);
      expect(() => { context.attachments.pop(); }).toThrow(TypeError);
      expect(() => { context.attachments[0].path = 'changed'; }).toThrow(TypeError);

      expect(context.acceptedUserInput).toBe('hello');
      expect(context.attachments).toHaveLength(2);
      expect(context.attachments[0].path).toBe('/tmp/a.txt');
    });

    test('normalizes attachments like the controller: defaults, optional strings, drops no-path items', () => {
      const context = createCanonicalRouteContext(makeRouteInput({
        attachments: [
          { path: '/tmp/bare' },
          { kind: 'image', label: 'pic.png', path: '/tmp/pic.png', panel: 'composer', relativePath: 'pics/pic.png' },
          { label: 'no path' },
          null,
          'junk',
        ],
      }));

      expect(context.attachments).toEqual([
        { kind: 'file', label: 'attachment', path: '/tmp/bare', sourceName: 'attachment' },
        {
          kind: 'image',
          label: 'pic.png',
          path: '/tmp/pic.png',
          sourceName: 'pic.png',
          panel: 'composer',
          relativePath: 'pics/pic.png',
        },
      ]);
    });

    test('throws on garbage input', () => {
      expect(() => createCanonicalRouteContext(makeRouteInput({ workspaceId: '' }))).toThrow(/workspaceId/);
      expect(() => createCanonicalRouteContext(makeRouteInput({ workspaceId: 42 }))).toThrow(/workspaceId/);
      expect(() => createCanonicalRouteContext(makeRouteInput({ threadId: null }))).toThrow(/threadId/);
      expect(() => createCanonicalRouteContext(makeRouteInput({ acceptedUserInput: undefined }))).toThrow(/acceptedUserInput/);
      expect(() => createCanonicalRouteContext(makeRouteInput({ scope: 'view' }))).toThrow(/project/);
      expect(() => createCanonicalRouteContext()).toThrow();
    });
  });

  describe('createCanonicalDrainControl', () => {
    function makeControlInput(overrides = {}) {
      return {
        drainId: 'drain-1',
        runtimeKey: { workspaceId: 'ws-1', scope: 'project', threadId: 'thread-1' },
        touchThreadSession: jest.fn(),
        stopHarness: jest.fn(async () => {}),
        ...overrides,
      };
    }

    test('returns a frozen capability that delegates to the injected callables', async () => {
      const input = makeControlInput();
      const control = createCanonicalDrainControl(input);

      expect(Object.isFrozen(control)).toBe(true);
      expect(control.drainId).toBe('drain-1');
      expect(control.runtimeKey).toEqual({ workspaceId: 'ws-1', scope: 'project', threadId: 'thread-1' });

      control.touchThreadSession();
      await control.stopHarness();

      expect(input.touchThreadSession).toHaveBeenCalledTimes(1);
      expect(input.stopHarness).toHaveBeenCalledTimes(1);
    });

    test('is non-serializable: JSON.stringify drops the callback properties entirely', () => {
      const control = createCanonicalDrainControl(makeControlInput());
      const serialized = JSON.stringify(control);

      expect(serialized).not.toContain('touchThreadSession');
      expect(serialized).not.toContain('stopHarness');

      const parsed = JSON.parse(serialized);
      Object.values(parsed).forEach((value) => {
        expect(typeof value).not.toBe('function');
      });
    });

    test('snapshots the runtimeKey so later caller mutation cannot rewrite route identity', () => {
      const runtimeKey = { workspaceId: 'ws-1', scope: 'project', threadId: 'thread-1' };
      const control = createCanonicalDrainControl(makeControlInput({ runtimeKey }));

      runtimeKey.threadId = 'thread-2';

      expect(control.runtimeKey.threadId).toBe('thread-1');
      expect(Object.isFrozen(control.runtimeKey)).toBe(true);
    });

    test('propagates the wrapped stopHarness promise', async () => {
      const stopHarness = jest.fn(async () => 'stopped');
      const control = createCanonicalDrainControl(makeControlInput({ stopHarness }));

      await expect(control.stopHarness()).resolves.toBe('stopped');
    });

    test('throws on garbage input', () => {
      expect(() => createCanonicalDrainControl(makeControlInput({ drainId: '' }))).toThrow(/drainId/);
      expect(() => createCanonicalDrainControl(makeControlInput({ drainId: 7 }))).toThrow(/drainId/);
      expect(() => createCanonicalDrainControl(makeControlInput({ runtimeKey: null }))).toThrow(/runtimeKey/);
      expect(() => createCanonicalDrainControl(makeControlInput({ runtimeKey: [] }))).toThrow(/runtimeKey/);
      expect(() => createCanonicalDrainControl(makeControlInput({ touchThreadSession: 'x' }))).toThrow(/touchThreadSession/);
      expect(() => createCanonicalDrainControl(makeControlInput({ stopHarness: null }))).toThrow(/stopHarness/);
      expect(() => createCanonicalDrainControl(undefined)).toThrow();
    });
  });

  describe('normalizeRouteAttachments', () => {
    test('non-array input yields an empty array', () => {
      expect(normalizeRouteAttachments(undefined)).toEqual([]);
      expect(normalizeRouteAttachments(null)).toEqual([]);
      expect(normalizeRouteAttachments('nope')).toEqual([]);
    });
  });
});
