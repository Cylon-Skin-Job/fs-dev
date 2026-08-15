'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const {
  INVALID_TABLE_PRESENTATION,
  presentationError,
  validateAndBindOfficePayload,
} = require('../../../shared/office-table-presentation-validation.cjs');

async function nodeSha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function createOfficePdfHandlers(pdfBuilder) {
  if (!pdfBuilder || typeof pdfBuilder.build !== 'function') {
    throw new TypeError('A PDF builder is required');
  }
  const buildPdf = async (prepared, payload) => {
    if (payload.format !== undefined && payload.format !== 'pdf') {
      throw presentationError(INVALID_TABLE_PRESENTATION);
    }
    return pdfBuilder.build(prepared);
  };
  return Object.freeze({
    export: buildPdf,
    print: buildPdf,
    email: buildPdf,
  });
}

/** Shared builders for active Office download/email attachment adapters. */
function createSharedDocumentAttachmentBuilders({ pdfBuilder, docxBuilder } = {}) {
  if (!pdfBuilder || typeof pdfBuilder.build !== 'function') {
    throw new TypeError('A PDF builder is required');
  }
  if (!docxBuilder || typeof docxBuilder.build !== 'function') {
    throw new TypeError('A DOCX builder is required');
  }
  const buildOfficeArtifact = async (prepared, format, options) => {
    if (format === 'pdf') return pdfBuilder.build(prepared, options);
    if (format === 'docx') return docxBuilder.build(prepared, options);
    throw presentationError(INVALID_TABLE_PRESENTATION);
  };
  return Object.freeze({
    buildDownload(prepared, format, options) {
      return buildOfficeArtifact(prepared, format, options);
    },
    buildEmail(prepared, format, options) {
      return buildOfficeArtifact(prepared, format, options);
    },
    buildMarkdownEmail(fullMarkdown) {
      if (typeof fullMarkdown !== 'string') {
        throw presentationError(INVALID_TABLE_PRESENTATION);
      }
      return Object.freeze({ buffer: Buffer.from(fullMarkdown, 'utf8') });
    },
  });
}

function createOfficeAttachmentHandlers(attachmentBuilders) {
  if (
    !attachmentBuilders
    || typeof attachmentBuilders.buildDownload !== 'function'
    || typeof attachmentBuilders.buildEmail !== 'function'
  ) throw new TypeError('Shared attachment builders are required');
  return Object.freeze({
    export: (prepared, payload) => attachmentBuilders.buildDownload(prepared, payload.format),
    email: (prepared, payload) => attachmentBuilders.buildEmail(prepared, payload.format),
  });
}

function createDelayedPathRegistry({
  removePath = (candidate) => fs.rmSync(candidate, { force: true, recursive: true }),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const pending = new Map();
  let closed = false;

  const assertPath = (candidate) => {
    if (typeof candidate !== 'string' || candidate.length === 0) {
      throw new TypeError('A delayed cleanup path is required');
    }
  };

  const remove = (candidate) => {
    const record = pending.get(candidate);
    removePath(candidate);
    if (record?.timer !== undefined && record.timer !== null) clearTimer(record.timer);
    pending.delete(candidate);
  };

  return Object.freeze({
    track(candidate) {
      assertPath(candidate);
      if (closed) {
        if (!pending.has(candidate)) pending.set(candidate, { timer: null });
        try {
          remove(candidate);
        } catch (error) {
          throw new AggregateError(
            [new Error('Cleanup registry is closed'), error],
            'Post-shutdown output cleanup failed',
          );
        }
        throw new Error('Cleanup registry is closed');
      }
      if (pending.has(candidate)) throw new Error('Cleanup path is already tracked');
      pending.set(candidate, { timer: null });
    },
    schedule(candidate, delayMs) {
      assertPath(candidate);
      if (closed) throw new Error('Cleanup registry is closed');
      if (!Number.isSafeInteger(delayMs) || delayMs < 0) {
        throw new TypeError('A nonnegative cleanup delay is required');
      }
      const record = pending.get(candidate);
      if (!record) throw new Error('Cleanup path is not tracked');
      if (record.timer !== undefined && record.timer !== null) clearTimer(record.timer);
      let timer;
      timer = setTimer(() => {
        const active = pending.get(candidate);
        if (active?.timer === timer) active.timer = null;
        try { remove(candidate); } catch {}
      }, delayMs);
      timer?.unref?.();
      record.timer = timer;
    },
    remove,
    cleanup() {
      closed = true;
      const errors = [];
      for (const candidate of [...pending.keys()]) {
        try { remove(candidate); } catch (error) { errors.push(error); }
      }
      if (errors.length > 1) throw new AggregateError(errors, 'Delayed output cleanup failed');
      if (errors.length === 1) throw errors[0];
    },
    paths() {
      return Object.freeze([...pending.keys()]);
    },
  });
}

function createDocumentOutputCoordinator({ officeHandlers = {}, delayedPathRegistry } = {}) {
  const cleanupRegistry = delayedPathRegistry ?? createDelayedPathRegistry();
  return Object.freeze({
    async prepare(surface, payload) {
      return validateAndBindOfficePayload(payload, surface, nodeSha256Hex);
    },

    async run(surface, payload, legacyHandler) {
      const request = await validateAndBindOfficePayload(payload, surface, nodeSha256Hex);
      if (request.mode === 'legacy') return legacyHandler(payload);
      const officeHandler = officeHandlers[surface];
      if (typeof officeHandler !== 'function') {
        throw presentationError(INVALID_TABLE_PRESENTATION);
      }
      return officeHandler(request.prepared, request.payload);
    },

    trackCleanup(candidate) {
      cleanupRegistry.track(candidate);
    },

    scheduleCleanup(candidate, delayMs) {
      cleanupRegistry.schedule(candidate, delayMs);
    },

    cleanupPath(candidate) {
      cleanupRegistry.remove(candidate);
    },

    cleanup() {
      cleanupRegistry.cleanup();
    },

    pendingCleanupPaths() {
      return cleanupRegistry.paths();
    },
  });
}

module.exports = {
  createDocumentOutputCoordinator,
  createDelayedPathRegistry,
  createOfficeAttachmentHandlers,
  createOfficePdfHandlers,
  createSharedDocumentAttachmentBuilders,
};
