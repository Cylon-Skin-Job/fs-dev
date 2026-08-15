/**
 * Hardwired tool enforcement — settings/ folders are write-locked for AI.
 *
 * Any folder named "settings" (case-insensitive, with or without dot prefix)
 * is permanently off-limits for write operations. This is not configurable,
 * not trigger-driven, and not in TRIGGERS.md. Hardcoded.
 *
 * AI can READ from settings/ folders. AI can NEVER WRITE to them.
 */

const path = require('path');
const fs = require('fs');

const SETTINGS_PATTERN = /^\.?settings$/i;
const SETTINGS_BOUNCE_MESSAGE = '[RESTRICTED] Cannot write to settings/ folders. Settings are human-managed only. Drop the file in the parent folder instead.';

const WRITE_TOOLS = new Set(['write_file', 'edit_file', 'write', 'edit']);

const PATH_ARG_MAP = {
  write_file: ['file_path', 'filePath', 'path'],
  edit_file: ['file_path', 'filePath', 'path'],
  write: ['file_path', 'filePath', 'path'],
  edit: ['file_path', 'filePath', 'path'],
};

function hasProtectedSettingsSegment(filePath) {
  return filePath.split(/[/\\]/).some(seg => SETTINGS_PATTERN.test(seg));
}

function createSettingsBounce() {
  return { message: SETTINGS_BOUNCE_MESSAGE };
}

function deepestExistingPath(filePath) {
  let currentPath = filePath;

  while (true) {
    try {
      fs.lstatSync(currentPath);
      return currentPath;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw error;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) return null;
      currentPath = parentPath;
    }
  }
}

function resolveToolPath(filePath, workspaceRoot) {
  if (path.isAbsolute(filePath)) return path.resolve(filePath);
  return workspaceRoot ? path.resolve(workspaceRoot, filePath) : path.resolve(filePath);
}

function resolveExistingTargetPath(filePath, workspaceRoot) {
  const normalizedPath = resolveToolPath(filePath, workspaceRoot);
  const existingPath = deepestExistingPath(normalizedPath);
  if (!existingPath) return null;

  const resolvedExistingPath = fs.realpathSync(existingPath);
  const remainingPath = path.relative(existingPath, normalizedPath);
  return remainingPath
    ? path.resolve(resolvedExistingPath, remainingPath)
    : resolvedExistingPath;
}

/**
 * Check if a tool call should be bounced due to settings/ enforcement.
 *
 * @param {string} toolName - Name of the tool being called
 * @param {Object} parsedArgs - Parsed arguments from the tool call
 * @param {string|null} [workspaceRoot] - Root to resolve relative tool paths against
 * @returns {null | { message: string }} null if allowed, or bounce object
 */
function checkSettingsBounce(toolName, parsedArgs, workspaceRoot = null) {
  if (!WRITE_TOOLS.has(toolName)) return null;

  const argNames = PATH_ARG_MAP[toolName] || [];
  const argName = argNames.find((name) => typeof parsedArgs[name] === 'string' && parsedArgs[name]);
  const filePath = argName ? parsedArgs[argName] : null;
  if (!filePath) return null;

  const hasLogicalSettings = hasProtectedSettingsSegment(filePath);

  if (hasLogicalSettings) {
    return createSettingsBounce();
  }

  try {
    const resolvedPath = resolveExistingTargetPath(filePath, workspaceRoot);
    if (resolvedPath && hasProtectedSettingsSegment(resolvedPath)) {
      return createSettingsBounce();
    }
  } catch (_) {
    // Resolution is live and best-effort; failures keep the logical verdict.
  }

  return null;
}

module.exports = { checkSettingsBounce };
