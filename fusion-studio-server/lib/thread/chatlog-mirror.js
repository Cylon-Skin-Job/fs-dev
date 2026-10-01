'use strict';

// Disposable Markdown projection and durable recovery instructions. SQLite
// exchanges remain canonical; this owner never writes an exchange/session row.
const path = require('path');
const fs = require('fs').promises;
const { ChatFile } = require('./ChatFile');
const repository = require('../thread-groups/repository');
const journal = require('./mirror-journal');
const aiPaths = require('../workspace/ai-paths');

function asPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function assistantTextFromParts(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part) => part?.type === 'text' && typeof part.content === 'string')
    .map((part) => part.content)
    .join('');
}

function hasToolCallsFromParts(parts) {
  return Array.isArray(parts) && parts.some((part) => part?.type === 'tool_call');
}

function withChatMirrorMetadata(threadId, exchange) {
  const metadata = { ...asPlainObject(exchange.metadata) };
  const existingMirror = asPlainObject(metadata.chatMirror);
  const turnId = metadata.turnId || existingMirror.turnId || null;

  if (turnId && metadata.turnId === undefined) {
    metadata.turnId = turnId;
  }

  metadata.chatMirror = {
    ...existingMirror,
    threadId,
    exchangeId: exchange.exchangeId,
    seq: exchange.seq,
    turnId,
  };

  return metadata;
}

function buildChatlogMessagesFromExchanges(threadId, exchanges) {
  return exchanges.flatMap((exchange) => {
    const parts = Array.isArray(exchange.assistant?.parts) ? exchange.assistant.parts : [];
    return [
      {
        role: 'user',
        content: exchange.user || '',
        hasToolCalls: false,
      },
      {
        role: 'assistant',
        content: assistantTextFromParts(parts),
        hasToolCalls: hasToolCallsFromParts(parts),
        metadata: withChatMirrorMetadata(threadId, exchange),
      },
    ];
  });
}

class ChatlogMirror {
  constructor({ workspaceId, projectRoot, getDb, getThread, readHistory }) {
    Object.assign(this, { workspaceId, projectRoot, getDb, getThread, readHistory });
    // Short-lived file operations only, never a second runtime/session map.
    this.pendingWrites = new Map();
  }

  key(threadId) { return `chatlog:${threadId}`; }
  directory() {
    return path.join(aiPaths.getMachineAiRoot(this.projectRoot), 'Data', 'Chatlogs', 'threads');
  }
  file(threadId) { return new ChatFile({ chatlogDir: this.directory(), threadId }); }

  async stage(trx, { threadId, groupId, operation }) {
    const now = Date.now();
    await repository.insertMirrorRecovery(trx, {
      workspaceId: this.workspaceId, groupId, threadId, mirrorKey: this.key(threadId),
      operation, status: 'pending', createdAt: now, updatedAt: now,
    });
  }

  async serialize(threadId, operation) {
    const previous = this.pendingWrites.get(threadId) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.pendingWrites.set(threadId, current);
    try { return await current; }
    finally { if (this.pendingWrites.get(threadId) === current) this.pendingWrites.delete(threadId); }
  }

  async write(threadId) {
    const entry = await this.getThread(threadId);
    if (!entry) return { updated: false, written: 0, reason: 'thread-not-found' };
    const history = await this.readHistory(threadId);
    const exchanges = Array.isArray(history?.exchanges) ? history.exchanges : [];
    const messages = buildChatlogMessagesFromExchanges(threadId, exchanges);
    await this.file(threadId).write(entry.name, messages);
    return { updated: true, written: messages.length,
      reason: exchanges.length ? 'rewritten-from-sqlite' : 'empty' };
  }

  async sync(threadId) {
    return this.serialize(threadId, async () => {
      const db = this.getDb();
      await journal.invalidate(db, threadId);
      const record = await journal.read(db, this.workspaceId, threadId);
      const identity = { workspaceId: this.workspaceId, mirrorKey: this.key(threadId),
        operation: 'create', expectedUpdatedAt: record?.updated_at ?? null };
      try {
        const result = await this.write(threadId);
        await repository.markMirrorRecovery(db, { ...identity, status: 'complete', now: Date.now() });
        return result;
      } catch (error) {
        try {
          await repository.markMirrorRecovery(db, { ...identity, status: 'failed',
            failureCode: 'mirror_write_failed', now: Date.now() });
        } catch (_) { /* Pending instruction survives the ACK outage. */ }
        throw error;
      }
    });
  }

  async rename(threadId) {
    return this.sync(threadId);
  }

  async deliver(threadId, operation) {
    const db = this.getDb();
    const identity = { workspaceId: this.workspaceId, mirrorKey: this.key(threadId), operation };
    try {
      if (operation === 'create') { await this.sync(threadId); return true; }
      await this.serialize(threadId, () => fs.rm(this.file(threadId).filePath, { force: true }));
      await repository.markMirrorRecovery(db, { ...identity, status: 'complete', now: Date.now() });
      return true;
    } catch (error) {
      // A failed acknowledgement (including a failed failure-status write)
      // leaves the original committed journal retryable, never rejects commit.
      try {
        if (operation === 'create') return false;
        await repository.markMirrorRecovery(db, { ...identity, status: 'failed',
          failureCode: 'mirror_delete_failed', now: Date.now() });
      } catch (_) { /* The original instruction is still durable. */ }
      return false;
    }
  }

  async recover(groupId = null) {
    const pending = await repository.listPendingMirrorRecovery(this.getDb(), this.workspaceId);
    for (const record of pending) {
      if (groupId && record.group_id !== groupId) continue;
      await this.deliver(record.thread_id, record.operation);
    }
  }

  async reconcileRetired() {
    const record = await this.getDb()('system_config').where('key', 'thread_group.retirement.041').first();
    if (!record) return;
    let parsed;
    try { parsed = JSON.parse(record.value); } catch { return; }
    const ids = Array.isArray(parsed?.threadIds) ? parsed.threadIds.slice(0, 100) : [];
    for (const id of ids) {
      if (typeof id !== 'string' || !id) continue;
      await this.serialize(id, () => fs.rm(this.file(id).filePath, { force: true })).catch(() => {});
    }
  }
}

module.exports = { ChatlogMirror };
