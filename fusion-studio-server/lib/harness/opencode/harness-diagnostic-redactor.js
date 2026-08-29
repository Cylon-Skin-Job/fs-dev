/**
 * @module opencode/harness-diagnostic-redactor
 * @role Adapter-boundary redaction producing an already-redacted
 *        HarnessDiagnosticCandidateV1 from a closed-field draft assembled
 *        inside the OpenCode boundary (R5A contract; SPEC-03 §3).
 *
 * Binding rules implemented here:
 *  - Allowlist-only V1 construction: only known primitive fields are
 *    traversed; an arbitrary Error or provider object is never walked.
 *  - Exact configured-secret values (injected provider) are replaced first;
 *    provider failure degrades to an empty list and redaction continues.
 *  - Exact non-empty environment values whose keys match the closed
 *    case-insensitive R5A key policy are replaced, plus the adapter-declared
 *    credential env keys (today: OPENCODE_PATH). The environment snapshot is
 *    supplied by the adapter; this module never reads process.env.
 *  - Credential/token/private-key patterns and URL userinfo are redacted in
 *    free-form text before path rewriting.
 *  - User-home and project-root prefixes rewrite to literal $HOME/$WORKSPACE.
 *  - Control characters: CRLF/LF newlines are preserved for readability,
 *    tabs normalize to single spaces, all other C0 controls and DEL are
 *    stripped (documented choice under rule 7).
 *  - Bounds: short identifiers ≤128 UTF-8 bytes; message prefix ≤4096 bytes;
 *    stderrExcerpt tail ≤16384 bytes; ≤16 fixed-name truncation markers;
 *    final serialized candidate ≤24576 bytes via progressive truncation of
 *    the free-form fields.
 *  - Fail closed: any thrown step drops ALL free-form text and returns the
 *    structured fields with fixed-name redaction markers recorded.
 *
 * Deterministic and pure apart from the injected async secret provider.
 */

const SENSITIVE_ENV_KEY_PATTERN = /(?:^|_)(TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|APIKEY|PRIVATE_KEY|ACCESS_KEY|SESSION|COOKIE|AUTH|CREDENTIALS?)(?:_|$)/i;

/** Env keys the active OpenCode adapter itself reads as credentials. */
const ADAPTER_CREDENTIAL_ENV_KEYS = Object.freeze(['OPENCODE_PATH']);

const CANDIDATE_VERSION = 1;

const SHORT_IDENTIFIER_BYTES = 128;
const MESSAGE_PREFIX_BYTES = 4096;
const STDERR_TAIL_BYTES = 16384;
const MAX_TRUNCATION_MARKERS = 16;
const SERIALIZED_LIMIT_BYTES = 24576;

/** Fixed truncation/redaction marker names (allowlist). */
const TRUNCATION_MARKER_NAMES = Object.freeze([
  'message',
  'stderrExcerpt',
  'harnessId',
  'modelId',
  'providerCode',
  'errorName',
  'signal',
  'lastCanonicalEventType',
]);

const REDACTED = '[REDACTED]';
const REDACTED_PRIVATE_KEY = '[REDACTED_PRIVATE_KEY]';

// Free-text pattern redaction. Applied AFTER exact-value replacement.
const PRIVATE_KEY_BLOCK_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const BEARER_BASIC_PATTERN = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi;
const KV_SECRET_PATTERN = /\b(api[-_]?key|access[-_]?key|private[-_]?key|token|secret|password|passwd|auth(?:orization)?|key)\s*[:=]\s*["']?[^\s"',;&<>]{4,}/gi;
const URL_USERINFO_PATTERN = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function truncateUtf8Prefix(value, maxBytes) {
  if (byteLength(value) <= maxBytes) return value;
  let out = '';
  let total = 0;
  for (const char of value) {
    const size = byteLength(char);
    if (total + size > maxBytes) break;
    out += char;
    total += size;
  }
  return out;
}

function truncateUtf8Tail(value, maxBytes) {
  if (byteLength(value) <= maxBytes) return value;
  const chars = Array.from(value);
  const kept = [];
  let total = 0;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const size = byteLength(chars[i]);
    if (total + size > maxBytes) break;
    kept.unshift(chars[i]);
    total += size;
  }
  return kept.join('');
}

function cutHalfPrefix(value) {
  const chars = Array.from(value);
  return chars.slice(0, Math.floor(chars.length / 2)).join('');
}

function cutHalfSuffix(value) {
  const chars = Array.from(value);
  return chars.slice(Math.ceil(chars.length / 2)).join('');
}

function createMarkerRecorder(seedNames) {
  const recorded = [];
  const seen = new Set();
  function add(name) {
    if (!TRUNCATION_MARKER_NAMES.includes(name)) return;
    if (seen.has(name)) return;
    if (recorded.length >= MAX_TRUNCATION_MARKERS) return;
    seen.add(name);
    recorded.push(name);
  }
  (Array.isArray(seedNames) ? seedNames : []).forEach(add);
  return { add, list: () => [...recorded] };
}

async function collectExactValueReplacements(options) {
  const rawValues = [];

  if (typeof options.getConfiguredSecrets === 'function') {
    try {
      const configured = await options.getConfiguredSecrets();
      if (Array.isArray(configured)) rawValues.push(...configured);
    } catch {
      // Secret-provider failure degrades to an empty list; continue.
    }
  }

  const envSnapshot = options.env;
  if (envSnapshot && typeof envSnapshot === 'object') {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (typeof value !== 'string' || value.length === 0) continue;
      if (SENSITIVE_ENV_KEY_PATTERN.test(key) || ADAPTER_CREDENTIAL_ENV_KEYS.includes(key)) {
        rawValues.push(value);
      }
    }
  }

  const unique = [...new Set(rawValues)]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .sort((a, b) => byteLength(b) - byteLength(a));
  return unique.map((value) => ({ find: value, replacement: REDACTED }));
}

function replaceExactValues(text, replacements) {
  let out = text;
  for (const { find, replacement } of replacements) {
    if (!out.includes(find)) continue;
    out = out.split(find).join(replacement);
  }
  return out;
}

function applyPatternRedaction(text) {
  // Patterns stack deliberately: e.g. an "Auth: Bearer <tok>" header is first
  // stripped by the bearer rule and its leftover "Name:" assignment is then
  // neutralized by the kv rule. Stacked [REDACTED] markers are safe output.
  let out = text.replace(PRIVATE_KEY_BLOCK_PATTERN, REDACTED_PRIVATE_KEY);
  out = out.replace(BEARER_BASIC_PATTERN, '$1 ' + REDACTED);
  out = out.replace(KV_SECRET_PATTERN, '$1=' + REDACTED);
  out = out.replace(URL_USERINFO_PATTERN, '$1' + REDACTED + '@');
  return out;
}

function rewritePathPrefixes(text, prefixes) {
  let out = text;
  // Longest prefix first so a workspace inside the home directory rewrites
  // to $WORKSPACE rather than $HOME/....
  for (const { prefix, token } of prefixes) {
    if (!prefix || !prefix.trim()) continue;
    out = out.split(prefix + '/').join(token + '/').split(prefix).join(token);
  }
  return out;
}

function stripControlCharacters(text) {
  let out = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  out = out.replace(/\t/g, ' ');
  return out.replace(CONTROL_CHAR_PATTERN, '');
}

function redactFreeFormText(text, replacements, prefixes) {
  let out = replaceExactValues(text, replacements);
  out = applyPatternRedaction(out);
  out = rewritePathPrefixes(out, prefixes);
  out = stripControlCharacters(out);
  return out;
}

function requireClosedDraftShape(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new TypeError('Diagnostic draft must be a closed-field object');
  }
  if (draft.version !== CANDIDATE_VERSION) throw new TypeError('Draft version must be 1');
  if (typeof draft.harnessId !== 'string' || !draft.harnessId) {
    throw new TypeError('Draft requires harnessId');
  }
  if (!draft.category) throw new TypeError('Draft requires category');
  if (typeof draft.hadRenderableOutput !== 'boolean' || typeof draft.hadToolCalls !== 'boolean') {
    throw new TypeError('Draft requires boolean hadRenderableOutput/hadToolCalls');
  }
  if (!Array.isArray(draft.truncatedFields)) {
    throw new TypeError('Draft requires truncatedFields array');
  }
}

function optionalStringField(draft, field, boundBytes, markers) {
  const value = draft[field];
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const bounded = truncateUtf8Prefix(value, boundBytes);
  if (bounded !== value) markers.add(field);
  return bounded;
}

function structuredOnlyFallback(draft) {
  const candidate = {
    version: CANDIDATE_VERSION,
    harnessId: typeof draft?.harnessId === 'string' && draft.harnessId ? draft.harnessId : 'opencode',
    category: draft?.category ? String(draft.category) : 'runtime',
    hadRenderableOutput: draft?.hadRenderableOutput === true,
    hadToolCalls: draft?.hadToolCalls === true,
    truncatedFields: Object.freeze(['message', 'stderrExcerpt']),
  };
  const safeShort = (value) => {
    try {
      if (typeof value !== 'string' || !value) return undefined;
      return truncateUtf8Prefix(value, SHORT_IDENTIFIER_BYTES);
    } catch {
      return undefined;
    }
  };
  for (const field of ['modelId', 'providerCode', 'errorName', 'signal', 'lastCanonicalEventType']) {
    const value = safeShort(draft?.[field]);
    if (value !== undefined) candidate[field] = value;
  }
  try {
    if (Number.isFinite(draft?.exitCode)) candidate.exitCode = draft.exitCode;
  } catch {
    // Keep the fallback minimal if even reading the field throws.
  }
  return Object.freeze(candidate);
}

function enforceSerializedCap(candidate, markers) {
  let guard = 0;
  while (byteLength(JSON.stringify(candidate)) > SERIALIZED_LIMIT_BYTES && guard < 200) {
    guard += 1;
    const messageChars = candidate.message === undefined ? 0 : Array.from(candidate.message).length;
    const stderrChars = candidate.stderrExcerpt === undefined ? 0 : Array.from(candidate.stderrExcerpt).length;
    if (messageChars === 0 && stderrChars === 0) break;
    if (messageChars >= stderrChars && messageChars > 0) {
      candidate.message = cutHalfPrefix(candidate.message);
      markers.add('message');
    } else {
      candidate.stderrExcerpt = cutHalfSuffix(candidate.stderrExcerpt);
      markers.add('stderrExcerpt');
    }
    if (candidate.message === '') delete candidate.message;
    if (candidate.stderrExcerpt === '') delete candidate.stderrExcerpt;
  }
}

async function runRedactionPipeline(draft, options) {
  requireClosedDraftShape(draft);

  const markers = createMarkerRecorder(
    Array.isArray(draft.truncatedFields) ? draft.truncatedFields : [],
  );
  const replacements = await collectExactValueReplacements(options);

  const homePath = typeof options.homePath === 'string' ? options.homePath : '';
  const workspaceRoot = typeof options.workspaceRoot === 'string' ? options.workspaceRoot : '';
  const prefixes = [
    { prefix: homePath, token: '$HOME' },
    { prefix: workspaceRoot, token: '$WORKSPACE' },
  ].sort((a, b) => b.prefix.length - a.prefix.length);

  const candidate = {
    version: CANDIDATE_VERSION,
    harnessId: optionalStringField(draft, 'harnessId', SHORT_IDENTIFIER_BYTES, markers),
    category: draft.category,
    hadRenderableOutput: draft.hadRenderableOutput,
    hadToolCalls: draft.hadToolCalls,
  };
  candidate.truncatedFields = markers.list();

  for (const field of ['modelId', 'providerCode', 'errorName', 'signal', 'lastCanonicalEventType']) {
    const value = optionalStringField(draft, field, SHORT_IDENTIFIER_BYTES, markers);
    if (value !== undefined) candidate[field] = value;
  }
  if (Number.isFinite(draft.exitCode)) candidate.exitCode = draft.exitCode;

  if (typeof draft.message === 'string' && draft.message.length > 0) {
    const redactedMessage = redactFreeFormText(draft.message, replacements, prefixes);
    const boundedMessage = truncateUtf8Prefix(redactedMessage, MESSAGE_PREFIX_BYTES);
    if (redactedMessage.length > 0) {
      candidate.message = boundedMessage;
      if (boundedMessage !== redactedMessage) markers.add('message');
    } else {
      markers.add('message'); // fully consumed by replacement — record it
    }
  }

  if (typeof draft.stderrExcerpt === 'string' && draft.stderrExcerpt.length > 0) {
    const redactedStderr = redactFreeFormText(draft.stderrExcerpt, replacements, prefixes);
    const boundedStderr = truncateUtf8Tail(redactedStderr, STDERR_TAIL_BYTES);
    if (redactedStderr.length > 0) {
      candidate.stderrExcerpt = boundedStderr;
      if (boundedStderr !== redactedStderr) markers.add('stderrExcerpt');
    } else {
      markers.add('stderrExcerpt');
    }
  }

  candidate.truncatedFields = Object.freeze(markers.list());
  enforceSerializedCap(candidate, markers);
  candidate.truncatedFields = Object.freeze(markers.list());

  return Object.freeze(candidate);
}

/**
 * Redact a closed-field diagnostic draft into an already-redacted V1
 * candidate. Never throws: on internal failure it returns the structured
 * fields only, with the free-form text dropped and fixed-name markers
 * recorded (fail-closed rule 9).
 *
 * @param {object} draft closed-field candidate draft (V1 field names)
 * @param {{getConfiguredSecrets?: () => Promise<string[]>, homePath?: string,
 *          workspaceRoot?: string, env?: object}} [options]
 * @returns {Promise<object>} frozen HarnessDiagnosticCandidateV1-shaped object
 */
async function redactHarnessDiagnosticDraft(draft, options = {}) {
  try {
    return await runRedactionPipeline(draft, options);
  } catch {
    return structuredOnlyFallback(draft);
  }
}

module.exports = {
  redactHarnessDiagnosticDraft,
  SENSITIVE_ENV_KEY_PATTERN,
  ADAPTER_CREDENTIAL_ENV_KEYS,
  TRUNCATION_MARKER_NAMES,
  SHORT_IDENTIFIER_BYTES,
  MESSAGE_PREFIX_BYTES,
  STDERR_TAIL_BYTES,
  MAX_TRUNCATION_MARKERS,
  SERIALIZED_LIMIT_BYTES,
};
