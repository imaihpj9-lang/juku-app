const https = require('https');
const fs = require('fs');

const ICAL_URL = process.env.ICAL_URL;
if (!ICAL_URL) { console.error('ICAL_URL not set'); process.exit(1); }

const SUBJECTS = [
  { id: 'japanese', name: '国語' },
  { id: 'math',     name: '数学' },
  { id: 'english',  name: '英語' },
  { id: 'science',  name: '理科' },
  { id: 'social',   name: '社会' },
  { id: 'reading',  name: '長文' },
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseICStMs(val) {
  const isUTC = val.endsWith('Z');
  const v = val.replace('Z', '');
  const yr = +v.slice(0,4), mo = +v.slice(4,6)-1, dy = +v.slice(6,8);
  if (!v.includes('T')) return new Date(yr,mo,dy).getTime();
  const hr = +v.slice(9,11), mn = +v.slice(11,13);
  return isUTC ? Date.UTC(yr,mo,dy,hr,mn) : new Date(yr,mo,dy,hr,mn).getTime();
}

function parseICS(text) {
  text = text.replace(/\r\n /g,'').replace(/\r\n\t/g,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const events = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const ci = line.indexOf(':');
    if (ci < 0) continue;
    const key = line.slice(0, ci);
    const val = line.slice(ci + 1).trim();
    const base = key.split(';')[0];
    if (base === 'BEGIN' && val === 'VEVENT') { cur = {}; }
    else if (base === 'END' && val === 'VEVENT' && cur) { events.push(cur); cur = null; }
    else if (cur) {
      if (base === 'SUMMARY') cur.summary = val.replace(/\\,/g,',').replace(/\\n/g,' ');
      else if (base === 'UID') cur.uid = val;
      else if (base === 'DTSTART') {
        const ms = parseICStMs(val);
        const d = new Date(ms);
        cur.date = dateKey(d);
        cur.startTime = d.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Tokyo' });
        cur._startMs = ms;
      }
      else if (base === 'DTEND') cur._endMs = parseICStMs(val);
    }
  }
  for (const e of events) {
    if (e._startMs && e._endMs) e.durationMin = Math.round((e._endMs - e._startMs) / 60000);
    if (!e.durationMin) e.durationMin = 90;
  }
  return events;
}

async function main() {
  console.log('Fetching iCal...');
  const icsText = await fetch(ICAL_URL);
  if (!icsText.includes('BEGIN:VCALENDAR')) {
    console.error('Invalid iCal response');
    process.exit(1);
  }

  const events = parseICS(icsText);
  const juku = events
    .filter(e => (e.summary || '').includes('明光'))
    .map(e => ({
      id: e.uid,
      date: e.date,
      subjectId: SUBJECTS.find(s => (e.summary||'').includes(s.name))?.id || 'other',
      startTime: e.startTime,
      durationMin: e.durationMin,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  fs.writeFileSync('events.json', JSON.stringify({ updated: new Date().toISOString(), events: juku }, null, 2));
  console.log(`Saved ${juku.length} events to events.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
