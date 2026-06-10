/**
 * @module transcription/history-subscriber
 * @role Persist transcription outputs from the server event bus.
 */

const { on } = require('../event-bus');
const { getDb } = require('../db');

const MAX_HISTORY_ROWS = 100;

async function pruneHistory(db) {
  const keepRows = await db('transcription_history')
    .select('id')
    .orderBy('id', 'desc')
    .limit(MAX_HISTORY_ROWS);

  if (keepRows.length < MAX_HISTORY_ROWS) return;

  const oldestKeptId = keepRows[keepRows.length - 1].id;
  await db('transcription_history')
    .where('id', '<', oldestKeptId)
    .del();
}

async function storeTranscription(event) {
  const db = getDb();
  const cleanup = event.cleanup || {};

  await db('transcription_history').insert({
    raw_text: event.rawText || '',
    corrected_text: event.correctedText || '',
    cleanup_capability: cleanup.capability || null,
    cleanup_model: cleanup.model || null,
    cleanup_provider: cleanup.provider || null,
    cleanup_success: cleanup.success ? 1 : 0,
    cleanup_error: cleanup.error || null,
    whisper_model: event.whisperModel || '',
    duration_ms: event.durationMs == null ? null : Number(event.durationMs),
    created_at: event.timestamp || Date.now(),
  });

  await pruneHistory(db);
}

function register() {
  return on('transcription:completed', (event) => {
    storeTranscription(event).catch((error) => {
      console.error('[TranscriptionHistory] Failed to store transcription:', error.message);
    });
  });
}

module.exports = {
  MAX_HISTORY_ROWS,
  register,
  storeTranscription,
};
