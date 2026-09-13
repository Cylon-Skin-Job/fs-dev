'use strict';

const {
  mergeRuntimeHarnessConfig,
  normalizeOpenAssistantRequest,
  normalizePortableHarnessConfig,
  sanitizeRuntimeHarnessConfig,
} = require('../../lib/thread/thread-harness-config-policy');

test('creation accepts only portable model and variant fields', () => {
  expect(normalizeOpenAssistantRequest({
    type: 'thread:open-assistant',
    harnessId: 'opencode',
    harnessConfig: { model: ' provider/model ', variant: ' high ' },
  })).toEqual({
    type: 'thread:open-assistant',
    harnessId: 'opencode',
    harnessConfig: { model: 'provider/model', variant: 'high' },
  });
  expect(normalizeOpenAssistantRequest({
    type: 'thread:open-assistant',
    harnessId: 'opencode',
    harnessConfig: { model: 'provider/model', variant: null },
  })).toEqual({
    type: 'thread:open-assistant',
    harnessId: 'opencode',
    harnessConfig: { model: 'provider/model', variant: null },
  });
  for (const request of [
    { type: 'thread:open-assistant', providerSessionId: 'session' },
    { type: 'thread:open-assistant', harnessConfig: { apiKey: 'secret' } },
    { type: 'thread:open-assistant', harnessConfig: { pendingFork: {} } },
    { type: 'thread:open-assistant', harnessConfig: { model: 42 } },
  ]) expect(normalizeOpenAssistantRequest(request)).toBeNull();
});

test('prompt selection configuration rejects provider-session, credential, and unknown fields', () => {
  expect(normalizePortableHarnessConfig({ model: 'm', variant: 'v' })).toEqual({
    ok: true, value: { model: 'm', variant: 'v' },
  });
  expect(normalizePortableHarnessConfig({ model: 'm', variant: null })).toEqual({
    ok: true, value: { model: 'm', variant: null },
  });
  for (const key of ['pendingFork', 'forkProvenance', 'opencodeSessionId', 'apiKey', 'unknown']) {
    expect(normalizePortableHarnessConfig({ [key]: 'value' }).ok).toBe(false);
  }
});

test('ordinary exact OpenCode session resume remains supported after Fork removal', () => {
  expect(sanitizeRuntimeHarnessConfig('opencode', {
    model: 'm', opencodeSessionId: 'ordinary-session',
  })).toEqual({ model: 'm', opencodeSessionId: 'ordinary-session' });
  expect(sanitizeRuntimeHarnessConfig('opencode', {
    model: 'm', variant: null, opencodeSessionId: 'ordinary-session',
  })).toEqual({ model: 'm', variant: null, opencodeSessionId: 'ordinary-session' });
  // Fork-era markers are no longer part of the harness contract; unknown fields
  // are dropped and stored fork-era sessions are retired by migration 041.
  expect(sanitizeRuntimeHarnessConfig('opencode', {
    model: 'm',
    opencodeSessionId: 'ordinary-session',
    pendingFork: { sourceOpenCodeSessionId: 'source-session' },
    forkProvenance: { status: 'created' },
    apiKey: 'secret',
  })).toEqual({ model: 'm', opencodeSessionId: 'ordinary-session' });
});

test('provider-owned updates drop unknown legacy fields instead of merging them forward', () => {
  expect(mergeRuntimeHarnessConfig('opencode', {
    variant: 'high', pendingFork: { sourceOpenCodeSessionId: 'source-session' },
  }, { opencodeSessionId: 'new-session' })).toEqual({
    variant: 'high', opencodeSessionId: 'new-session',
  });
});
