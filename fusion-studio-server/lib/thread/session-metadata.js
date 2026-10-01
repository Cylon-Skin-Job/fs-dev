'use strict';

// Session metadata mutations preserve the group's visible title and mirror projection.
const { getDb } = require('../db');
const repository = require('../thread-groups/repository');
class SessionMetadata {
  constructor({ index, mirror }) { Object.assign(this, { index, mirror }); }

  async updateHarnessConfig(threadId, patch) {
    const entry = await this.index.get(threadId);
    if (!entry) return null;

    const harnessConfig = { ...(entry.harnessConfig || {}), ...patch };
    return this.index.update(threadId, { harnessConfig });
  }

  async renameThread(threadId, newName) {
    const oldEntry = await this.index.get(threadId);
    if (!oldEntry) return null;

    const entry = await this.index.rename(threadId, newName);
    if (!entry) return null;

    const db = getDb();
    const groupRow = await repository.getGroupForThread(db, threadId);
    if (groupRow) {
      await repository.renameGroup(db, groupRow.group_id, newName);
    }

    await this.mirror.rename(threadId, newName);

    return { threadId, entry };
  }

  async addMessage(threadId, message) {
    const entry = await this.index.get(threadId);
    if (!entry) throw new Error(`Thread not found: ${threadId}`);

    await this.index.incrementMessageCount(threadId);

    await this.index.touch(threadId);

    return { threadId, messageCount: entry.messageCount + 1 };
  }

  async recordSavedExchange(threadId, seq) {
    const messageCount = Math.max(0, Number(seq) || 0) * 2;
    await this.index.update(threadId, {
      messageCount,
      updatedAt: Date.now(),
    });
    return { threadId, messageCount };
  }
}
module.exports = { SessionMetadata };
