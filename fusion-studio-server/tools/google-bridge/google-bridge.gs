// Fusion Studio — Google Bridge
// Deploy as Web App: Execute as Me, Access: Anyone
// Run setup() once to generate your secret key, then add it to Fusion Secrets Manager.

function setup() {
  const key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('FUSION_KEY', key);
  Logger.log('Your secret key (copy this into Fusion Secrets Manager):');
  Logger.log(key);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  const storedKey = PropertiesService.getScriptProperties().getProperty('FUSION_KEY');

  if (!storedKey || body.key !== storedKey) {
    return json({ error: 'unauthorized' }, 401);
  }

  switch (body.action) {
    case 'getCalendars': return json(getCalendars());
    case 'getEvents':    return json(getEvents(body.start, body.end));
    default:             return json({ error: 'unknown action' }, 400);
  }
}

function getCalendars() {
  return CalendarApp.getAllCalendars().map(c => ({
    id: c.getId(),
    title: c.getName(),
    color: c.getColor(),
  }));
}

function getEvents(startUnix, endUnix) {
  const start = new Date(startUnix * 1000);
  const end = new Date(endUnix * 1000);
  const events = [];
  CalendarApp.getAllCalendars().forEach(cal => {
    cal.getEvents(start, end).forEach(ev => {
      events.push({
        id: ev.getId(),
        title: ev.getTitle(),
        start: Math.floor(ev.getStartTime().getTime() / 1000),
        end: Math.floor(ev.getEndTime().getTime() / 1000),
        allDay: ev.isAllDayEvent(),
        description: ev.getDescription() || null,
        location: ev.getLocation() || null,
        calendarId: cal.getId(),
        calendarTitle: cal.getName(),
        calendarColor: cal.getColor(),
      });
    });
  });
  return events;
}

function json(data, status) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
