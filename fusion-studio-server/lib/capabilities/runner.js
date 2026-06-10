const { loadPrompt } = require('./prompt-loader');
const { resolveCapability } = require('./warm-service');

async function runCapability(name, { input, promptOverride } = {}) {
  try {
    const { capabilityConfig, modelConfig, provider } = resolveCapability(name);
    const prompt = promptOverride || await loadPrompt(capabilityConfig.promptFile);
    const result = await provider.run({
      capabilityConfig,
      modelConfig,
      prompt,
      input,
    });

    return {
      success: true,
      text: result.text,
      capability: name,
      model: capabilityConfig.model,
      provider: capabilityConfig.provider,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      capability: name,
      fallbackText: input,
    };
  }
}

module.exports = {
  runCapability,
};
