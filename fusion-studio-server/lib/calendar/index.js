const googlePoller = require('./google/poller');
const { isEnabled } = require('../background-services/config');

function start() {
  if (isEnabled('calendar.google')) {
    googlePoller.start();
  } else {
    console.log('[Calendar:Google] disabled: opt-in not enabled');
  }
}

module.exports = { start };
