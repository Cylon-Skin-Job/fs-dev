const os = require('os');
const path = require('path');
const fs = require('fs');
const appleWatcher = require('../watch/calendar-watcher');
const appleSync = require('./apple/sync');
const googlePoller = require('./google/poller');

const APPLE_CALENDAR_DB = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb'
);

function start() {
  if (fs.existsSync(APPLE_CALENDAR_DB)) {
    appleWatcher.start(() => appleSync.run());
  }

  // Google adapter self-checks for secrets — starts only if configured
  googlePoller.start();
}

module.exports = { start };
