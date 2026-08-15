'use strict';

const path = require('path');

function createCycleGuard() {
  const visited = new Set();

  return {
    shouldEnter(realPath) {
      if (typeof realPath !== 'string' || realPath.length === 0) {
        return false;
      }

      const normalized = path.resolve(realPath);
      if (visited.has(normalized)) {
        return false;
      }

      visited.add(normalized);
      return true;
    },
  };
}

module.exports = {
  createCycleGuard,
};
