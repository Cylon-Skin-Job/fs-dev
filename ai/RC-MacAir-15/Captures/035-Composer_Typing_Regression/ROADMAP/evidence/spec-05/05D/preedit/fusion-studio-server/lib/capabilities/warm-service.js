const { getCapability, getModel } = require('./registry');
const transformersProvider = require('./providers/transformers-js');

const warmPromises = new Map();
const readyCapabilities = new Set();

const PROVIDERS = {
  'transformers-js': transformersProvider,
};

function resolveCapability(name) {
  const capabilityConfig = getCapability(name);
  if (!capabilityConfig) throw new Error(`Unknown capability: ${name}`);

  const modelConfig = getModel(capabilityConfig.model);
  if (!modelConfig) throw new Error(`Unknown model: ${capabilityConfig.model}`);

  const provider = PROVIDERS[capabilityConfig.provider];
  if (!provider) throw new Error(`Unknown provider: ${capabilityConfig.provider}`);

  return { capabilityConfig, modelConfig, provider };
}

async function warmCapability(name) {
  if (readyCapabilities.has(name)) {
    return { success: true, capability: name, status: 'ready' };
  }

  const existing = warmPromises.get(name);
  if (existing) return existing;

  const promise = (async () => {
    const { modelConfig, provider } = resolveCapability(name);
    await provider.warm(modelConfig);
    readyCapabilities.add(name);
    return { success: true, capability: name, status: 'ready' };
  })();

  warmPromises.set(name, promise);

  try {
    return await promise;
  } finally {
    warmPromises.delete(name);
  }
}

function getCapabilityStatus(name) {
  if (readyCapabilities.has(name)) return 'ready';
  if (warmPromises.has(name)) return 'loading';
  return 'not_initialized';
}

module.exports = {
  warmCapability,
  getCapabilityStatus,
  resolveCapability,
};
