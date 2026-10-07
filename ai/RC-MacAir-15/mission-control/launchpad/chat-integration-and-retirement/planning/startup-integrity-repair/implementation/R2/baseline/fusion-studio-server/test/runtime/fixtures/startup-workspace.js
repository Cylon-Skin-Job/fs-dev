'use strict';

const fs = require('fs');
const path = require('path');

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function createStartupWorkspace(root, machine) {
  const viewsRoot = path.join(root, 'ai', machine, 'System', 'Views');
  for (const [index, viewId] of ['issues-viewer', 'agents-viewer'].entries()) {
    const capsule = path.join(viewsRoot, `00${index + 1}-${viewId}`);
    write(path.join(capsule, 'manifest.md'), `---\nname: ${viewId}\nmetadata:\n  view-id: ${viewId}\n  data-source: folder\n---\n`);
    write(path.join(capsule, 'content.json'), JSON.stringify({
      version: 1, dataSource: 'folder', root: { type: 'workspace-relative', path: viewId },
    }));
    write(path.join(capsule, 'state/state.json'), '{}\n');
    if (viewId === 'issues-viewer') {
      write(path.join(capsule, 'scripts/create-ticket.js'), [
        "const fs = require('fs');",
        "const path = require('path');",
        "const output = path.join(__dirname, '../../../../../../ticket-receipts.jsonl');",
        "fs.appendFileSync(output, JSON.stringify({ kind: 'script-loaded' }) + '\\n');",
        'module.exports = function createTicket(ticket) {',
        "  fs.appendFileSync(output, JSON.stringify({ kind: 'ticket', ...ticket }) + '\\n');",
        "  return { id: 'scratch-ticket' };",
        '};',
      ].join('\n'));
    }
  }
  write(path.join(root, 'agents-viewer/registry.json'), JSON.stringify({
    agents: { scratch: { folder: 'scratch' } },
  }));
  const blocks = ['chat', 'ticket', 'agent', 'system'].map(type => [
    '---', `name: scratch-${type}`, `type: ${type}`, 'event: startup-canary',
    'action: send-message', `message: scratch-${type}`, '---', '',
  ].join('\n'));
  blocks.push('---\nname: scratch-cron\ntype: cron\nschedule: "* * * * *"\nmessage: scratch-cron\n---\n');
  write(path.join(root, 'agents-viewer/scratch/TRIGGERS.md'), blocks.join('\n'));
  write(path.join(root, 'ai/components/modals/scratch/settings/config.md'), '---\nname: scratch-modal\n---\n');
  write(path.join(root, 'ai/components/modals/scratch/settings/styles.css'), '.scratch { color: inherit; }\n');
  return { viewsRoot, ticketReceipts: path.join(root, 'ticket-receipts.jsonl') };
}

module.exports = { createStartupWorkspace };
