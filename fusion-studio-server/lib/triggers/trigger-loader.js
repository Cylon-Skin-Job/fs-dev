/**
 * Trigger Loader — scans agent folders for TRIGGERS.md files,
 * registers bus event triggers and returns cron registrations.
 *
 * Event and cron blocks remain active; file-change blocks have no active
 * watcher input and are intentionally ignored.
 */

const fs = require('fs');
const path = require('path');
const { parseTriggerBlocks } = require('./trigger-parser');
const { evaluateCondition } = require('../watcher/filter-loader');
const { on } = require('../event-bus');
const views = require('../views');
const { createCycleGuard } = require('../fs/cycle-guard');
const { classifyEntrySync } = require('../fs/dirents');

/**
 * Register an event bus listener for a TRIGGERS.md block.
 * The listener evaluates conditions and executes the configured action.
 *
 * @sideeffect Registers a persistent listener on the event bus singleton.
 */
function registerBusListener(eventType, block, assignee, actionHandlers) {
  on(eventType, (event) => {
    // Workspace filter: skip events from other workspaces
    if (block.workspace && event.workspace !== block.workspace) return;

    // Condition check
    if (block.condition && !evaluateCondition(block.condition, event)) return;

    // Build template vars from event data
    const vars = {
      ...event,
      assignee,
      filePath: event.filePath || '',
      basename: event.basename || '',
    };

    // Execute action
    const action = block.action || 'create-ticket';
    const handler = actionHandlers[action];
    if (handler) {
      const message = normalizeMessage(block.message);
      const def = {
        name: block.name || 'unnamed-trigger',
        action,
        prompt: block.prompt || null,
        message: block.message,
        target: block.target,
        url: block.url,
        body: block.body,
        path: block.path,
        content: block.content,
        role: block.role,
        _autoHold: true,
        ticket: {
          assignee,
          title: message ? message.split('\n')[0].trim() : `Trigger: ${block.name}`,
          body: message || `Event trigger fired: ${block.name}`,
        },
      };
      handler(def, vars);
    } else {
      console.warn(`[TriggerLoader] Unknown action: ${action}`);
    }
  });

  console.log(`[TriggerLoader] Bus listener: ${block.name} on ${eventType} → ${assignee}`);
}

/**
 * Recursively find all TRIGGERS.md files under a directory.
 *
 * @param {string} dir - Directory to scan
 * @returns {string[]} Absolute paths to TRIGGERS.md files
 */
function realpathOrNull(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return null;
  }
}

function findTriggersFiles(dir, cycleGuard = createCycleGuard()) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const dirRealPath = realpathOrNull(dir);
  if (!cycleGuard.shouldEnter(dirRealPath)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    const classified = classifyEntrySync(dir, entry);
    if (classified.isDir) {
      results.push(...findTriggersFiles(fullPath, cycleGuard));
    } else if (classified.isFile && entry.name === 'TRIGGERS.md') {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Derive an assignee name from a TRIGGERS.md file path.
 * Uses the nearest meaningful parent folder name, or 'system'.
 *
 * @param {string} triggersPath - Absolute path to a TRIGGERS.md file
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string} Assignee name
 */
function deriveAssignee(triggersPath, projectRoot) {
  const rel = path.relative(projectRoot, path.dirname(triggersPath));
  const segments = rel.split(path.sep).filter(Boolean);
  // Use the last meaningful segment as the assignee
  return segments[segments.length - 1] || 'system';
}

/**
 * Scan agent folders for TRIGGERS.md and register event triggers + return cron triggers.
 * Also scans the active view-capsule root and ai/components/ recursively
 * for additional TRIGGERS.md files.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @param {string} agentsBasePath - Absolute path to agents panel
 * @param {Object} registry - Parsed registry.json { agents: { botName: { folder } } }
 * @param {Object} actionHandlers - Action handlers from createActionHandlers()
 * @returns {{ cronTriggers: Array<{ trigger: Object, assignee: string }> }}
 * @sideeffect Registers event bus listeners for chat/ticket/agent/system triggers.
 */
function loadTriggers(projectRoot, agentsBasePath, registry, actionHandlers) {
  const cronTriggers = [];
  const processedPaths = new Set();
  const cycleGuard = createCycleGuard();

  // --- Pass 1: Agent TRIGGERS.md files (with known assignees from registry) ---

  for (const [botName, agent] of Object.entries(registry.agents || {})) {
    const agentPath = path.join(agentsBasePath, agent.folder);

    // Scan agent root and all subfolders (workflows, etc.)
    const agentTriggerFiles = findTriggersFiles(agentPath, cycleGuard);
    for (const triggersPath of agentTriggerFiles) {
      processedPaths.add(triggersPath);
      const blocks = parseTriggerBlocks(triggersPath);
      const rel = path.relative(agentPath, triggersPath);
      console.log(`[TriggerLoader] ${botName}${rel !== 'TRIGGERS.md' ? '/' + path.dirname(rel) : ''}: parsed ${blocks.length} triggers`);

      for (const block of blocks) {
        processBlock(block, botName, projectRoot, actionHandlers, cronTriggers);
      }
    }
  }

  // --- Pass 2: Recursive scan of view capsules and ai/components/ ---

  const scanDirs = [
    views.getViewsRoot(projectRoot),
    path.join(projectRoot, 'ai', 'components'),
  ];

  for (const scanDir of scanDirs) {
    const triggerFiles = findTriggersFiles(scanDir, cycleGuard);
    for (const triggersPath of triggerFiles) {
      if (processedPaths.has(triggersPath)) continue;
      processedPaths.add(triggersPath);

      const assignee = deriveAssignee(triggersPath, projectRoot);
      const blocks = parseTriggerBlocks(triggersPath);
      const rel = path.relative(projectRoot, triggersPath);
      console.log(`[TriggerLoader] ${rel}: parsed ${blocks.length} triggers (assignee: ${assignee})`);

      for (const block of blocks) {
        processBlock(block, assignee, projectRoot, actionHandlers, cronTriggers);
      }
    }
  }

  return { cronTriggers };
}

/**
 * Process a single trigger block — categorize and register.
 */
function processBlock(block, assignee, projectRoot, actionHandlers, cronTriggers) {
  if (block.type === 'cron') {
    cronTriggers.push({ trigger: block, assignee });
  } else if (['chat', 'ticket', 'agent', 'system'].includes(block.type)) {
    if (!block.event) {
      console.warn(`[TriggerLoader] ${block.name || 'unnamed'}: type "${block.type}" requires an "event" field, skipping`);
      return;
    }
    registerBusListener(`${block.type}:${block.event}`, block, assignee, actionHandlers);
  } else if (block.type === 'file-change') {
    // File-change blocks have no active filesystem producer after watcher retirement.
  }
}

function normalizeMessage(msg) {
  if (!msg) return null;
  if (typeof msg === 'string') return msg;
  if (typeof msg === 'object') {
    return Object.entries(msg).map(([key, value]) => `${key}: ${value}`).join('\n');
  }
  return String(msg);
}

module.exports = { loadTriggers };
