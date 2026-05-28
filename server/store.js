import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'data.json');

const defaultState = () => ({
  settings: {
    cpTotalPerYear: 25, // CP acquis par an
    rttTotalPerYear: 10, // RTT acquis par an
    cpCarryOver: 0, // report de l'année précédente
    weekStartsMonday: true,
  },
  leaves: [], // { id, type, startDate, endDate, startHalf, endHalf, status, comment, createdAt }
  holidays: [], // { id, date, name, recoveryDate|null }
  oncall: [], // { date }  -> jours d'astreinte
  conversations: [], // { date, count, title }  -> activité Claude par jour
});

let state = null;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function migrate(s) {
  s = s && typeof s === 'object' ? s : {};
  const base = defaultState();
  return {
    settings: { ...base.settings, ...(s.settings || {}) },
    leaves: Array.isArray(s.leaves) ? s.leaves : [],
    holidays: Array.isArray(s.holidays) ? s.holidays : [],
    oncall: Array.isArray(s.oncall) ? s.oncall : [],
    conversations: Array.isArray(s.conversations) ? s.conversations : [],
  };
}

export function load() {
  if (state) return state;
  ensureDir();
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, 'utf8');
      state = migrate(JSON.parse(raw));
    } catch (err) {
      console.error('Lecture de data.json impossible, réinitialisation :', err.message);
      state = defaultState();
    }
  } else {
    state = defaultState();
    persist();
  }
  return state;
}

export function persist() {
  if (!state) load();
  ensureDir();
  const tmp = DATA_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, DATA_FILE); // écriture atomique
  return state;
}

export function getState() {
  return load();
}

export function update(mutator) {
  load();
  mutator(state);
  return persist();
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
