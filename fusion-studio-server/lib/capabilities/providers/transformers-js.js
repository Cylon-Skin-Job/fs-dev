const pipelines = new Map();

async function getPipeline(modelConfig) {
  const cacheKey = `${modelConfig.task}:${modelConfig.modelId}:${modelConfig.device}:${modelConfig.dtype}`;
  const cached = pipelines.get(cacheKey);
  if (cached) return cached;

  const pipelinePromise = import('@huggingface/transformers').then(({ pipeline }) => {
    return pipeline(modelConfig.task, modelConfig.modelId, {
      device: modelConfig.device,
      dtype: modelConfig.dtype,
    });
  });

  pipelines.set(cacheKey, pipelinePromise);

  try {
    return await pipelinePromise;
  } catch (error) {
    pipelines.delete(cacheKey);
    throw error;
  }
}

function buildMessages(systemPrompt, input, promptMode) {
  if (promptMode === 'single-user-transcript') {
    return [
      {
        role: 'user',
        content: `${systemPrompt.trim()}\n\nTRANSCRIPT:\n${String(input || '').trim()}\n\nOUTPUT:`,
      },
    ];
  }

  return [
    { role: 'system', content: systemPrompt.trim() },
    { role: 'user', content: String(input || '').trim() },
  ];
}

function extractGeneratedText(output, promptText) {
  const first = Array.isArray(output) ? output[0] : output;
  let text = first?.generated_text ?? first?.text ?? '';

  if (Array.isArray(text)) {
    const lastMessage = text[text.length - 1];
    text = lastMessage?.content || '';
  }

  if (typeof text !== 'string') return '';
  if (text.startsWith(promptText)) text = text.slice(promptText.length);
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|im_end\|>.*$/s, '')
    .trim();
}

async function warm(modelConfig) {
  await getPipeline(modelConfig);
  return { status: 'ready' };
}

async function run({ capabilityConfig, modelConfig, prompt, input }) {
  const generator = await getPipeline(modelConfig);
  const messages = buildMessages(prompt, input, capabilityConfig.promptMode);
  const output = await generator(messages, {
    max_new_tokens: capabilityConfig.maxNewTokens,
    temperature: capabilityConfig.temperature,
    do_sample: capabilityConfig.temperature > 0,
    return_full_text: false,
    tokenizer_encode_kwargs: modelConfig.disableThinking
      ? { enable_thinking: false }
      : undefined,
  });

  return {
    text: extractGeneratedText(output, ''),
  };
}

async function dispose() {
  pipelines.clear();
}

module.exports = {
  warm,
  run,
  dispose,
};
