const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
const DEV_RESOURCES_ROOT = path.join(REPO_ROOT, 'fusion-studio-client', 'electron', 'resources');
const REPO_PROMPTS_ROOT = path.join(REPO_ROOT, 'System Source Files', 'Prompts');
const REPO_TTS_RULES_ROOT = path.join(
  REPO_ROOT,
  'System Source Files',
  'resources',
  'text-to-speech',
  'rules'
);

function directoryExists(candidate) {
  return Boolean(candidate && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
}

function getResourcesRoot() {
  if (process.env.FUSION_RESOURCES_PATH) {
    return path.resolve(process.env.FUSION_RESOURCES_PATH);
  }
  if (directoryExists(DEV_RESOURCES_ROOT)) {
    return DEV_RESOURCES_ROOT;
  }
  return REPO_ROOT;
}

function getPromptsRoot(promptSet) {
  if (!promptSet || path.basename(promptSet) !== promptSet) {
    throw new Error(`Invalid prompt set: ${promptSet}`);
  }

  const resourcesPromptRoot = path.join(getResourcesRoot(), 'prompts', promptSet);
  if (directoryExists(resourcesPromptRoot)) {
    return resourcesPromptRoot;
  }

  return path.join(REPO_PROMPTS_ROOT, promptSet);
}

function getRepoPromptsRoot(promptSet) {
  if (!promptSet || path.basename(promptSet) !== promptSet) {
    throw new Error(`Invalid prompt set: ${promptSet}`);
  }

  return path.join(REPO_PROMPTS_ROOT, promptSet);
}

function getModelRoot(modelName) {
  if (!modelName || path.basename(modelName) !== modelName) {
    throw new Error(`Invalid model name: ${modelName}`);
  }
  return path.join(getResourcesRoot(), 'models', modelName);
}

function getWhisperModelPath(modelName) {
  if (!modelName || path.basename(modelName) !== modelName) {
    throw new Error(`Invalid Whisper model name: ${modelName}`);
  }

  const fileName = `ggml-${modelName}.bin`;
  const packagedPath = path.join(getModelRoot('whisper'), fileName);
  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }

  const userDataRoot = process.env.FUSION_APP_USER_DATA
    ? path.resolve(process.env.FUSION_APP_USER_DATA)
    : null;
  const userDataPath = userDataRoot ? path.join(userDataRoot, 'models', 'whisper', fileName) : null;
  if (userDataPath && fs.existsSync(userDataPath)) {
    return userDataPath;
  }

  return path.join(os.homedir(), '.whisper', fileName);
}

function getWritableModelCacheRoot() {
  if (process.env.FUSION_APP_USER_DATA) {
    return path.join(path.resolve(process.env.FUSION_APP_USER_DATA), 'models');
  }
  return path.join(os.homedir(), '.fusion-studio', 'models');
}

function getTextToSpeechRulesRoot() {
  const resourcesRulesRoot = path.join(getResourcesRoot(), 'rules', 'text-to-speech');
  if (directoryExists(resourcesRulesRoot)) {
    return resourcesRulesRoot;
  }

  return REPO_TTS_RULES_ROOT;
}

module.exports = {
  getResourcesRoot,
  getPromptsRoot,
  getRepoPromptsRoot,
  getModelRoot,
  getWhisperModelPath,
  getWritableModelCacheRoot,
  getTextToSpeechRulesRoot,
};
