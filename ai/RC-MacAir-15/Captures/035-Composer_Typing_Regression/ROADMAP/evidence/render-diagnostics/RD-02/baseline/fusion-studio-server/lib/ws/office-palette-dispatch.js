'use strict';

const { createOfficePaletteHandlers } = require('./office-palette-handlers');
const { decodeClientTextFrame } = require('./client-frame-decoder');

function createOfficePaletteDispatch({ ws, session, handleNext }) {
  const handlers = createOfficePaletteHandlers({ ws, session });

  return async function handlePaletteOrNext(raw, isBinary = false) {
    let message;
    try {
      message = decodeClientTextFrame(raw, isBinary).value;
    } catch {
      return handleNext(raw, isBinary);
    }
    const handler = handlers[message?.type];
    return handler ? handler(message) : handleNext(raw, isBinary);
  };
}

module.exports = { createOfficePaletteDispatch };
