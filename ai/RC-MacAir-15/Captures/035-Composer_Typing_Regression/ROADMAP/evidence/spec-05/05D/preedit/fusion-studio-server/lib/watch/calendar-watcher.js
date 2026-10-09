/**
 * Apple Calendar directory watcher.
 *
 * Replaces lib/calendar/apple/watcher.js. Uses core.js instead of standalone chokidar.
 */

const os = require('os');
const path = require('path');
const { subscribe } = require('./core');

const CALENDAR_DIR = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.calendar'
);

function start(onTrigger) {
  const unsub = subscribe({
    id: 'calendar',
    path: CALENDAR_DIR,
    options: {
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    },
    handler: (event, filePath) => onTrigger(event, filePath),
  });

  return unsub;
}

module.exports = { start };
