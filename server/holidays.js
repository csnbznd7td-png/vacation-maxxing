import { toISO, addDays } from './dates.js';

// Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien)
function easterSunday(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Jours fériés français (métropole) pour une année donnée.
export function frenchHolidays(y) {
  const easter = easterSunday(y);
  const fixed = [
    [`${y}-01-01`, "Jour de l'An"],
    [`${y}-05-01`, 'Fête du Travail'],
    [`${y}-05-08`, 'Victoire 1945'],
    [`${y}-07-14`, 'Fête Nationale'],
    [`${y}-08-15`, 'Assomption'],
    [`${y}-11-01`, 'Toussaint'],
    [`${y}-11-11`, 'Armistice 1918'],
    [`${y}-12-25`, 'Noël'],
  ];
  const mobile = [
    [addDays(easter, 1), 'Lundi de Pâques'],
    [addDays(easter, 39), 'Ascension'],
    [addDays(easter, 50), 'Lundi de Pentecôte'],
  ];
  return sort([...fixed, ...mobile]);
}

// Jours fériés légaux luxembourgeois pour une année donnée.
export function luxembourgHolidays(y) {
  const easter = easterSunday(y);
  const fixed = [
    [`${y}-01-01`, "Jour de l'An"],
    [`${y}-05-01`, 'Fête du Travail'],
    [`${y}-05-09`, "Journée de l'Europe"],
    [`${y}-06-23`, 'Fête nationale'],
    [`${y}-08-15`, 'Assomption'],
    [`${y}-11-01`, 'Toussaint'],
    [`${y}-12-25`, 'Noël'],
    [`${y}-12-26`, 'Lendemain de Noël'],
  ];
  const mobile = [
    [addDays(easter, 1), 'Lundi de Pâques'],
    [addDays(easter, 39), 'Ascension'],
    [addDays(easter, 50), 'Lundi de Pentecôte'],
  ];
  return sort([...fixed, ...mobile]);
}

function sort(pairs) {
  return pairs
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const COUNTRIES = {
  FR: { label: 'France', fn: frenchHolidays },
  LU: { label: 'Luxembourg', fn: luxembourgHolidays },
};

// Renvoie les jours fériés d'un pays ('FR' par défaut) pour une année.
export function holidaysFor(year, country = 'FR') {
  const entry = COUNTRIES[country] || COUNTRIES.FR;
  return entry.fn(year);
}

export { easterSunday, toISO };
