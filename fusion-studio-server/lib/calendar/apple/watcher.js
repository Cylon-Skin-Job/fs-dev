const chokidar = require('chokidar');
const os = require('os');
const path = require('path');

const CALENDAR_DIR = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.calendar'
);

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function start(onTrigger) {
  const trigger = debounce(onTrigger, 800);
  chokidar.watch(CALENDAR_DIR, {
    ignoreInitial: false,
    persistent: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  })
  .on('change', trigger)
  .on('add', trigger);
}

module.exports = { start };
