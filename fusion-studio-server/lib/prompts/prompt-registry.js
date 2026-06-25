const fs = require('fs');
const path = require('path');

const { parseFrontmatter } = require('../frontmatter');
const { getSystemPromptsRoot } = require('../resources/resolver');

function listPromptFiles(root) {
  if (!fs.existsSync(root)) return [];

  const files = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listPromptFiles(fullPath));
    } else if (entry.isFile() && entry.name === 'PROMPT.md') {
      files.push(fullPath);
    }
  }
  return files;
}

function getPromptId(frontmatter) {
  return frontmatter?.metadata?.['prompt-id'] || frontmatter?.['prompt-id'] || null;
}

function readPromptFile(promptPath) {
  const content = fs.readFileSync(promptPath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(content, 'prompt');
  const promptId = getPromptId(frontmatter);
  if (!promptId) return null;

  return {
    promptId,
    frontmatter,
    metadata: frontmatter.metadata || {},
    body,
    path: promptPath,
  };
}

function loadPromptIndex() {
  const root = getSystemPromptsRoot();
  const prompts = new Map();

  for (const promptPath of listPromptFiles(root)) {
    const entry = readPromptFile(promptPath);
    if (entry) prompts.set(entry.promptId, entry);
  }

  return prompts;
}

function formatVariables(variables) {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
    return '{}';
  }
  return JSON.stringify(variables, null, 2);
}

function renderPrompt(entry, variables = {}) {
  return [
    entry.body,
    '',
    '<workflow_context>',
    `  <prompt_id>${entry.promptId}</prompt_id>`,
    '  <variables>',
    formatVariables(variables),
    '  </variables>',
    '</workflow_context>',
  ].join('\n');
}

function resolvePrompt(promptId, variables = {}) {
  if (!promptId || typeof promptId !== 'string') {
    throw new Error('promptId is required');
  }

  const prompts = loadPromptIndex();
  const entry = prompts.get(promptId);
  if (!entry) {
    throw new Error(`Prompt not found: ${promptId}`);
  }

  return {
    promptId: entry.promptId,
    frontmatter: entry.frontmatter,
    metadata: entry.metadata,
    path: entry.path,
    body: entry.body,
    content: renderPrompt(entry, variables),
  };
}

module.exports = {
  listPromptFiles,
  loadPromptIndex,
  resolvePrompt,
  renderPrompt,
};
