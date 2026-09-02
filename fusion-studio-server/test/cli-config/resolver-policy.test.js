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

async function writeOpenCodeModels(projectRoot, models) {
  const file = path.join(aiPaths.getSystemConfigRoot(projectRoot), 'opencode-models.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(models)}\n`);
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

  it('attaches the per-machine model list to the opencode entry', async () => {
    await writeCliConfig(projectRoot, {
      defaultHarness: 'opencode',
      harnesses: { opencode: { enabled: true } },
    });
    await writeOpenCodeModels(projectRoot, {
      defaultProvider: 'fireworks',
      providers: [
        {
          id: 'fireworks',
          label: 'Fireworks AI',
          defaultModel: 'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731',
          models: [
            { id: 'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash', variants: ['low', 'high', 'max'] },
            { id: 'fireworks-ai/accounts/fireworks/models/deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro', variants: ['high', 'max'] },
          ],
        },
        {
          id: 'baseten',
          label: 'Baseten',
          defaultModel: 'baseten/deepseek-ai/DeepSeek-V4-Flash-0731',
          models: [
            { id: 'baseten/deepseek-ai/DeepSeek-V4-Flash-0731', name: 'DeepSeek V4 Flash', variants: ['none', 'low', 'high', 'max'] },
          ],
        },
      ],
    });

    const policy = await resolveCliPolicy(projectRoot);
    const config = await resolveCliConfig(projectRoot);

    expect(config.opencode.models).toBeDefined();
    expect(config.opencode.models.providers).toHaveLength(2);
    expect(config.opencode.models.providers[0].models).toHaveLength(2);
    expect(config.opencode.models.providers[0].models[0].variants).toEqual(['low', 'high', 'max']);
    // Default model from the list overrides the cli.json runtime model.
    expect(config.opencode.runtime.model).toBe(
      'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731'
    );
    expect(policy.config.opencode.runtime.model).toBe(
      'fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731'
    );
  });

  it('does not attach models when the model list is absent', async () => {
    await writeCliConfig(projectRoot, {
      defaultHarness: 'opencode',
      harnesses: { opencode: { enabled: true, model: 'kimi-for-coding/k2p7' } },
    });

    const config = await resolveCliConfig(projectRoot);

    expect(config.opencode.models).toBeUndefined();
    expect(config.opencode.runtime.model).toBe('kimi-for-coding/k2p7');
  });

  it('ignores malformed model lists', async () => {
    await writeCliConfig(projectRoot, {
      defaultHarness: 'opencode',
      harnesses: { opencode: { enabled: true, model: 'kimi-for-coding/k2p7' } },
    });
    await writeOpenCodeModels(projectRoot, { default: 42, providers: 'nope' });

    const config = await resolveCliConfig(projectRoot);

    expect(config.opencode.models).toBeUndefined();
    expect(config.opencode.runtime.model).toBe('kimi-for-coding/k2p7');
  });
});
