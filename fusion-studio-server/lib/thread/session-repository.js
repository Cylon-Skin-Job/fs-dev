'use strict';

// Session SQL always uses the command owner’s initialized transaction.
async function deleteRows(trx, workspaceId, threadIds) {
  return trx('threads').where('workspace_id', workspaceId).where('scope', 'project')
    .whereIn('thread_id', threadIds).del();
}

async function insertRow(trx, workspaceId, threadId, name, options = {}) {
  const createdAt = new Date().toISOString();
  await trx('threads').insert({
    thread_id: threadId,
    workspace_id: workspaceId,
    project_id: options.projectId || null,
    scope: 'project',
    view_id: null,
    name,
    created_at: createdAt,
    message_count: 0,
    status: 'suspended',
    updated_at: Date.now(),
    harness_id: options.harnessId || 'kimi',
    harness_config: options.harnessConfig ? JSON.stringify(options.harnessConfig) : null,
  });
  return createdAt;
}

module.exports = { insertRow, deleteRows };
