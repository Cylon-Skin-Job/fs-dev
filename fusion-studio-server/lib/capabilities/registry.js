const fs = require('fs');
const path = require('path');
const { getModelRoot } = require('../resources/resolver');

const CAPABILITIES = {
  sttCleanup: {
    type: 'one-shot-text',
    provider: 'transformers-js',
    model: 'gwen-0-8b',
    promptFile: 'STT_PROMPT.md',
    promptMode: 'single-user-transcript',
    maxNewTokens: 256,
    temperature: 0,
  },

  threadTitle: {
    type: 'one-shot-text',
    provider: 'transformers-js',
    model: 'gwen-0-8b',
    promptFile: 'THREADS_PROMPT.md',
    maxNewTokens: 48,
    temperature: 0.2,
  },

  contextShaping: {
    type: 'one-shot-text',
    provider: 'transformers-js',
    model: 'gwen-0-8b',
    promptFile: 'CONTEXT_PROMPT.md',
    maxNewTokens: 512,
    temperature: 0,
  },
};

const MODELS = {
  'gwen-0-8b': {
    provider: 'transformers-js',
    modelId: 'onnx-community/Qwen3-0.6B-ONNX',
    localFiles: [
      'config.json',
      'added_tokens.json',
      'special_tokens_map.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'generation_config.json',
      path.join('onnx', 'model_q4f16.onnx'),
    ],
    task: 'text-generation',
    device: 'webgpu',
    dtype: 'q4f16',
    disableThinking: true,
  },
};

function hasLocalModelFiles(modelRoot, requiredFiles) {
  return requiredFiles.every((file) => {
    const filePath = path.join(modelRoot, file);
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  });
}

function getCapability(name) {
  return CAPABILITIES[name] || null;
}

function getModel(name) {
  const model = MODELS[name];
  if (!model) return null;

  const modelRoot = getModelRoot(name);
  if (hasLocalModelFiles(modelRoot, model.localFiles || [])) {
    return { ...model, modelId: modelRoot, localModelRoot: modelRoot };
  }

  return model;
}

module.exports = {
  CAPABILITIES,
  MODELS,
  getCapability,
  getModel,
};
