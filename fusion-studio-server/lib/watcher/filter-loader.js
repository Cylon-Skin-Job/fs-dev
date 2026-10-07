// Shared condition/template helpers for event and cron trigger actions.

/**
 * Apply template variables to a string.
 * Replaces {{key}} and {{nested.key}} with values from context.
 */
function applyTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (_, key) => {
    if (key.includes('.')) {
      const [obj, prop] = key.split('.');
      return vars[obj]?.[prop] ?? '';
    }
    return vars[key] ?? '';
  });
}

/**
 * Evaluate a condition expression against context variables.
 * Supports: >, <, >=, <=, ===, !==
 * Examples: "fileStats.tokens > 500", "parentStats.files > 9"
 */
function evaluateCondition(condition, vars) {
  if (!condition) return true;

  const match = condition.match(/^(\w+(?:\.\w+)?)\s*(>|<|>=|<=|===|!==)\s*(.+)$/);
  if (!match) {
    console.warn(`[TriggerCondition] Invalid condition: ${condition}`);
    return true; // don't block on bad syntax
  }

  const [, keyPath, op, rawValue] = match;
  let left;
  if (keyPath.includes('.')) {
    const [obj, prop] = keyPath.split('.');
    left = vars[obj]?.[prop];
  } else {
    left = vars[keyPath];
  }

  // Parse right side
  let right = rawValue.trim();
  if (right === 'true') right = true;
  else if (right === 'false') right = false;
  else if (/^\d+$/.test(right)) right = parseInt(right, 10);
  else right = right.replace(/^["']|["']$/g, '');

  switch (op) {
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '===': return left === right;
    case '!==': return left !== right;
    default: return true;
  }
}

module.exports = { applyTemplate, evaluateCondition };
