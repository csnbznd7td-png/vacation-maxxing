// Manipulation de dates au format ISO 'YYYY-MM-DD', sans dépendance.
// On raisonne en UTC pour éviter tout décalage de fuseau horaire.

export function toISO(d) {
  return d.toISOString().slice(0, 10);
}

export function parseISO(s) {
  // 'YYYY-MM-DD' -> Date à minuit UTC
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s, n) {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function dayOfWeek(s) {
  // 0 = dimanche ... 6 = samedi
  return parseISO(s).getUTCDay();
}

export function isWeekend(s) {
  const d = dayOfWeek(s);
  return d === 0 || d === 6;
}

export function diffDays(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export function eachDay(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function year(s) {
  return Number(s.slice(0, 4));
}

export function month(s) {
  return Number(s.slice(5, 7));
}

export function firstBusinessDayOfMonth(y, m /* 1-12 */, holidaySet = new Set()) {
  let day = `${y}-${String(m).padStart(2, '0')}-01`;
  // borne : ne pas dépasser le mois
  for (let i = 0; i < 15; i++) {
    if (!isWeekend(day) && !holidaySet.has(day)) return day;
    day = addDays(day, 1);
  }
  return day;
}

const FR_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function formatFR(s) {
  const d = parseISO(s);
  return `${d.getUTCDate()} ${FR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
