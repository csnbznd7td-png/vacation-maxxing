// Utilitaires de dates côté client (miroir de server/dates.js), en UTC.

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toISO(d) {
  return d.toISOString().slice(0, 10);
}
export function todayISO() {
  return toISO(new Date());
}
export function addDays(s, n) {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}
export function dayOfWeek(s) {
  return parseISO(s).getUTCDay();
}
export function isWeekend(s) {
  const d = dayOfWeek(s);
  return d === 0 || d === 6;
}
export function eachDay(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}

const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FR_MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const FR_DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function formatFR(s) {
  if (!s) return '';
  const d = parseISO(s);
  return `${d.getUTCDate()} ${FR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function formatFRShort(s) {
  if (!s) return '';
  const d = parseISO(s);
  return `${d.getUTCDate()} ${FR_MONTHS_SHORT[d.getUTCMonth()]}`;
}
export function monthName(m) { return FR_MONTHS[m - 1]; }
export function monthNameShort(m) { return FR_MONTHS_SHORT[m - 1]; }
export function dowLabels() { return FR_DOW; }

export const LEAVE_TYPE_LABELS = {
  CP: 'Congé payé',
  RTT: 'RTT',
  sans_solde: 'Sans solde',
  recuperation: 'Récupération',
};
export const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Accepté',
  rejected: 'Refusé',
};

// Décompte des jours ouvrés d'un congé (aperçu client), hors week-ends et fériés.
export function previewDayCount(leave, holidaySet) {
  const days = eachDay(leave.startDate, leave.endDate)
    .filter((d) => !isWeekend(d) && !holidaySet.has(d));
  if (days.length === 0) return 0;
  let count = days.length;
  const single = leave.startDate === leave.endDate;
  if (leave.halfStart && days[0] === leave.startDate) count -= 0.5;
  if (!single && leave.halfEnd && days[days.length - 1] === leave.endDate) count -= 0.5;
  return Math.max(0, Math.round(count * 100) / 100);
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
