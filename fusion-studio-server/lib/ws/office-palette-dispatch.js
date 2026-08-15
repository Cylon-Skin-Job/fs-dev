'use strict';

const { createOfficePaletteHandlers } = require('./office-palette-handlers');

function createOfficePaletteDispatch({ ws, session, handleNext }) {
  const handlers = createOfficePaletteHandlers({ ws, session });

  return async function handlePaletteOrNext(raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return handleNext(raw);
    }
    const handler = handlers[message?.type];
    return handler ? handler(message) : handleNext(raw);
  };
}

module.exports = { createOfficePaletteDispatch };
