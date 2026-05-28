import { eachDay, isWeekend, year as yearOf, month as monthOf, firstBusinessDayOfMonth } from './dates.js';

export const LEAVE_TYPES = ['CP', 'RTT', 'sans_solde', 'recuperation'];
export const LEAVE_STATUS = ['pending', 'approved', 'rejected'];

export function holidaySet(state) {
  return new Set(state.holidays.map((h) => h.date));
}

// Renvoie la liste des jours ouvrés réellement décomptés par un congé,
// avec leur poids (1 ou 0.5 pour les demi-journées de bord).
export function leaveWorkingDays(leave, hSet) {
  const days = eachDay(leave.startDate, leave.endDate)
    .filter((d) => !isWeekend(d) && !hSet.has(d))
    .map((date) => ({ date, weight: 1 }));

  if (days.length === 0) return days;

  const single = leave.startDate === leave.endDate;
  if (leave.halfStart && days[0].date === leave.startDate) {
    days[0].weight = 0.5;
  }
  if (!single && leave.halfEnd && days[days.length - 1].date === leave.endDate) {
    days[days.length - 1].weight -= 0.5;
    if (days[days.length - 1].weight <= 0) days[days.length - 1].weight = 0.5;
  }
  return days;
}

export function leaveDayCount(leave, hSet) {
  return leaveWorkingDays(leave, hSet).reduce((s, d) => s + d.weight, 0);
}

function sumDaysInYear(leaves, hSet, y, predicate) {
  let total = 0;
  for (const lv of leaves) {
    if (!predicate(lv)) continue;
    for (const d of leaveWorkingDays(lv, hSet)) {
      if (yearOf(d.date) === y) total += d.weight;
    }
  }
  return total;
}

export function computeBalances(state, y) {
  const hSet = holidaySet(state);
  const { settings, leaves, holidays } = state;

  const cpTotal = (settings.cpTotalPerYear || 0) + (settings.cpCarryOver || 0);
  const cpUsed = sumDaysInYear(leaves, hSet, y, (lv) => lv.type === 'CP' && lv.status === 'approved');
  const cpPending = sumDaysInYear(leaves, hSet, y, (lv) => lv.type === 'CP' && lv.status === 'pending');

  const rttTotal = settings.rttTotalPerYear || 0;
  const rttUsed = sumDaysInYear(leaves, hSet, y, (lv) => lv.type === 'RTT' && lv.status === 'approved');
  const rttPending = sumDaysInYear(leaves, hSet, y, (lv) => lv.type === 'RTT' && lv.status === 'pending');

  // Récupération : 1 jour gagné par férié tombant un week-end.
  const recupEarnedTotal = holidays.filter((h) => isWeekend(h.date)).length;
  const recupUsedTotal = leaves
    .filter((lv) => lv.type === 'recuperation' && lv.status === 'approved')
    .reduce((s, lv) => s + leaveDayCount(lv, hSet), 0);
  const recupEarnedYear = holidays.filter((h) => isWeekend(h.date) && yearOf(h.date) === y).length;
  const recupUsedYear = sumDaysInYear(leaves, hSet, y, (lv) => lv.type === 'recuperation' && lv.status === 'approved');

  return {
    year: y,
    cp: { total: cpTotal, used: cpUsed, pending: cpPending, remaining: round(cpTotal - cpUsed) },
    rtt: { total: rttTotal, used: rttUsed, pending: rttPending, remaining: round(rttTotal - rttUsed) },
    recup: {
      earned: recupEarnedTotal,
      used: recupUsedTotal,
      available: round(recupEarnedTotal - recupUsedTotal),
      earnedYear: recupEarnedYear,
      usedYear: recupUsedYear,
    },
  };
}

// Statistiques mensuelles : jours pris (approuvés) par mois et par type.
export function monthlyStats(state, y) {
  const hSet = holidaySet(state);
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    CP: 0,
    RTT: 0,
    recuperation: 0,
    sans_solde: 0,
    total: 0,
  }));
  for (const lv of state.leaves) {
    if (lv.status !== 'approved') continue;
    for (const d of leaveWorkingDays(lv, hSet)) {
      if (yearOf(d.date) !== y) continue;
      const m = months[monthOf(d.date) - 1];
      m[lv.type] = round((m[lv.type] || 0) + d.weight);
      m.total = round(m.total + d.weight);
    }
  }
  return months;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

// Calcule, pour un jour férié tombant le week-end, une date de récupération
// par défaut : le 1er jour ouvré du mois suivant.
export function defaultRecoveryDate(dateISO, hSet = new Set()) {
  let y = yearOf(dateISO);
  let m = monthOf(dateISO) + 1;
  if (m > 12) { m = 1; y += 1; }
  return firstBusinessDayOfMonth(y, m, hSet);
}
