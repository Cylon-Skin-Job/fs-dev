const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const { resolveCliConfig, resolveCliPolicy } = require('../../lib/cli-config');

async function writeCliConfig(projectRoot, config) {
  const file = path.join(projectRoot, 'ai', 'system', 'config', 'cli.json');
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
});
