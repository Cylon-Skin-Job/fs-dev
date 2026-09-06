'use strict';

function compareOrdinalStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

module.exports = { compareOrdinalStrings };
