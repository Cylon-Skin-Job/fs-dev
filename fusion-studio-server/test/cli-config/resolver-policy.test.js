const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const { resolveCliConfig, resolveCliPolicy } = require('../../lib/cli-config');
const aiPaths = require('../../lib/workspace/ai-paths');

async function writeCliConfig(projectRoot, config) {
  const file = path.join(aiPaths.getSystemConfigRoot(projectRoot), 'cli.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(config)}\n`);
}

describe('cli-config policy resolver', () => {
  let projectRoot;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-policy-'));
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('falls back to OpenCode-only when cli.json is missing', async () => {
    const policy = await resolveCliPolicy(projectRoot);
    const config = await resolveCliConfig(projectRoot);

    expect(policy.defaultHarness).toBe('opencode');
    expect(policy.allowedHarnesses).toEqual(['opencode']);
    expect(Object.keys(config)).toEqual(['opencode']);
  });

  it('treats empty config as OpenCode-only, not full catalog', async () => {
    await writeCliConfig(projectRoot, {});

    const config = await resolveCliConfig(projectRoot);

    expect(Object.keys(config)).toEqual(['opencode']);
  });

  it('includes only listed and enabled harnesses', async () => {
    await writeCliConfig(projectRoot, {
      defaultHarness: 'opencode',
      harnesses: {
        opencode: { enabled: true, order: 0 },
        kimi: { enabled: false },
      },
    });

    const policy = await resolveCliPolicy(projectRoot);
    const config = await resolveCliConfig(projectRoot);

    expect(policy.defaultHarness).toBe('opencode');
    expect(policy.allowedHarnesses).toEqual(['opencode']);
    expect(config.kimi).toBeUndefined();
  });

  it('supports legacy direct-object shorthand narrowly', async () => {
    await writeCliConfig(projectRoot, {
      opencode: { enabled: true },
      kimi: { enabled: false },
    });

    const policy = await resolveCliPolicy(projectRoot);

    expect(policy.defaultHarness).toBe('opencode');
    expect(policy.allowedHarnesses).toEqual(['opencode']);
  });

  it('keeps OpenCode model and thinking as runtime policy', async () => {
    await writeCliConfig(projectRoot, {
      defaultHarness: 'opencode',
      harnesses: {
        opencode: {
          enabled: true,
          model: 'kimi-for-coding/k2p7',
          thinking: true,
        },
      },
    });

    const policy = await resolveCliPolicy(projectRoot);

    expect(policy.config.opencode.details.model).toBe('kimi-for-coding/k2p7');
    expect(policy.config.opencode.runtime).toEqual({
      model: 'kimi-for-coding/k2p7',
      thinking: true,
    });
  });
});
