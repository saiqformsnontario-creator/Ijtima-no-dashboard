// ═══════════════════════════════════════════════════
//  IJTEMA DISPLAY + ADMIN  –  Google Sheets live data
//
//  Shared by index.html (TV display) and admin.html (organizer panel).
//  Talks to the same Apps Script web app as the main Ijtima Dashboard
//  (MASTER_SHEET_APPS_SCRIPT.js) — same Master Sheet, same deployment.
// ═══════════════════════════════════════════════════

const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxihyNROL7x1bt8tbFEbrf4RQbbzC5l6la-tpKRAyyTcaW0dntm3ADhghn_JRiDSKhJFA/exec';

// Tajnid (total members) per majlis — used as the denominator in attendance bars
const TAJNID = {
  'Barrie South': 159,
  'Barrie North': 92,
  'Innisfil':     63,
  'Sudbury':      16,
};

// Colours assigned to each majlis in order
const MAJLIS_COLORS = [
  '#4ade80','#facc15','#38bdf8','#f472b6',
];

// Static event details — edit once per event
const EVENT_META = {
  title:        'Northern Ontario Ijtima 2026',
  theme:        'Love for All, Hatred for None',
  ayah_arabic:  'وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ ۖ فَلْيَسْتَجِيبُوا۟ لِى وَلْيُؤْمِنُوا۟ بِى لَعَلَّهُمْ يَرْشُدُونَ',
  ayah_english: 'When My servants ask you ˹O Prophet˺ about Me: I am truly near. I respond to one\'s prayer when they call upon Me. So let them respond ˹with obedience˺ to Me and believe in Me, perhaps they will be guided ˹to the Right Way˺.',
  ayah_ref:     'Surah Al-Baqarah, Chapter 2, Verse 186',
  date:         'June 2026',
  location:     'Barrie, Ontario',
  logo1:        'logo.png',
  bg_gdrive:    '',
  bg_local:     'bg.jpg',
};

const LOCAL_STORAGE_KEY = 'ijtema_data_v2';
const SHEETS_URL_KEY    = 'ijtema_sheets_url';

// ── Empty skeleton shown while first fetch loads ─────
function getEmptyData() {
  return {
    meta:           { ...EVENT_META },
    majalis:        [],
    competitions:   [],
    venues:         [],
    announcements:  [],
    majlisRankings: [],
  };
}

// ── Map Apps Script status strings → display tokens ──
function normalizeStatus(s) {
  s = String(s || '').toLowerCase();
  if (s === 'completed' || s === 'done') return 'done';
  if (s === 'live'      || s === 'now')  return 'now';
  return 'upcoming';
}

function buildMajlisIdMap(majalisNames) {
  const map = {};
  (majalisNames || []).forEach((name, i) => { map[name] = 'h' + i; });
  return map;
}

// ── Transform bootstrap payload → display format ─────
function transformBootstrap(payload) {
  const majalisNames  = payload.majalis            || [];
  const memberRecords = payload.memberRecords      || [];
  const compResults    = payload.competitionResults || [];
  const scheduleItems  = payload.scheduleItems      || [];
  const rawAnns        = payload.announcements      || [];
  const rawRankings    = payload.majlisRankings     || [];

  const majlisIdMap = buildMajlisIdMap(majalisNames);

  // Majalis — membership counts from memberRecords
  const majalis = majalisNames.map((name, i) => {
    const ms = memberRecords.filter(m => m.majlis === name);
    return {
      id:         'h' + i,
      name,
      color:      MAJLIS_COLORS[i % MAJLIS_COLORS.length],
      registered: TAJNID[name] || ms.filter(m => m.registered).length,
      present:    ms.filter(m => m.attended).length,
      discipline: 0,
    };
  });

  // Competitions — flat rows grouped by competition name
  const compMap = {};
  compResults.forEach(row => {
    const key = String(row.competition || '').trim();
    if (!key) return;
    if (!compMap[key]) {
      compMap[key] = {
        id:       'c_' + key.replace(/\W+/g, '_').toLowerCase(),
        name:     key,
        category: String(row.category || ''),
        entries:  [],
      };
    }
    compMap[key].entries.push({
      name:   String(row.name   || ''),
      majlis: majlisIdMap[String(row.majlis || '')] || '',
      score:  Number(row.points) || 0,
      photo:  '',
    });
  });
  const competitions = Object.values(compMap);

  // Venues — schedule items grouped by location
  const venueMap = {};
  scheduleItems.forEach(item => {
    const loc = String(item.location || 'Main Hall').trim();
    if (!venueMap[loc]) {
      venueMap[loc] = {
        id:       'v_' + loc.replace(/\W+/g, '_').toLowerCase(),
        name:     loc,
        location: '',
        programs: [],
      };
    }
    venueMap[loc].programs.push({
      time:   String(item.start  || ''),
      name:   String(item.title  || ''),
      detail: String(item.lead   || ''),
      status: normalizeStatus(item.status),
    });
  });
  const venues = Object.values(venueMap);

  // Announcements — join title + message into ticker strings
  const announcements = rawAnns
    .map(a => [a.title, a.message].filter(Boolean).join(' — '))
    .filter(Boolean);

  // Rankings — pre-calculated by Sheets, just add id + color
  const majlisRankings = [...rawRankings]
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .map(r => ({
      majlis:     String(r.majlis || ''),
      attendance: Number(r.attendance) || 0,
      education:  Number(r.education)  || 0,
      sports:     Number(r.sports)     || 0,
      total:      Number(r.total)      || 0,
      rank:       Number(r.rank)       || 0,
      id:         majlisIdMap[r.majlis]  || '',
      color:      MAJLIS_COLORS[majalisNames.indexOf(r.majlis) % MAJLIS_COLORS.length] || '#3bbfbf',
    }));

  return { meta: { ...EVENT_META }, majalis, competitions, venues, announcements, majlisRankings };
}

// ── Low-level fetch: raw bootstrap JSON from Apps Script ─────
async function fetchBootstrapRaw() {
  const url = getSheetsUrl();
  if (!url) return null;
  try {
    const resp = await fetch(url + '?action=bootstrap&t=' + Date.now());
    const json = await resp.json();
    return (json && json.majalis) ? json : null;
  } catch (e) {
    console.warn('[AV] Sheets fetch failed:', e.message);
    return null;
  }
}

// ── Fetch live data from Apps Script, shaped for the display ─────
async function fetchBootstrap() {
  const payload = await fetchBootstrapRaw();
  return payload ? transformBootstrap(payload) : null;
}

// ── Low-level POST helper (text/plain avoids CORS preflight on Apps Script) ──
async function sheetsPost(action, payload) {
  const url = getSheetsUrl();
  if (!url) return { status: 'error', error: 'Google Sheets not connected.' };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload }),
    });
    return await resp.json();
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

// admin.html calls this as if it were a GET — it's really a thin POST wrapper
async function sheetsGet(payload) {
  return sheetsPost(payload.action, payload);
}

// ── Connected Apps Script URL (admin can override; defaults to SHEETS_ENDPOINT) ──
function getSheetsUrl() {
  try {
    return localStorage.getItem(SHEETS_URL_KEY) || SHEETS_ENDPOINT || '';
  } catch (e) {
    return SHEETS_ENDPOINT || '';
  }
}
function setSheetsUrl(url) {
  try { localStorage.setItem(SHEETS_URL_KEY, url); } catch (e) {}
}

// ── Admin's local content state (event info, schedule, competitions, branding) ──
function resetData() {
  return {
    meta: { ...EVENT_META },
    majalis: Object.keys(TAJNID).map((name, i) => ({
      id: 'h' + i,
      name,
      color: MAJLIS_COLORS[i % MAJLIS_COLORS.length],
      registered: TAJNID[name] || 0,
      present: 0,
      discipline: 0,
    })),
    competitions: [],
    venues: [],
    announcements: [],
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return resetData();
}

function saveData(D) {
  try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(D)); } catch (e) {}
}

// ── Push/pull the admin content blob to/from the Master Sheet ──
async function pushToSheets(D) {
  const r = await sheetsPost('avConfigSave', D);
  if (r.error || r.status === 'error') return { ok: false, msg: r.message || r.error || 'Push failed.' };
  return { ok: true, msg: r.message || 'Pushed.' };
}

async function pullFromSheets() {
  const url = getSheetsUrl();
  if (!url) return null;
  try {
    const resp = await fetch(url + '?action=avConfig&t=' + Date.now());
    const json = await resp.json();
    return (json && json.status === 'ok' && json.config) ? json.config : null;
  } catch (e) {
    return null;
  }
}

// ── Live registration & attendance (reads the real Master Sheet members) ──
async function fetchMembers() {
  const payload = await fetchBootstrapRaw();
  if (!payload) return null;
  const majlisIdMap = buildMajlisIdMap(payload.majalis);
  return (payload.memberRecords || []).map(m => ({
    memberId:    String(m.code || ''),
    name:        String(m.name || ''),
    majlisId:    majlisIdMap[m.majlis] || '',
    majlisName:  String(m.majlis || ''),
    checkedIn:   Boolean(m.attended),
    checkInTime: m.checkIn || '',
    registered:  Boolean(m.registered),
    flag:        m.source === 'registration-only' ? 'NOT_IN_DB' : (!m.registered ? 'NOT_REGISTERED' : ''),
  }));
}

function resolveMajlisId(majlisName) {
  if (typeof D !== 'undefined' && D && Array.isArray(D.majalis)) {
    const found = D.majalis.find(m => m.name === majlisName);
    if (found) return found.id;
  }
  return '';
}

async function checkInMember(id) {
  const r = await sheetsPost('attendanceCheckIn', { code: id, checkedInBy: 'AV Display' });
  if (r.error) {
    return { status: /already checked in/i.test(r.error) ? 'already' : 'error', message: r.error };
  }
  const match = (r.memberRecords || []).find(m => String(m.code || '').trim().toUpperCase() === id.toUpperCase());
  return {
    status: 'ok',
    message: r.message || 'Checked in.',
    member: match ? {
      memberId:    match.code,
      name:        match.name,
      majlisId:    resolveMajlisId(match.majlis),
      majlisName:  match.majlis,
      checkInTime: match.checkIn,
    } : null,
  };
}

async function undoCheckIn(id) {
  const r = await sheetsPost('attendanceMarkAbsent', { codes: [id] });
  if (r.error) return { status: 'error', message: r.error };
  return { status: 'ok', message: r.message || 'Check-in undone.' };
}

async function clearAllAttendance() {
  const members = await fetchMembers();
  if (!members) return { status: 'error', message: 'Could not load members.' };
  const codes = members.filter(m => m.checkedIn).map(m => m.memberId);
  if (!codes.length) return { status: 'ok', message: 'Nothing to clear.' };
  const r = await sheetsPost('attendanceMarkAbsent', { codes });
  if (r.error) return { status: 'error', message: r.error };
  return { status: 'ok', message: r.message || 'Attendance cleared.' };
}

async function fetchFormUrl() {
  const payload = await fetchBootstrapRaw();
  return (payload && payload.formUrl) ? payload.formUrl : '';
}

// ── Master Members database (CSV import / add single member) ──
async function bulkImportMembers(rows) {
  const r = await sheetsPost('bulkAddMasterMembers', { rows });
  if (r.error || r.status === 'error') return { status: 'error', message: r.message || r.error };
  return { status: 'ok', message: r.message || 'Imported.' };
}

async function addMemberToDB(member) {
  const r = await sheetsPost('addMasterMember', member);
  if (r.error || r.status === 'error') return { status: 'error', message: r.message || r.error };
  return { status: 'ok', message: r.message || 'Member added.' };
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const splitLine = (line) => line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  let rows = lines.map(splitLine);
  const headerGuess = rows[0].join(' ').toLowerCase();
  if (headerGuess.includes('member') || headerGuess.includes('name') || headerGuess.includes('majlis')) {
    rows = rows.slice(1);
  }
  return rows
    .filter(r => r[0] && r[1])
    .map(r => ({ memberId: r[0] || '', name: r[1] || '', majlisName: r[2] || '', phone: r[3] || '' }));
}

// ── Rankings preview (pure client-side calc from admin content state) ──
function calcRankings(D) {
  return D.majalis.map(m => {
    const attPct = m.registered ? Math.round((m.present / m.registered) * 100) : 0;
    const compPts = D.competitions.reduce((sum, c) => {
      return sum + c.entries.filter(e => e.majlis === m.id).reduce((s, e) => s + (Number(e.score) || 0), 0);
    }, 0);
    const discipline = Number(m.discipline) || 0;
    const total = Math.round(attPct * 0.5 + compPts + discipline);
    return { id: m.id, name: m.name, color: m.color, attPct, compPts, discipline, total };
  }).sort((a, b) => b.total - a.total);
}

// ── Google Drive URL helpers ──────────────────────────
function driveToDirectUrl(input) {
  if (!input || !input.trim()) return '';
  input = input.trim();
  let fileId = '', m;
  m = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) fileId = m[1];
  if (!fileId) { m = input.match(/\/file\/d\/([a-zA-Z0-9_-]+)/); if (m) fileId = m[1]; }
  if (!fileId && /^[a-zA-Z0-9_-]{25,}$/.test(input)) fileId = input;
  if (!fileId) return input;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
}
function resolveBgUrl(meta) {
  if (meta && meta.bg_gdrive && meta.bg_gdrive.trim()) return driveToDirectUrl(meta.bg_gdrive);
  if (meta && meta.bg_local  && meta.bg_local.trim())  return meta.bg_local.trim();
  return '';
}
function resolveLogoUrl(raw) { return raw && raw.trim() ? driveToDirectUrl(raw) : ''; }
