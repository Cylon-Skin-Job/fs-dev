#!/usr/bin/env node
/**
 * Prepares safe Electron AI resources without downloading model binaries.
 * Copies Gwen/Qwen prompt files and ensures model resource directories exist.
 */

const fs = require('fs');
const path = require('path');

const CLIENT_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(CLIENT_ROOT, '..');
const SYSTEM_MANAGER_ROOT = path.join(REPO_ROOT, 'System_Manager');
const PROMPT_SOURCE_DIR = path.join(SYSTEM_MANAGER_ROOT, 'Prompts', 'Gwen-0-8B');
const PROMPT_TARGET_DIR = path.join(CLIENT_ROOT, 'electron', 'resources', 'prompts', 'Gwen-0-8B');
const WIKI_RULE_SOURCE_DIR = path.join(
  SYSTEM_MANAGER_ROOT,
  'ai',
  'views',
  'wiki-viewer',
  'content',
  'system',
  'Text-To-Speech',
  'Rules'
);
const RESOURCE_RULE_SOURCE_DIR = path.join(
  SYSTEM_MANAGER_ROOT,
  'resources',
  'text-to-speech',
  'rules'
);
const RULE_SOURCE_DIR = fs.existsSync(WIKI_RULE_SOURCE_DIR) ? WIKI_RULE_SOURCE_DIR : RESOURCE_RULE_SOURCE_DIR;
const RULE_TARGET_DIR = path.join(CLIENT_ROOT, 'electron', 'resources', 'rules', 'text-to-speech');
const MODEL_DIRS = [
  path.join(CLIENT_ROOT, 'electron', 'resources', 'models', 'gwen-0-8b'),
  path.join(CLIENT_ROOT, 'electron', 'resources', 'models', 'whisper'),
];
const REQUIRED_PROMPTS = ['STT_PROMPT.md', 'THREADS_PROMPT.md', 'CONTEXT_PROMPT.md'];
const REQUIRED_RULES = [
  'replacement-rules.json',
  'list-markers.json',
  'correction-flags.json',
  'cleanup-thresholds.json',
  'filler-rules.json',
  'model-pass-rules.json',
  'stt-notice-rules.json',
  'visual-text-rules.json',
];
const PLACEHOLDER_FILE = '.resource-placeholder';

function copyPrompt(fileName) {
  const sourcePath = path.join(PROMPT_SOURCE_DIR, fileName);
  const targetPath = path.join(PROMPT_TARGET_DIR, fileName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required prompt source: ${sourcePath}`);
  }
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`[prepare-ai-resources] Copied ${fileName}`);
}

function copyRule(fileName) {
  const sourcePath = path.join(RULE_SOURCE_DIR, fileName);
  const targetPath = path.join(RULE_TARGET_DIR, fileName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required rule source: ${sourcePath}`);
  }
  JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`[prepare-ai-resources] Copied ${fileName}`);
}

function copyRuleDirectory(relativeDir) {
  const sourceDir = path.join(RULE_SOURCE_DIR, relativeDir);
  const targetDir = path.join(RULE_TARGET_DIR, relativeDir);
  if (!fs.existsSync(sourceDir)) return;

  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const relativePath = path.join(relativeDir, entry.name);
    const targetPath = path.join(RULE_TARGET_DIR, relativePath);
    if (entry.isDirectory()) {
      copyRuleDirectory(relativePath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`[prepare-ai-resources] Copied ${relativePath}`);
  }
}

try {
  for (const modelDir of MODEL_DIRS) {
    fs.mkdirSync(modelDir, { recursive: true });
    fs.writeFileSync(
      path.join(modelDir, PLACEHOLDER_FILE),
      'Placeholder so Electron packaging preserves this resource directory. Replace with real model assets during explicit model download.\n'
    );
  }

  fs.mkdirSync(PROMPT_TARGET_DIR, { recursive: true });
  for (const prompt of REQUIRED_PROMPTS) {
    copyPrompt(prompt);
  }

  fs.mkdirSync(RULE_TARGET_DIR, { recursive: true });
  for (const ruleDir of ['list', 'correction', 'text']) {
    fs.rmSync(path.join(RULE_TARGET_DIR, ruleDir), { recursive: true, force: true });
  }
  for (const rule of REQUIRED_RULES) {
    copyRule(rule);
  }
  for (const ruleDir of ['list', 'correction', 'text']) {
    copyRuleDirectory(ruleDir);
  }

  console.log(`[prepare-ai-resources] Prepared prompts: ${PROMPT_TARGET_DIR}`);
  console.log(`[prepare-ai-resources] Prepared text-to-speech rules: ${RULE_TARGET_DIR}`);
  console.log('[prepare-ai-resources] Model directories prepared without downloading large assets');
} catch (err) {
  console.error(`[prepare-ai-resources] FAILED: ${err.message}`);
  process.exit(1);
}
