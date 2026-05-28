import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getState, update, persist, newId } from './store.js';
import { LEAVE_TYPES, LEAVE_STATUS, computeBalances, monthlyStats, defaultRecoveryDate, holidaySet } from './domain.js';
import { holidaysFor, COUNTRIES } from './holidays.js';
import { recommend } from './recommend.js';
import { isWeekend } from './dates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '8mb' }));

const PORT = process.env.PORT || 3000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISO(s) {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function bad(res, msg) {
  return res.status(400).json({ error: msg });
}

function currentYear() {
  return new Date().getUTCFullYear();
}

// ---- État global ----
app.get('/api/state', (req, res) => {
  const state = getState();
  const y = Number(req.query.year) || currentYear();
  res.json({
    settings: state.settings,
    leaves: [...state.leaves].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    holidays: [...state.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    oncall: state.oncall.map((o) => o.date).sort(),
    conversations: {
      count: state.conversations.length,
      days: state.conversations.length,
      range: state.conversations.length
        ? {
            from: state.conversations.reduce((m, c) => (c.date < m ? c.date : m), state.conversations[0].date),
            to: state.conversations.reduce((m, c) => (c.date > m ? c.date : m), state.conversations[0].date),
          }
        : null,
    },
    balances: computeBalances(state, y),
    monthly: monthlyStats(state, y),
    year: y,
  });
});

// ---- Paramètres ----
app.put('/api/settings', (req, res) => {
  const b = req.body || {};
  const fields = ['cpTotalPerYear', 'rttTotalPerYear', 'cpCarryOver'];
  for (const f of fields) {
    if (b[f] !== undefined && (typeof b[f] !== 'number' || b[f] < 0 || Number.isNaN(b[f]))) {
      return bad(res, `Champ invalide : ${f}`);
    }
  }
  update((s) => {
    for (const f of fields) if (b[f] !== undefined) s.settings[f] = b[f];
    if (typeof b.weekStartsMonday === 'boolean') s.settings.weekStartsMonday = b.weekStartsMonday;
  });
  res.json(getState().settings);
});

// ---- Congés ----
function validateLeaveInput(b) {
  if (!LEAVE_TYPES.includes(b.type)) return 'Type de congé invalide';
  if (!isValidISO(b.startDate)) return 'Date de début invalide';
  if (!isValidISO(b.endDate)) return 'Date de fin invalide';
  if (b.endDate < b.startDate) return 'La date de fin précède la date de début';
  if (b.status !== undefined && !LEAVE_STATUS.includes(b.status)) return 'Statut invalide';
  return null;
}

app.post('/api/leaves', (req, res) => {
  const b = req.body || {};
  const err = validateLeaveInput(b);
  if (err) return bad(res, err);
  const leave = {
    id: newId(),
    type: b.type,
    startDate: b.startDate,
    endDate: b.endDate,
    halfStart: !!b.halfStart,
    halfEnd: !!b.halfEnd,
    status: b.status && LEAVE_STATUS.includes(b.status) ? b.status : 'pending',
    comment: typeof b.comment === 'string' ? b.comment.slice(0, 2000) : '',
    createdAt: new Date().toISOString(),
  };
  update((s) => s.leaves.push(leave));
  res.status(201).json(leave);
});

app.put('/api/leaves/:id', (req, res) => {
  const b = req.body || {};
  const err = validateLeaveInput(b);
  if (err) return bad(res, err);
  let updated = null;
  update((s) => {
    const lv = s.leaves.find((l) => l.id === req.params.id);
    if (!lv) return;
    lv.type = b.type;
    lv.startDate = b.startDate;
    lv.endDate = b.endDate;
    lv.halfStart = !!b.halfStart;
    lv.halfEnd = !!b.halfEnd;
    if (b.status && LEAVE_STATUS.includes(b.status)) lv.status = b.status;
    lv.comment = typeof b.comment === 'string' ? b.comment.slice(0, 2000) : lv.comment;
    updated = lv;
  });
  if (!updated) return res.status(404).json({ error: 'Congé introuvable' });
  res.json(updated);
});

app.patch('/api/leaves/:id/status', (req, res) => {
  const status = (req.body || {}).status;
  if (!LEAVE_STATUS.includes(status)) return bad(res, 'Statut invalide');
  let updated = null;
  update((s) => {
    const lv = s.leaves.find((l) => l.id === req.params.id);
    if (!lv) return;
    lv.status = status;
    updated = lv;
  });
  if (!updated) return res.status(404).json({ error: 'Congé introuvable' });
  res.json(updated);
});

app.delete('/api/leaves/:id', (req, res) => {
  let found = false;
  update((s) => {
    const i = s.leaves.findIndex((l) => l.id === req.params.id);
    if (i >= 0) { s.leaves.splice(i, 1); found = true; }
  });
  if (!found) return res.status(404).json({ error: 'Congé introuvable' });
  res.json({ ok: true });
});

// ---- Jours fériés ----
app.post('/api/holidays', (req, res) => {
  const b = req.body || {};
  if (!isValidISO(b.date)) return bad(res, 'Date invalide');
  if (typeof b.name !== 'string' || !b.name.trim()) return bad(res, 'Nom requis');
  const holiday = {
    id: newId(),
    date: b.date,
    name: b.name.trim().slice(0, 120),
    recoveryDate: isWeekend(b.date) ? (isValidISO(b.recoveryDate) ? b.recoveryDate : defaultRecoveryDate(b.date, holidaySet(getState()))) : null,
  };
  update((s) => s.holidays.push(holiday));
  res.status(201).json(holiday);
});

app.put('/api/holidays/:id', (req, res) => {
  const b = req.body || {};
  if (!isValidISO(b.date)) return bad(res, 'Date invalide');
  if (typeof b.name !== 'string' || !b.name.trim()) return bad(res, 'Nom requis');
  let updated = null;
  update((s) => {
    const h = s.holidays.find((x) => x.id === req.params.id);
    if (!h) return;
    h.date = b.date;
    h.name = b.name.trim().slice(0, 120);
    if (!isWeekend(b.date)) h.recoveryDate = null;
    else h.recoveryDate = isValidISO(b.recoveryDate) ? b.recoveryDate : defaultRecoveryDate(b.date);
    updated = h;
  });
  if (!updated) return res.status(404).json({ error: 'Jour férié introuvable' });
  res.json(updated);
});

app.delete('/api/holidays/:id', (req, res) => {
  let found = false;
  update((s) => {
    const i = s.holidays.findIndex((h) => h.id === req.params.id);
    if (i >= 0) { s.holidays.splice(i, 1); found = true; }
  });
  if (!found) return res.status(404).json({ error: 'Jour férié introuvable' });
  res.json({ ok: true });
});

app.get('/api/holidays/countries', (req, res) => {
  res.json(Object.entries(COUNTRIES).map(([code, c]) => ({ code, label: c.label })));
});

app.post('/api/holidays/generate', (req, res) => {
  const b = req.body || {};
  const y = Number(b.year) || currentYear();
  const country = COUNTRIES[b.country] ? b.country : 'FR';
  if (y < 1970 || y > 2100) return bad(res, 'Année invalide');
  let added = 0;
  update((s) => {
    const existing = new Set(s.holidays.map((h) => h.date));
    for (const h of holidaysFor(y, country)) {
      if (existing.has(h.date)) continue;
      s.holidays.push({
        id: newId(),
        date: h.date,
        name: h.name,
        recoveryDate: isWeekend(h.date) ? defaultRecoveryDate(h.date) : null,
      });
      existing.add(h.date);
      added += 1;
    }
  });
  res.json({ added, year: y, country, holidays: getState().holidays });
});

// ---- Astreintes ----
app.post('/api/oncall/import', (req, res) => {
  const b = req.body || {};
  const dates = Array.isArray(b.dates) ? b.dates.filter(isValidISO) : null;
  if (!dates) return bad(res, 'Liste de dates invalide');
  const mode = b.mode === 'replace' ? 'replace' : 'merge';
  update((s) => {
    const set = new Set(mode === 'replace' ? [] : s.oncall.map((o) => o.date));
    for (const d of dates) set.add(d);
    s.oncall = [...set].sort().map((date) => ({ date }));
  });
  res.json({ count: getState().oncall.length, mode });
});

app.delete('/api/oncall', (req, res) => {
  update((s) => { s.oncall = []; });
  res.json({ ok: true });
});

// ---- Conversations (activité Claude) ----
app.post('/api/conversations/import', (req, res) => {
  const b = req.body || {};
  const entries = Array.isArray(b.entries) ? b.entries : null;
  if (!entries) return bad(res, 'Entrées invalides');
  const clean = [];
  for (const e of entries) {
    if (!e || !isValidISO(e.date)) continue;
    clean.push({
      date: e.date,
      count: Number(e.count) > 0 ? Number(e.count) : 1,
      title: typeof e.title === 'string' ? e.title.slice(0, 200) : '',
    });
  }
  const mode = b.mode === 'replace' ? 'replace' : 'merge';
  update((s) => {
    s.conversations = mode === 'replace' ? clean : [...s.conversations, ...clean];
  });
  res.json({ count: getState().conversations.length, imported: clean.length, mode });
});

app.delete('/api/conversations', (req, res) => {
  update((s) => { s.conversations = []; });
  res.json({ ok: true });
});

// ---- Recommandations ----
app.get('/api/recommendations', (req, res) => {
  const opts = {};
  if (isValidISO(req.query.from)) opts.from = req.query.from;
  if (isValidISO(req.query.to)) opts.to = req.query.to;
  if (Number(req.query.limit)) opts.limit = Math.min(20, Number(req.query.limit));
  res.json({ recommendations: recommend(getState(), opts) });
});

// ---- Front statique ----
app.use(express.static(join(__dirname, '..', 'public')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

app.listen(PORT, () => {
  getState(); // charge l'état et garantit la création du fichier de données
  console.log(`Vacation Maxxing en écoute sur http://localhost:${PORT}`);
});
