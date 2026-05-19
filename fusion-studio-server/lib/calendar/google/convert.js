function calendar(row) {
  return {
    uuid: `google:${row.id}`,
    source: 'google',
    title: row.title,
    color: row.color || null,
    type: 'google',
  };
}

function event(row) {
  return {
    uuid: `google:${row.id}`,
    source: 'google',
    title: row.title || '(no title)',
    startDate: row.start,
    endDate: row.end,
    timezone: 'UTC', // Apps Script returns UTC-normalized timestamps
    allDay: row.allDay,
    description: row.description || null,
    conferenceUrl: null, // future: parse location for Meet links
    calendarUuid: `google:${row.calendarId}`,
    calendarTitle: row.calendarTitle,
    calendarColor: row.calendarColor || null,
  };
}

module.exports = { calendar, event };
