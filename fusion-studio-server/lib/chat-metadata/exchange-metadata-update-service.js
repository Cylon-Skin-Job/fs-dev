'use strict';

const { getDb } = require('../db');

const BOOKMARK_TYPES = new Set(['flag', 'star', 'heart']);

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeMetadata(rawMetadata) {
  if (!rawMetadata) return {};

  if (typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) {
    return { ...rawMetadata };
  }

  if (typeof rawMetadata !== 'string') return {};

  try {
    const parsed = JSON.parse(rawMetadata);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return { ...parsed };
  } catch {
    return {};
  }
}

function getExistingCreatedAt(value, fallback) {
  if (!value || typeof value !== 'object') return fallback;
  return typeof value.createdAt === 'number' ? value.createdAt : fallback;
}

function assertValidBookmarkPatch(bookmark) {
  if (!bookmark || typeof bookmark !== 'object' || Array.isArray(bookmark)) {
    throw new Error('Invalid bookmark patch');
  }
  if (!BOOKMARK_TYPES.has(bookmark.type)) {
    throw new Error('Invalid bookmark type');
  }
}

function assertValidNotePatch(note) {
  if (!note || typeof note !== 'object' || Array.isArray(note)) {
    throw new Error('Invalid note patch');
  }
  if (typeof note.body !== 'string') {
    throw new Error('Invalid note body');
  }
}

function assertUpdateInput({ threadId, exchangeId, patch }) {
  if (!threadId || typeof threadId !== 'string') {
    throw new Error('threadId is required');
  }

  const numericExchangeId = Number(exchangeId);
  if (!Number.isInteger(numericExchangeId) || numericExchangeId <= 0) {
    throw new Error('exchangeId is required');
  }

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('patch is required');
  }

  return numericExchangeId;
}

async function updateExchangeMetadata({ threadId, exchangeId, patch, now = Date.now() }) {
  const numericExchangeId = assertUpdateInput({ threadId, exchangeId, patch });
  const db = getDb();

  const row = await db('exchanges')
    .where({ id: numericExchangeId, thread_id: threadId })
    .first();

  if (!row) {
    throw new Error('Exchange not found');
  }

  const metadata = normalizeMetadata(row.metadata);

  if (hasOwn(patch, 'bookmark')) {
    if (patch.bookmark === null) {
      metadata.bookmark = null;
    } else {
      assertValidBookmarkPatch(patch.bookmark);
      metadata.bookmark = {
        type: patch.bookmark.type,
        createdAt: getExistingCreatedAt(metadata.bookmark, now),
        updatedAt: now,
      };
    }
  }

  if (hasOwn(patch, 'note')) {
    if (patch.note === null) {
      metadata.note = null;
    } else {
      assertValidNotePatch(patch.note);
      if (patch.note.body.trim() === '') {
        metadata.note = null;
      } else {
        metadata.note = {
          body: patch.note.body,
          createdAt: getExistingCreatedAt(metadata.note, now),
          updatedAt: now,
        };
      }
    }
  }

  await db('exchanges')
    .where({ id: numericExchangeId, thread_id: threadId })
    .update({ metadata: JSON.stringify(metadata) });

  return {
    threadId,
    exchangeId: numericExchangeId,
    metadata,
  };
}

module.exports = {
  updateExchangeMetadata,
  normalizeMetadata,
};
