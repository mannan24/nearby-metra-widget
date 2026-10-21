const ZONE = 'America/Chicago';
function csv(text, visit) {
  let row = [], field = '', quoted = false, headers;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i] || '\n';
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.trim()); field = '';
      if (c === '\n') {
        if (!headers) headers = row;
        else if (row.some(Boolean)) visit(Object.fromEntries(headers.map((h, j) => [h, row[j] || ''])));
        row = [];
      }
    } else field += c;
  }
  if (quoted) throw Error('Invalid timetable CSV');
}
function seconds(time) {
  if (!/^\d{1,3}:\d{2}:\d{2}$/.test(time)) throw Error('Invalid train time');
  const [h, m, s] = time.split(':').map(Number);
  if (m > 59 || s > 59) throw Error('Invalid train time');
  return h * 3600 + m * 60 + s;
}

function chicagoParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
function dayKey(d) { return d.toISOString().slice(0,10).replace(/-/g, ''); }
// GTFS defines the service-day origin as local noon minus twelve hours (DST-safe).
function serviceOrigin(day) {
  const target = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = chicagoParts(new Date(instant));
    instant += target - Date.UTC(p.year, p.month-1, p.day, p.hour, p.minute, p.second);
  }
  return instant - 12 * 3600000;
}
function activeServices(feed, day) {
  const key = dayKey(day), weekday = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][day.getUTCDay()];
  const active = new Set(feed.calendars.filter(c => c.start_date <= key && c.end_date >= key && c[weekday] === '1').map(c => c.service_id));
  for (const e of feed.exceptions) if (e.date === key) {
    if (e.exception_type === '1') active.add(e.service_id);
    else if (e.exception_type === '2') active.delete(e.service_id);
  }
  return active;
}

export {csv, seconds, chicagoParts, dayKey, serviceOrigin, activeServices};
