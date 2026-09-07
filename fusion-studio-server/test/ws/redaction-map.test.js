'use strict';

const { redactWsMessage, RULES, REDACTED } = require('../../lib/ws/redaction-map');

describe('redactWsMessage', () => {
  test('redacts every shell authentication secret and nonce field', () => {
    expect(redactWsMessage({
      type: 'shell-auth:proof', serverNonce: 'server', rendererNonce: 'renderer', proof: 'proof', generation: 'generation',
    })).toEqual({
      type: 'shell-auth:proof', serverNonce: REDACTED, rendererNonce: REDACTED, proof: REDACTED, generation: REDACTED,
    });
  });

  test('recursively suppresses authentication aliases without inspecting their values', () => {
    const canaries = {
      master: 'master-canary',
      generation: 'generation-canary',
      proof: 'proof-canary',
      challenge: 'challenge-canary',
      nonce: 'nonce-canary',
      authorization: 'authorization-canary',
      signature: 'signature-canary',
      hmac: 'hmac-canary',
      digest: 'digest-canary',
      secret: 'secret-canary',
      token: 'token-canary',
    };
    const shared = {
      bootstrap_master: canaries.master,
      shellGeneration: canaries.generation,
      nested: [{ renderer_nonce: canaries.nonce, derivedKey: canaries.hmac }],
    };
    const out = redactWsMessage({
      type: 'unknown:diagnostic',
      proof: canaries.proof,
      challengePayload: canaries.challenge,
      headers: { Authorization: canaries.authorization },
      authToken: canaries.token,
      secretMaterial: canaries.secret,
      aliases: [shared, shared],
      signature: canaries.signature,
      proofDigest: canaries.digest,
      keep: 'ordinary',
    });
    const serialized = JSON.stringify(out);
    expect(serialized).toContain(REDACTED);
    for (const canary of Object.values(canaries)) expect(serialized).not.toContain(canary);
    expect(out.keep).toBe('ordinary');
    expect(out.aliases[0]).toBe(out.aliases[1]);
  });

  test('client_log suppresses arbitrary message and data diagnostics', () => {
    const canary = 'actual-auth-material-canary';
    const out = redactWsMessage({
      type: 'client_log',
      level: 'warn',
      message: canary,
      data: { nested: { harmlessAlias: canary, serverNonce: canary } },
    });
    expect(out).toEqual({
      type: 'client_log', level: REDACTED, message: REDACTED, data: REDACTED,
    });
    expect(JSON.stringify(out)).not.toContain(canary);
  });
  test('clipboard:append redacts text, leaves other fields', () => {
    const input = { type: 'clipboard:append', text: 'sk_live_abc123', source: 'manual' };
    const out = redactWsMessage(input);
    expect(out.text).toBe('[redacted]');
    expect(out.source).toBe('manual');
    expect(out.type).toBe('clipboard:append');
  });

  test('clipboard:append response with nested item.text is redacted', () => {
    const input = { type: 'clipboard:append', item: { id: 1, text: 'leaked', preview: 'leaked' } };
    const out = redactWsMessage(input);
    expect(out.item.text).toBe('[redacted]');
    expect(out.item.id).toBe(1);
    expect(out.item.preview).toBe('leaked'); // preview is non-secret display data, not redacted by this map
  });

  test('clipboard:use response redacts value', () => {
    const input = { type: 'clipboard:use', id: 7, value: 'super-secret-token' };
    const out = redactWsMessage(input);
    expect(out.value).toBe('[redacted]');
    expect(out.id).toBe(7);
  });

  test('secrets:api-keys:set redacts value', () => {
    const input = { type: 'secrets:api-keys:set', key: 'GITLAB_TOKEN', value: 'glpat-xxx' };
    const out = redactWsMessage(input);
    expect(out.value).toBe('[redacted]');
    expect(out.key).toBe('GITLAB_TOKEN');
  });

  test('file_save redacts the complete content without mutating the handler copy', () => {
    const input = {
      type: 'file_save', version: 1, requestId: 'request-1',
      panel: 'file-viewer', path: 'note.md', content: 'top secret\nsecond line',
    };
    const out = redactWsMessage(input);
    expect(out).toEqual({ ...input, content: '[redacted]' });
    expect(input.content).toBe('top secret\nsecond line');
  });

  test('agent activity query redacts resource selectors without mutating the routed copy', () => {
    const input = {
      type: 'agent:activity:query',
      path: '/Users/alice/private/secret.txt',
      folderPrefix: '/Users/alice/private',
      fileName: 'secret.txt',
      subject: 'resource_edges',
    };
    const out = redactWsMessage(input);
    expect(out).toEqual({
      ...input,
      path: '[redacted]',
      folderPrefix: '[redacted]',
      fileName: '[redacted]',
    });
    expect(input.path).toBe('/Users/alice/private/secret.txt');
    expect(input.folderPrefix).toBe('/Users/alice/private');
    expect(input.fileName).toBe('secret.txt');
  });

  test('agent tool fixture redacts its authorization nonce without mutating the routed copy', () => {
    const input = {
      type: 'provenance:test:agent_tool',
      version: 1,
      requestId: 'fixture-1',
      nonce: '123e4567-e89b-42d3-a456-426614174000',
      fixture: 'edit-first-a',
    };
    const out = redactWsMessage(input);
    expect(out).toEqual({ ...input, nonce: '[redacted]' });
    expect(input.nonce).toBe('123e4567-e89b-42d3-a456-426614174000');
  });

  test('chat-turn:metadata:update redacts inbound note patch body', () => {
    const input = {
      type: 'chat-turn:metadata:update',
      threadId: 'thread-1',
      exchangeId: 12,
      patch: {
        bookmark: { type: 'flag' },
        note: { body: 'private note text' },
      },
    };
    const out = redactWsMessage(input);
    expect(out.patch.note.body).toBe('[redacted]');
    expect(out.patch.bookmark.type).toBe('flag');
    expect(out.exchangeId).toBe(12);
  });

  test('chat-turn:metadata:updated redacts outbound metadata note body', () => {
    const input = {
      type: 'chat-turn:metadata:updated',
      threadId: 'thread-1',
      exchangeId: 12,
      metadata: {
        note: { body: 'private note text', createdAt: 1, updatedAt: 2 },
        attachments: [{ path: 'docs/spec.md' }],
      },
    };
    const out = redactWsMessage(input);
    expect(out.metadata.note.body).toBe('[redacted]');
    expect(out.metadata.note.createdAt).toBe(1);
    expect(out.metadata.attachments).toEqual([{ path: 'docs/spec.md' }]);
  });

  test('unknown non-sensitive message values are preserved in a diagnostic clone', () => {
    const input = { type: 'thread:create', title: 'hi', payload: { value: 'not-a-secret' } };
    const out = redactWsMessage(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  test('does not mutate input', () => {
    const input = { type: 'clipboard:append', text: 'sk_live_abc...' };
    redactWsMessage(input);
    expect(input.text).toBe('sk_live_abc...');
  });

  test('nested path redaction only touches the leaf', () => {
    const SAVED = RULES['clipboard:append'];
    try {
      RULES['clipboard:append'] = { redactPaths: ['payload.value'] };
      const input = {
        type: 'clipboard:append',
        payload: { value: 'leaked', meta: { keep: 'me' } },
        sibling: 'untouched',
      };
      const out = redactWsMessage(input);
      expect(out.payload.value).toBe('[redacted]');
      expect(out.payload.meta.keep).toBe('me');
      expect(out.sibling).toBe('untouched');
    } finally {
      RULES['clipboard:append'] = SAVED;
    }
  });

  test('REDACTED is the literal string "[redacted]"', () => {
    expect(REDACTED).toBe('[redacted]');
    expect(typeof REDACTED).toBe('string');
  });

  test('non-object input passes through', () => {
    expect(redactWsMessage(null)).toBe(null);
    expect(redactWsMessage(undefined)).toBe(undefined);
    expect(redactWsMessage('string')).toBe('string');
  });
});
