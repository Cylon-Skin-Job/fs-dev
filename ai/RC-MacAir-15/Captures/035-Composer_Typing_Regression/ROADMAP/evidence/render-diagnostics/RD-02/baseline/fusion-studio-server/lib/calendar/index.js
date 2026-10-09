const os = require('os');
const path = require('path');
const fs = require('fs');
const appleWatcher = require('../watch/calendar-watcher');
const appleSync = require('./apple/sync');
const googlePoller = require('./google/poller');
const { isEnabled } = require('../background-services/config');
const { runSafely } = require('../background-services/safety');

const APPLE_CALENDAR_DB = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb'
);

function start() {
  if (isEnabled('calendar.apple')) {
    if (fs.existsSync(APPLE_CALENDAR_DB)) {
      appleWatcher.start(() => runSafely('Calendar:Apple sync', () => appleSync.run()));
    } else {
      console.log('[Calendar:Apple] disabled: local Calendar DB not found');
    }
  } else {
    console.log('[Calendar:Apple] disabled: opt-in not enabled');
  }

  if (isEnabled('calendar.google')) {
    googlePoller.start();
  } else {
    console.log('[Calendar:Google] disabled: opt-in not enabled');
  }
}

module.exports = { start };
