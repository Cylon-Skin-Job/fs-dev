'use strict';

function parseYamlScalar(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const decoded = JSON.parse(value);
      if (typeof decoded === 'string') return decoded;
    } catch {
      // Preserve the prior bounded behavior for manually-authored scalar
      // syntax outside the JSON-compatible subset emitted by our writer.
    }
    return value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const signedRadix = value.match(/^([+-]?)(0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+)$/);
  if (signedRadix) {
    const sign = signedRadix[1] === '-' ? -1 : 1;
    return sign * Number(signedRadix[2].replace(/_/g, ''));
  }
  if (/^[+-]?(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?$/.test(value)) {
    return Number(value.replace(/_/g, ''));
  }
  return value;
}

function parseSimpleYaml(yamlText) {
  // Null-prototype mappings keep YAML keys such as `__proto__` inert. Callers
  // must still use own-property reads for security-sensitive identity fields.
  const result = Object.create(null);
  // This intentionally supports only the mapping subset used by Fusion view
  // frontmatter. Track indentation so a nested mapping cannot be flattened
  // into its ancestor (notably metadata.view-id, which is an identity field).
  const stack = [{ indent: -1, childIndent: null, value: result }];
  for (const rawLine of String(yamlText || '').split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const indentation = rawLine.match(/^\s*/)[0];
    if (indentation.includes('\t')) throw new Error('invalid YAML indentation');
    const indent = indentation.length;
    const line = rawLine.trim();
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key) throw new Error('invalid YAML mapping key');
    const rawValue = line.slice(separator + 1).trim();
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parentFrame = stack[stack.length - 1];
    if (parentFrame.childIndent === null) parentFrame.childIndent = indent;
    if (parentFrame.childIndent !== indent) throw new Error('invalid YAML indentation');
    const parent = parentFrame.value;
    if (Object.hasOwn(parent, key)) throw new Error('duplicate YAML mapping key');
    if (rawValue === '') {
      const child = Object.create(null);
      parent[key] = child;
      stack.push({ indent, childIndent: null, value: child });
    } else {
      parent[key] = parseYamlScalar(rawValue);
    }
  }
  return result;
}

module.exports = { parseSimpleYaml, parseYamlScalar };
