const { app } = require('electron');
const path = require('path');
const fs = require('fs');

function portFilePath() {
  return path.join(app.getPath('userData'), 'server.port');
}

function writePort(port) {
  try { fs.writeFileSync(portFilePath(), String(port), 'utf8'); } catch {}
}

function clearPort() {
  try { fs.unlinkSync(portFilePath()); } catch {}
}

module.exports = { writePort, clearPort };
