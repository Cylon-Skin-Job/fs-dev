import { withDb } from './electron-case-helpers.mjs';

export function seedHistory(dbPath, threadId, exchanges) {
  withDb(dbPath, {}, (db) => {
    const insert = db.prepare('INSERT INTO exchanges (thread_id,seq,ts,user_input,assistant,metadata) VALUES (?,?,?,?,?,?)');
    db.transaction(() => {
      for (const exchange of exchanges) {
        insert.run(threadId, exchange.seq, 1_780_000_000_000 + exchange.seq,
          exchange.user, JSON.stringify(exchange.assistant), JSON.stringify(exchange.metadata));
      }
      db.prepare('UPDATE threads SET message_count = ?, updated_at = ? WHERE thread_id = ?')
        .run(exchanges.length, 1_780_000_000_000 + exchanges.length, threadId);
    })();
  });
}

