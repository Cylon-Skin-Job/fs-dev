'use strict';

const { randomUUID } = require('crypto');
const {
  admitCandidatePath,
  retainCandidates,
} = require('../../agent-provenance/candidate-fingerprints');

const COMMAND_BYTES_MAX = 65_536;
const DYNAMIC_PATH = /[$`*?\[\]{}]/u;
const BARE_COMMAND = /^[A-Za-z0-9_-]+$/u;

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

function splitSegments(command) {
  const segments = [];
  let start = 0;
  let quote = null;
  let invalid = false;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const code = command.charCodeAt(index);
    if (quote) {
      if (char === '\\' || code < 0x20 || code === 0x7f) invalid = true;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '\\' || char === '\r' || code === 0x7f || code < 0x20 && char !== '\n' && char !== '\t') {
      invalid = true;
      continue;
    }
    let width = 0;
    if (char === ';' || char === '\n' || char === '|') {
      width = command[index + 1] === char && char === '|' ? 2 : 1;
    } else if (char === '&') {
      if (command[index + 1] !== '&') {
        invalid = true;
        continue;
      }
      width = 2;
    }
    if (width) {
      segments.push(invalid ? { invalid: true } : { text: command.slice(start, index) });
      index += width - 1;
      start = index + 1;
      invalid = false;
    }
  }
  if (quote || invalid) segments.push({ invalid: true });
  else segments.push({ text: command.slice(start) });
  return segments;
}

function tokenizeSegment(text) {
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    while (text[index] === ' ' || text[index] === '\t') index += 1;
    if (index >= text.length) break;
    if ('()'.includes(text[index])) return null;
    const quotedRedirection = /^[0-9]?(?:<>|>>|<|>)(?=["'])/u.exec(text.slice(index));
    if (quotedRedirection) {
      tokens.push({ value: quotedRedirection[0], quoted: false });
      index += quotedRedirection[0].length;
      continue;
    }
    if (text[index] === '"' || text[index] === "'") {
      const quote = text[index++];
      const start = index;
      while (index < text.length && text[index] !== quote) index += 1;
      if (index >= text.length) return null;
      tokens.push({ value: text.slice(start, index), quoted: true });
      index += 1;
      if (index < text.length && text[index] !== ' ' && text[index] !== '\t') return null;
      continue;
    }
    const start = index;
    while (index < text.length && text[index] !== ' ' && text[index] !== '\t') {
      if ('"\'\\();|&'.includes(text[index])) return null;
      index += 1;
    }
    tokens.push({ value: text.slice(start, index), quoted: false });
  }
  return tokens;
}

function isDynamicPath(value) {
  return !value || value.startsWith('~') || DYNAMIC_PATH.test(value);
}

function parseRedirections(tokens) {
  const words = [];
  const redirections = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const match = token.quoted ? null : /^([0-9]?)(<>|>>|<|>)(.*)$/u.exec(token.value);
    if (!match) {
      if (!token.quoted && /[<>]/u.test(token.value)) return null;
      words.push(token);
      continue;
    }
    if (match[2] === '<' && token.value.includes('<<') || /[<>]/u.test(match[3])) return null;
    let target = match[3];
    if (!target) {
      const targetToken = tokens[++index];
      if (!targetToken || !targetToken.quoted && /[<>]/u.test(targetToken.value)) return null;
      target = targetToken.value;
    }
    if (isDynamicPath(target)) return null;
    redirections.push({ operator: match[2], path: target });
  }
  return { words, redirections };
}

function consumeOptionalDoubleDash(words, start) {
  return words[start] === '--'
    ? { index: start + 1, optionLookingPathsAllowed: true }
    : { index: start, optionLookingPathsAllowed: false };
}

function pathOperands(words) {
  if (words.some((word) => isDynamicPath(word))) return null;
  return words;
}

function classifyOperands(words) {
  if (words.length === 0 || words[0].quoted || !BARE_COMMAND.test(words[0].value)) return null;
  const command = words[0].value;
  words = words.map(token => token.value);
  let index = 1;
  const readMany = new Set(['cat', 'head', 'tail', 'wc', 'stat', 'file']);
  if (readMany.has(command) || command === 'touch' || command === 'rm') {
    const options = consumeOptionalDoubleDash(words, index);
    index = options.index;
    const paths = pathOperands(words.slice(index));
    if (!paths?.length || !options.optionLookingPathsAllowed && paths.some((item) => item.startsWith('-'))) return null;
    const family = command === 'touch' || command === 'rm' ? 'write' : 'read';
    const kind = command === 'rm' ? 'delete' : family === 'write' ? 'write' : 'read';
    return paths.map((candidate) => ({ candidate, accessFamily: family, accessKind: kind }));
  }
  if (command === 'grep' || command === 'rg') {
    const options = consumeOptionalDoubleDash(words, index);
    index = options.index;
    if (words.length - index < 2 || !options.optionLookingPathsAllowed && words[index].startsWith('-')) return null;
    const paths = pathOperands(words.slice(index + 1));
    if (!paths?.length || !options.optionLookingPathsAllowed && paths.some((item) => item.startsWith('-'))) return null;
    return paths.map((candidate) => ({ candidate, accessFamily: 'read', accessKind: 'read' }));
  }
  if (command === 'truncate') {
    if ((words[index] !== '-s' && words[index] !== '--size') || !/^[0-9]+$/u.test(words[index + 1] || '')) return null;
    index += 2;
    const options = consumeOptionalDoubleDash(words, index);
    index = options.index;
    const paths = pathOperands(words.slice(index));
    if (!paths?.length || !options.optionLookingPathsAllowed && paths.some((item) => item.startsWith('-'))) return null;
    return paths.map((candidate) => ({ candidate, accessFamily: 'write', accessKind: 'write' }));
  }
  if (command === 'unlink') {
    const options = consumeOptionalDoubleDash(words, index);
    index = options.index;
    const paths = pathOperands(words.slice(index));
    return paths?.length === 1 && (options.optionLookingPathsAllowed || !paths[0].startsWith('-'))
      ? [{ candidate: paths[0], accessFamily: 'write', accessKind: 'delete' }]
      : null;
  }
  if (command === 'tee') {
    if (words[index] === '-a') index += 1;
    const options = consumeOptionalDoubleDash(words, index);
    index = options.index;
    const paths = pathOperands(words.slice(index));
    if (!paths?.length || !options.optionLookingPathsAllowed && paths.some((item) => item.startsWith('-'))) return null;
    return paths.map((candidate) => ({ candidate, accessFamily: 'write', accessKind: 'write' }));
  }
  if (command === 'cp' || command === 'mv') {
    const options = consumeOptionalDoubleDash(words, index);
    index = options.index;
    const paths = pathOperands(words.slice(index));
    if (paths?.length !== 2 || !options.optionLookingPathsAllowed && paths.some((item) => item.startsWith('-'))) return null;
    if (command === 'cp') return [
      { candidate: paths[0], accessFamily: 'read', accessKind: 'read' },
      { candidate: paths[1], accessFamily: 'write', accessKind: 'write' },
    ];
    return [
      { candidate: paths[0], accessFamily: 'write', accessKind: 'move_from' },
      { candidate: paths[1], accessFamily: 'write', accessKind: 'move_to' },
    ];
  }
  return null;
}

function candidateRecord(raw, canonicalRoot, accessFamily, accessKind, extractionBasis) {
  const admitted = admitCandidatePath(raw, canonicalRoot);
  return {
    edgeId: randomUUID(),
    candidateSha256: admitted.candidateSha256,
    ...(admitted.accepted
      ? { canonicalPath: admitted.canonicalPath }
      : { candidateValue: raw, reason: admitted.reason }),
    accessFamily,
    accessKind,
    extractionBasis,
  };
}

function extractShellCandidates(command, canonicalRoot, onDiagnostic) {
  if (typeof command !== 'string' || command.includes('\0') || hasUnpairedSurrogate(command)
    || Buffer.byteLength(command, 'utf8') > COMMAND_BYTES_MAX) {
    onDiagnostic('agent_tool_shell_input_invalid');
    return [];
  }
  const results = [];
  const unique = new Set();
  function append(record) {
    const key = [record.candidateSha256, record.accessFamily, record.accessKind, record.extractionBasis].join('\0');
    if (unique.has(key)) {
      results.push(record);
      return true;
    }
    unique.add(key);
    results.push(record);
    return unique.size < 65;
  }
  for (const segment of splitSegments(command)) {
    if (segment.invalid) continue;
    const tokens = tokenizeSegment(segment.text);
    const parsed = tokens && parseRedirections(tokens);
    if (!parsed) continue;
    const operands = classifyOperands(parsed.words);
    if (!operands) continue;
    for (const redirection of parsed.redirections) {
      if (redirection.operator === '<' || redirection.operator === '<>') {
        if (!append(candidateRecord(redirection.path, canonicalRoot, 'read', 'read', 'shell_input_redirection'))) return results;
      }
      if (redirection.operator === '>' || redirection.operator === '>>' || redirection.operator === '<>') {
        if (!append(candidateRecord(redirection.path, canonicalRoot, 'write', 'write', 'shell_output_redirection'))) return results;
      }
    }
    for (const operand of operands) {
      if (!append(candidateRecord(operand.candidate, canonicalRoot, operand.accessFamily, operand.accessKind, 'shell_known_operand'))) return results;
    }
  }
  return results;
}

function extractStructuredPath(args, nativeToolName, canonicalRoot, onDiagnostic) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return [];
  const hasCamel = Object.hasOwn(args, 'filePath');
  const hasSnake = Object.hasOwn(args, 'file_path');
  if (!hasCamel && !hasSnake) return [];
  const camel = args.filePath;
  const snake = args.file_path;
  if (hasCamel && typeof camel !== 'string' || hasSnake && typeof snake !== 'string'
    || hasCamel && hasSnake && camel !== snake) {
    onDiagnostic('agent_tool_structured_path_invalid');
    return [];
  }
  const value = hasCamel ? camel : snake;
  const read = nativeToolName === 'read';
  return [candidateRecord(value, canonicalRoot, read ? 'read' : 'write', read ? 'read' : 'write', 'structured_path')];
}

function extractOpenCodeCandidates({ nativeToolName, args, canonicalRoot, onDiagnostic = () => {} }) {
  let candidates = [];
  if (nativeToolName === 'read' || nativeToolName === 'write' || nativeToolName === 'edit') {
    candidates = extractStructuredPath(args, nativeToolName, canonicalRoot, onDiagnostic);
  } else if (nativeToolName === 'bash') {
    if (args && typeof args === 'object' && !Array.isArray(args)
      && Object.hasOwn(args, 'command') && typeof args.command === 'string') {
      candidates = extractShellCandidates(args.command, canonicalRoot, onDiagnostic);
    } else if (args && typeof args === 'object' && Object.hasOwn(args, 'command')) {
      onDiagnostic('agent_tool_shell_input_invalid');
    }
  }
  return retainCandidates(candidates);
}

module.exports = {
  COMMAND_BYTES_MAX,
  extractOpenCodeCandidates,
  extractShellCandidates,
};
