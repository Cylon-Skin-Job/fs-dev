'use strict';

const aiPaths = require('../../lib/workspace/ai-paths');

function createFakeConfigDb(initial = {}) {
  const rows = { ...initial };
  return Object.assign(
    function db(tableName) {
      expect(tableName).toBe('system_config');
      const query = {
        key: null,
        where(column, value) {
          expect(column).toBe('key');
          this.key = value;
          return this;
        },
        async first() {
          if (!Object.prototype.hasOwnProperty.call(rows, this.key)) return undefined;
          return { key: this.key, value: rows[this.key] };
        },
        insert(payload) {
          return {
            onConflict(conflictKey) {
              expect(conflictKey).toBe('key');
              return {
                async merge() {
                  rows[payload.key] = payload.value;
                },
                async ignore() {
                  if (!Object.prototype.hasOwnProperty.call(rows, payload.key)) {
                    rows[payload.key] = payload.value;
                  }
                },
              };
            },
          };
        },
      };
      return query;
    },
    { rows }
  );
}

describe('ai path helpers', () => {
  const oldEnv = process.env.FUSION_LOCAL_MACHINE;

  afterEach(() => {
    if (oldEnv === undefined) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = oldEnv;
    }
  });

  test('sanitizes machine names for filesystem folders', () => {
    expect(aiPaths.sanitizeMachineName(' RC Test Mac!! ')).toBe('RC-Test-Mac');
    expect(aiPaths.sanitizeMachineName('')).toBe('local-machine');
  });

  test('initializes and caches local machine identity from system_config', async () => {
    delete process.env.FUSION_LOCAL_MACHINE;
    const db = createFakeConfigDb({
      [aiPaths.LOCAL_MACHINE_CONFIG_KEY]: 'Studio Machine',
    });

    await expect(aiPaths.initializeLocalMachineIdentity({ db })).resolves.toBe('Studio-Machine');
    expect(db.rows[aiPaths.LOCAL_MACHINE_CONFIG_KEY]).toBe('Studio-Machine');
    expect(aiPaths.getLocalMachineName()).toBe('Studio-Machine');
  });

  test('environment override wins over cached identity', async () => {
    const db = createFakeConfigDb({
      [aiPaths.LOCAL_MACHINE_CONFIG_KEY]: 'Cached-Machine',
    });
    await aiPaths.initializeLocalMachineIdentity({ db });

    process.env.FUSION_LOCAL_MACHINE = 'Env Machine';
    expect(aiPaths.getLocalMachineName()).toBe('Env-Machine');
  });
});
