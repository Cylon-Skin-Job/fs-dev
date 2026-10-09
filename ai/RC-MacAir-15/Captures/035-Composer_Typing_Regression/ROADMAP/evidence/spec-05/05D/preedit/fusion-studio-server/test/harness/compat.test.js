/**
 * Compatibility layer tests.
 *
 * Slice M: Legacy and parallel runtime modes have been retired.
 * Only the direct harness path ('new') remains valid.
 */

const {
  getHarnessMode,
  setThreadMode,
  clearThreadMode,
  setGlobalMode,
  resetOverrides,
  shouldUseNewHarness,
  isParallelMode,
  getFlagStatus
} = require('../../lib/harness/feature-flags');

describe('Feature Flags', () => {
  const originalEnv = process.env.HARNESS_MODE;

  beforeEach(() => {
    resetOverrides();
    delete process.env.HARNESS_MODE;
  });

  afterEach(() => {
    resetOverrides();
    process.env.HARNESS_MODE = originalEnv;
  });

  describe('getHarnessMode', () => {
    it('defaults to new when no flags set', () => {
      expect(getHarnessMode()).toBe('new');
    });

    it('reads from environment variable', () => {
      process.env.HARNESS_MODE = 'new';
      expect(getHarnessMode()).toBe('new');
    });

    it('ignores invalid environment values', () => {
      process.env.HARNESS_MODE = 'invalid';
      expect(getHarnessMode()).toBe('new');
    });

    it('treats legacy env value as invalid (defaults to new)', () => {
      process.env.HARNESS_MODE = 'legacy';
      expect(getHarnessMode()).toBe('new');
    });

    it('treats parallel env value as invalid (defaults to new)', () => {
      process.env.HARNESS_MODE = 'parallel';
      expect(getHarnessMode()).toBe('new');
    });

    it('thread override takes precedence over env', () => {
      process.env.HARNESS_MODE = 'new';
      setThreadMode('thread-1', 'new');

      expect(getHarnessMode('thread-1')).toBe('new');
      expect(getHarnessMode('thread-2')).toBe('new');
    });

    it('thread override takes precedence over global', () => {
      setGlobalMode('new');
      setThreadMode('thread-1', 'new');

      expect(getHarnessMode('thread-1')).toBe('new');
      expect(getHarnessMode('thread-2')).toBe('new');
    });
  });

  describe('shouldUseNewHarness', () => {
    it('always returns true after legacy retirement', () => {
      expect(shouldUseNewHarness()).toBe(true);
    });

    it('ignores legacy env value and returns true', () => {
      process.env.HARNESS_MODE = 'legacy';
      expect(shouldUseNewHarness()).toBe(true);
    });

    it('ignores parallel env value and returns true', () => {
      process.env.HARNESS_MODE = 'parallel';
      expect(shouldUseNewHarness()).toBe(true);
    });

    it('respects thread overrides (always new)', () => {
      process.env.HARNESS_MODE = 'new';
      setThreadMode('thread-1', 'new');

      expect(shouldUseNewHarness('thread-1')).toBe(true);
      expect(shouldUseNewHarness('thread-2')).toBe(true);
    });
  });

  describe('isParallelMode', () => {
    it('always returns false after parallel retirement', () => {
      process.env.HARNESS_MODE = 'parallel';
      expect(isParallelMode()).toBe(false);

      process.env.HARNESS_MODE = 'new';
      expect(isParallelMode()).toBe(false);
    });
  });

  describe('setThreadMode', () => {
    it('sets mode for a specific thread', () => {
      setThreadMode('thread-abc', 'new');
      expect(getHarnessMode('thread-abc')).toBe('new');
    });

    it('throws on invalid mode', () => {
      expect(() => setThreadMode('thread-1', 'invalid')).toThrow();
    });

    it('throws on retired legacy mode', () => {
      expect(() => setThreadMode('thread-1', 'legacy')).toThrow();
    });

    it('throws on retired parallel mode', () => {
      expect(() => setThreadMode('thread-1', 'parallel')).toThrow();
    });
  });

  describe('setGlobalMode', () => {
    it('sets global override', () => {
      setGlobalMode('new');
      expect(getHarnessMode()).toBe('new');
    });

    it('clears override when set to null', () => {
      setGlobalMode('new');
      expect(getHarnessMode()).toBe('new');

      setGlobalMode(null);
      expect(getHarnessMode()).toBe('new');
    });

    it('throws on invalid mode', () => {
      expect(() => setGlobalMode('invalid')).toThrow();
    });

    it('throws on retired legacy mode', () => {
      expect(() => setGlobalMode('legacy')).toThrow();
    });

    it('throws on retired parallel mode', () => {
      expect(() => setGlobalMode('parallel')).toThrow();
    });
  });

  describe('clearThreadMode', () => {
    it('clears thread-specific override', () => {
      setThreadMode('thread-1', 'new');
      expect(getHarnessMode('thread-1')).toBe('new');

      clearThreadMode('thread-1');
      expect(getHarnessMode('thread-1')).toBe('new');
    });
  });

  describe('resetOverrides', () => {
    it('clears all overrides', () => {
      setGlobalMode('new');
      setThreadMode('thread-1', 'new');

      resetOverrides();

      expect(getHarnessMode()).toBe('new');
      expect(getHarnessMode('thread-1')).toBe('new');
    });
  });

  describe('getFlagStatus', () => {
    it('returns complete flag status', () => {
      process.env.HARNESS_MODE = 'new';
      setThreadMode('thread-1', 'new');

      const status = getFlagStatus();

      expect(status.environment).toBe('new');
      expect(status.effectiveMode).toBe('new');
      expect(status.threadOverrides['thread-1']).toBe('new');
    });
  });
});

describe('Spawn Behavior', () => {
  // Integration tests would go here
  // These require actual kimi CLI to be available

  it.skip('new mode spawns via harness', async () => {
    // TODO: Implement once harness is ready
  });
});
