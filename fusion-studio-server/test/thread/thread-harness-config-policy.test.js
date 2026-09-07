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

test('stored Fork state is inert while ordinary exact OpenCode session resume remains supported', () => {
  expect(sanitizeRuntimeHarnessConfig('opencode', {
    model: 'm', opencodeSessionId: 'ordinary-session',
  })).toEqual({ model: 'm', opencodeSessionId: 'ordinary-session' });
  expect(sanitizeRuntimeHarnessConfig('opencode', {
    model: 'm',
    opencodeSessionId: 'forked-session',
    pendingFork: { sourceOpenCodeSessionId: 'source-session' },
    forkProvenance: { status: 'created' },
    apiKey: 'secret',
  })).toEqual({ model: 'm' });
  expect(sanitizeRuntimeHarnessConfig('opencode', {
    model: 'm', variant: null, opencodeSessionId: 'ordinary-session',
  })).toEqual({ model: 'm', variant: null, opencodeSessionId: 'ordinary-session' });
});

test('provider-owned updates purge legacy Fork state instead of merging it forward', () => {
  expect(mergeRuntimeHarnessConfig('opencode', {
    variant: 'high', pendingFork: { sourceOpenCodeSessionId: 'source-session' },
  }, { opencodeSessionId: 'new-session' })).toEqual({
    variant: 'high', opencodeSessionId: 'new-session',
  });
});
