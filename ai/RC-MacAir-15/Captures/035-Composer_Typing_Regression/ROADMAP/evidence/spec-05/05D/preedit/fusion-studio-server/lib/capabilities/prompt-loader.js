const fs = require('fs').promises;
const path = require('path');
const { getPromptsRoot, getRepoPromptsRoot } = require('../resources/resolver');

const PROMPT_SET = 'Gwen-0-8B';

function getPromptPath(promptFile) {
  if (!promptFile || path.basename(promptFile) !== promptFile) {
    throw new Error(`Invalid prompt file: ${promptFile}`);
  }

  return path.join(getPromptsRoot(PROMPT_SET), promptFile);
}

async function loadPrompt(promptFile) {
  const promptPath = getPromptPath(promptFile);

  try {
    return await fs.readFile(promptPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Prompt file not found: ${promptFile}`);
    }
    throw error;
  }
}

async function savePrompt(promptFile, content) {
  if (typeof content !== 'string') {
    throw new Error('Prompt content must be a string');
  }

  const promptPath = getPromptPath(promptFile);
  await fs.mkdir(path.dirname(promptPath), { recursive: true });
  await fs.writeFile(promptPath, content, 'utf8');

  const repoPromptPath = path.join(getRepoPromptsRoot(PROMPT_SET), promptFile);
  if (repoPromptPath !== promptPath) {
    await fs.mkdir(path.dirname(repoPromptPath), { recursive: true });
    await fs.writeFile(repoPromptPath, content, 'utf8');
  }

  return promptPath;
}

module.exports = {
  PROMPT_DIR: getPromptsRoot(PROMPT_SET),
  loadPrompt,
  savePrompt,
};
