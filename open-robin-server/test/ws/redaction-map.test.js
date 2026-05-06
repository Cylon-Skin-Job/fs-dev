'use strict';

const { redactWsMessage, RULES, REDACTED } = require('../../lib/ws/redaction-map');

describe('redactWsMessage', () => {
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

  test('unknown message type passes through unchanged (identity)', () => {
    const input = { type: 'thread:create', title: 'hi', payload: { value: 'not-a-secret' } };
    const out = redactWsMessage(input);
    expect(out).toEqual(input);
    expect(out).toBe(input);
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
