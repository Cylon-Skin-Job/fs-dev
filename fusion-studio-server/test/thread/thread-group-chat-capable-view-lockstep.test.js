'use strict';

/**
 * SPEC-05 §6 — Capability lockstep enforcement.
 *
 * The server's chat-capable view set (`lib/thread-groups/chat-capable-views.js`,
 * `CHAT_CAPABLE_VIEW_IDS`) and the client's mirror
 * (`fusion-studio-client/src/lib/worksurface/sideChatViews.ts`,
 * `SIDE_CHAT_CAPABLE_VIEW_IDS`) must stay identical. They are held in lockstep
 * by convention only; this test turns that convention into enforcement by
 * asserting exact, order-insensitive set equality.
 *
 * The client module is TypeScript owned by the Vite/Electron renderer; it is not
 * importable from the server at runtime. To avoid any runtime coupling or a new
 * build step, this test reads the client source as text and extracts the id
 * string literals from the `SIDE_CHAT_CAPABLE_VIEW_IDS` initializer.
 */

const fs = require('fs');
const path = require('path');

const { CHAT_CAPABLE_VIEW_IDS } = require('../../lib/thread-groups/chat-capable-views');

const CLIENT_SIDE_CHAT_VIEWS_PATH = path.resolve(
  __dirname,
  '../../../fusion-studio-client/src/lib/worksurface/sideChatViews.ts'
);

/**
 * Extract the client-side id literal set from the `sideChatViews.ts` source.
 * Robust to reformatting: the id literals are read only from inside the
 * `SIDE_CHAT_CAPABLE_VIEW_IDS` initializer, stopping at its closing `]))` / `]));`.
 *
 * @param {string} source
 * @returns {Set<string>}
 */
function extractClientViewIds(source) {
  const initializer = source.match(
    /SIDE_CHAT_CAPABLE_VIEW_IDS[\s\S]*?=\s*[\s\S]*?new\s+Set\(\s*\[([\s\S]*?)\]\s*\)\s*\)/
  );
  if (!initializer) {
    throw new Error(
      'Lockstep guard could not locate the SIDE_CHAT_CAPABLE_VIEW_IDS initializer in ' +
        CLIENT_SIDE_CHAT_VIEWS_PATH +
        '. A rename or restructure of the client set would silently disable this guard; ' +
        'update the extraction in test/thread/thread-group-chat-capable-view-lockstep.test.js.'
    );
  }

  const ids = new Set();
  const literal = /'([^']+)'|"([^"]+)"/g;
  let match;
  while ((match = literal.exec(initializer[1])) !== null) {
    ids.add(match[1] !== undefined ? match[1] : match[2]);
  }
  return ids;
}

/** Human-readable sorted view list for failure messages. */
function formatIds(ids) {
  return `[${[...ids].sort().join(', ')}]`;
}

/** Symmetric difference between the two sets. */
function symmetricDifference(a, b) {
  return new Set([...a].filter((id) => !b.has(id)).concat([...b].filter((id) => !a.has(id))));
}

describe('chat capable view lockstep (SPEC-05 §6)', () => {
  it('server and client chat-capable view sets are identical', () => {
    const serverIds = new Set(CHAT_CAPABLE_VIEW_IDS);

    const source = fs.readFileSync(CLIENT_SIDE_CHAT_VIEWS_PATH, 'utf8');
    const clientIds = extractClientViewIds(source);

    // Fail loudly if either parse collapses to an empty set: an empty set would
    // otherwise make a future rename silently "pass" because both sides match.
    if (serverIds.size === 0) {
      throw new Error('Lockstep guard parsed an empty server set; refusing to pass.');
    }
    if (clientIds.size === 0) {
      throw new Error(
        'Lockstep guard parsed an empty client set from ' +
          CLIENT_SIDE_CHAT_VIEWS_PATH +
          '; refusing to pass because the extraction may have silently broken.'
      );
    }

    const mismatch = symmetricDifference(serverIds, clientIds);
    if (mismatch.size > 0) {
      throw new Error(
        'Chat-capable view sets have drifted between server and client.\n' +
          `  server (${serverIds.size}):               ${formatIds(serverIds)}\n` +
          `  client (${clientIds.size}):               ${formatIds(clientIds)}\n` +
          `  symmetric difference (${mismatch.size}): ${formatIds(mismatch)}`
      );
    }

    // Exact, order-insensitive set equality (redundant with the check above but
    // keeps the assertion explicit and machine-checked).
    expect(serverIds).toEqual(clientIds);
  });
});
