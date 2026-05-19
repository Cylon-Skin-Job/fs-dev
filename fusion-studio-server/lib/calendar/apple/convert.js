const APPLE_EPOCH_OFFSET = 978307200; // seconds between 1970-01-01 and 2001-01-01

function appleToUnix(ts) {
  return Math.round(ts + APPLE_EPOCH_OFFSET);
}

function calendar(row) {
  return {
    uuid: `apple:${row.UUID}`,
    source: 'apple',
    title: row.title,
    color: row.color || null,
    type: row.type || 'local',
  };
}

function event(row) {
  return {
    uuid: `apple:${row.UUID}`,
    source: 'apple',
    title: row.summary || '(no title)',
    startDate: appleToUnix(row.start_date),
    endDate: appleToUnix(row.end_date),
    timezone: row.start_tz || 'UTC',
    allDay: row.all_day === 1,
    description: row.description || null,
    conferenceUrl: row.conference_url || row.conference_url_detected || null,
    calendarUuid: `apple:${row.cal_uuid}`,
    calendarTitle: row.cal_title,
    calendarColor: row.cal_color || null,
  };
}

module.exports = { calendar, event };
