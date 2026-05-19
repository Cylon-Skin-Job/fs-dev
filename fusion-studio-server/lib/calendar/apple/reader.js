const Database = require('better-sqlite3');
const os = require('os');
const path = require('path');

const DB_PATH = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb'
);

function readCalendars() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return db.prepare(`
      SELECT UUID, title, color, type
      FROM Calendar
    `).all();
  } catch (err) {
    if (err.code === 'SQLITE_BUSY') return null;
    throw err;
  } finally {
    db?.close();
  }
}

function readEvents(startApple, endApple) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return db.prepare(`
      SELECT
        ci.UUID, ci.summary, ci.start_date, ci.end_date,
        ci.start_tz, ci.all_day, ci.description,
        ci.conference_url, ci.conference_url_detected,
        c.UUID as cal_uuid, c.title as cal_title, c.color as cal_color
      FROM CalendarItem ci
      JOIN Calendar c ON c.ROWID = ci.calendar_id
      WHERE ci.entity_type = 0
        AND ci.hidden = 0
        AND ci.start_date < ?
        AND ci.end_date > ?
    `).all(endApple, startApple);
  } catch (err) {
    if (err.code === 'SQLITE_BUSY') return null;
    throw err;
  } finally {
    db?.close();
  }
}

module.exports = { readCalendars, readEvents };
