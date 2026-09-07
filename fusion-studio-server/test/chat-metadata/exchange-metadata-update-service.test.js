'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-exchange-metadata-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, getDb, closeDb } = require('../../lib/db');
const { updateExchangeMetadata } = require('../../lib/chat-metadata/exchange-metadata-update-service');

async function insertThread(threadId) {
  const db = getDb();
  const now = Date.now();
  await db('threads').insert({
    thread_id: threadId,
    workspace_id: 'workspace-test',
    project_id: 'project-test',
    scope: 'project',
    view_id: null,
    name: null,
    created_at: new Date(now).toISOString(),
    message_count: 0,
    status: 'suspended',
    updated_at: now,
    harness_id: 'opencode',
    harness_config: null,
  });
}

async function insertExchange(threadId, metadata) {
  const db = getDb();
  const inserted = await db('exchanges').insert({
    thread_id: threadId,
    seq: 1,
    ts: Date.now(),
    user_input: 'hello',
    assistant: JSON.stringify({ parts: [{ type: 'text', content: 'hi' }] }),
    metadata,
  });
  return Array.isArray(inserted) ? inserted[0] : inserted;
}

async function readMetadata(exchangeId) {
  const row = await getDb()('exchanges').where({ id: exchangeId }).first();
  return JSON.parse(row.metadata);
}

describe('updateExchangeMetadata', () => {
  beforeEach(async () => {
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  afterAll(() => {
    if (previousUserDataDir === undefined) {
      delete process.env.FUSION_APP_USER_DATA;
    } else {
      process.env.FUSION_APP_USER_DATA = previousUserDataDir;
    }
  });

  test('patching bookmark preserves unrelated metadata and existing createdAt', async () => {
    const threadId = 'metadata-thread-1';
    await insertThread(threadId);
    const exchangeId = await insertExchange(threadId, JSON.stringify({
      attachments: [{ path: 'docs/spec.md' }],
      mentions: ['@README.md'],
      fileMutations: [{ path: 'src/app.ts' }],
      contextUsage: 42,
      tokenUsage: 99,
      bookmark: { type: 'flag', createdAt: 1000, updatedAt: 1000 },
    }));

    const result = await updateExchangeMetadata({
      workspaceId: 'workspace-test',
      threadId,
      exchangeId,
      patch: { bookmark: { type: 'star' } },
      now: 2000,
    });

    expect(result.metadata).toMatchObject({
      attachments: [{ path: 'docs/spec.md' }],
      mentions: ['@README.md'],
      fileMutations: [{ path: 'src/app.ts' }],
      contextUsage: 42,
      tokenUsage: 99,
      bookmark: { type: 'star', createdAt: 1000, updatedAt: 2000 },
    });
    await expect(readMetadata(exchangeId)).resolves.toEqual(result.metadata);
  });

  test('bookmark null removes only bookmark and keeps note', async () => {
    const threadId = 'metadata-thread-2';
    await insertThread(threadId);
    const exchangeId = await insertExchange(threadId, JSON.stringify({
      bookmark: { type: 'heart', createdAt: 1000, updatedAt: 1000 },
      note: { body: 'keep this', createdAt: 1100, updatedAt: 1100 },
    }));

    const result = await updateExchangeMetadata({
      workspaceId: 'workspace-test',
      threadId,
      exchangeId,
      patch: { bookmark: null },
      now: 2000,
    });

    expect(result.metadata.bookmark).toBeNull();
    expect(result.metadata.note).toEqual({ body: 'keep this', createdAt: 1100, updatedAt: 1100 });
  });

  test('notes-only update modifies note and leaves bookmark unchanged', async () => {
    const threadId = 'metadata-thread-3';
    await insertThread(threadId);
    const bookmark = { type: 'flag', createdAt: 1000, updatedAt: 1000 };
    const exchangeId = await insertExchange(threadId, JSON.stringify({
      bookmark,
      note: { body: 'old', createdAt: 1200, updatedAt: 1200 },
    }));

    const result = await updateExchangeMetadata({
      workspaceId: 'workspace-test',
      threadId,
      exchangeId,
      patch: { note: { body: 'new note' } },
      now: 2200,
    });

    expect(result.metadata.bookmark).toEqual(bookmark);
    expect(result.metadata.note).toEqual({ body: 'new note', createdAt: 1200, updatedAt: 2200 });
  });

  test('empty note body normalizes to null without touching bookmark', async () => {
    const threadId = 'metadata-thread-4';
    await insertThread(threadId);
    const bookmark = { type: 'star', createdAt: 1000, updatedAt: 1000 };
    const exchangeId = await insertExchange(threadId, JSON.stringify({
      bookmark,
      note: { body: 'old', createdAt: 1200, updatedAt: 1200 },
    }));

    const result = await updateExchangeMetadata({
      workspaceId: 'workspace-test',
      threadId,
      exchangeId,
      patch: { note: { body: '   ' } },
      now: 2200,
    });

    expect(result.metadata.bookmark).toEqual(bookmark);
    expect(result.metadata.note).toBeNull();
  });

  test('legacy array metadata normalizes to object', async () => {
    const threadId = 'metadata-thread-5';
    await insertThread(threadId);
    const exchangeId = await insertExchange(threadId, '[]');

    const result = await updateExchangeMetadata({
      workspaceId: 'workspace-test',
      threadId,
      exchangeId,
      patch: { note: { body: 'fresh' } },
      now: 3000,
    });

    expect(result.metadata).toEqual({
      note: { body: 'fresh', createdAt: 3000, updatedAt: 3000 },
    });
  });

  test('invalid JSON metadata normalizes to object', async () => {
    const threadId = 'metadata-thread-6';
    await insertThread(threadId);
    const exchangeId = await insertExchange(threadId, '{not-json');

    const result = await updateExchangeMetadata({
      workspaceId: 'workspace-test',
      threadId,
      exchangeId,
      patch: { bookmark: { type: 'heart' } },
      now: 3500,
    });

    expect(result.metadata).toEqual({
      bookmark: { type: 'heart', createdAt: 3500, updatedAt: 3500 },
    });
  });

  test('thread ownership is required for updates', async () => {
    await insertThread('metadata-thread-owner');
    await insertThread('metadata-thread-other');
    const exchangeId = await insertExchange('metadata-thread-owner', JSON.stringify({
      attachments: [{ path: 'keep.md' }],
    }));

    await expect(updateExchangeMetadata({
      workspaceId: 'workspace-test',
      threadId: 'metadata-thread-other',
      exchangeId,
      patch: { bookmark: { type: 'flag' } },
      now: 4000,
    })).rejects.toThrow('Exchange not found');

    await expect(readMetadata(exchangeId)).resolves.toEqual({
      attachments: [{ path: 'keep.md' }],
    });
  });

  test('workspace ownership is required for reads and updates', async () => {
    const threadId = 'metadata-thread-workspace-owner';
    await insertThread(threadId);
    const exchangeId = await insertExchange(threadId, JSON.stringify({
      note: { body: 'preserve', createdAt: 1000, updatedAt: 1000 },
    }));

    await expect(updateExchangeMetadata({
      workspaceId: 'workspace-other',
      threadId,
      exchangeId,
      patch: { note: { body: 'cross-workspace mutation' } },
      now: 5000,
    })).rejects.toThrow('Exchange not found');

    await expect(readMetadata(exchangeId)).resolves.toEqual({
      note: { body: 'preserve', createdAt: 1000, updatedAt: 1000 },
    });
  });
});
