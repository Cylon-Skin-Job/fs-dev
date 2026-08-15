'use strict';

const ERROR_MESSAGES = Object.freeze({
  INVALID_REQUEST: 'The palette request is invalid.',
  UNKNOWN_WORKSPACE: 'The workspace is not registered.',
  WORKSPACE_NOT_ACTIVE: 'The workspace is not active for this connection.',
  PATH_REJECTED: 'The workspace palette path is not trusted.',
  SYMLINK_REJECTED: 'Symbolic links are not allowed in the workspace palette path.',
  NOT_REGULAR_FILE: 'The workspace palette is not a regular file.',
  INVALID_SCHEMA: 'The workspace palette has an invalid schema.',
  FILE_TOO_LARGE: 'The workspace palette exceeds the size limit.',
  READ_FAILED: 'The workspace palette could not be read.',
  PALETTE_LIMIT: 'The workspace palette already has 20 colors.',
  DIRECTORY_CREATE_FAILED: 'The workspace palette directory could not be created safely.',
  READ_ONLY: 'The workspace palette is read-only.',
  WRITE_FAILED: 'The workspace palette could not be written.',
});

class PaletteError extends Error {
  constructor(code, options = {}) {
    const safeCode = Object.hasOwn(ERROR_MESSAGES, code) ? code : 'READ_FAILED';
    super(ERROR_MESSAGES[safeCode]);
    this.name = 'PaletteError';
    this.code = safeCode;
    if (typeof options.syncEnabled === 'boolean') this.syncEnabled = options.syncEnabled;
  }
}

function toPaletteError(error, fallback = 'READ_FAILED', options = {}) {
  if (error instanceof PaletteError) return error;
  if (error && error.code === 'ELOOP') return new PaletteError('SYMLINK_REJECTED', options);
  if (error && ['EACCES', 'EPERM', 'EROFS'].includes(error.code)) {
    return new PaletteError(fallback === 'READ_FAILED' ? 'READ_FAILED' : 'READ_ONLY', options);
  }
  return new PaletteError(fallback, options);
}

module.exports = { ERROR_MESSAGES, PaletteError, toPaletteError };
