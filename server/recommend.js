import { addDays, isWeekend, eachDay, dayOfWeek, toISO, diffDays } from './dates.js';
import { holidaySet } from './domain.js';

// Construit l'ensemble des jours déjà "off" (week-ends gérés à part) :
// jours fériés + congés non refusés.
function offDaysContext(state) {
  const hSet = holidaySet(state);
  const leaveDays = new Set();
  for (const lv of state.leaves) {
    if (lv.status === 'rejected') continue;
    for (const d of eachDay(lv.startDate, lv.endDate)) leaveDays.add(d);
  }
  const oncall = new Set(state.oncall.map((o) => o.date));
  return { hSet, leaveDays, oncall };
}

function isRestDay(d, ctx) {
  return isWeekend(d) || ctx.hSet.has(d) || ctx.leaveDays.has(d);
}

// Étend une fenêtre de travail [start,end] aux jours de repos adjacents
// (week-ends, fériés, congés déjà posés) pour mesurer la coupure réelle.
function restSpan(start, end, ctx) {
  let s = start;
  while (isRestDay(addDays(s, -1), ctx)) s = addDays(s, -1);
  let e = end;
  while (isRestDay(addDays(e, 1), ctx)) e = addDays(e, 1);
  return { spanStart: s, spanEnd: e, totalDaysOff: diffDays(s, e) + 1 };
}

// Coût en jours de congé d'une fenêtre : jours ouvrés non fériés / non déjà posés.
function cpCostOf(start, end, ctx) {
  let cost = 0;
  const cells = [];
  for (const d of eachDay(start, end)) {
    if (isWeekend(d) || ctx.hSet.has(d)) continue;
    if (ctx.leaveDays.has(d)) continue;
    cost += 1;
    cells.push(d);
  }
  return { cost, cells };
}

function buildActivity(state) {
  const map = new Map();
  let total = 0;
  let daysWithData = 0;
  for (const c of state.conversations) {
    const cnt = Number(c.count) > 0 ? Number(c.count) : 1;
    map.set(c.date, (map.get(c.date) || 0) + cnt);
  }
  for (const v of map.values()) {
    total += v;
    daysWithData += 1;
  }
  const avg = daysWithData ? total / daysWithData : 0;
  return { map, avg, hasData: daysWithData > 0 };
}

function windowActivity(cells, activity) {
  if (!activity.hasData || cells.length === 0) return { level: 'inconnue', factor: 0.5, ratio: null };
  let sum = 0;
  for (const d of cells) sum += activity.map.get(d) || 0;
  const winAvg = sum / cells.length;
  const ratio = activity.avg > 0 ? winAvg / activity.avg : 0;
  let level = 'moyenne';
  if (ratio < 0.7) level = 'faible';
  else if (ratio > 1.3) level = 'élevée';
  // factor : faible activité -> proche de 1 (bon), forte -> proche de 0
  const factor = Math.max(0, Math.min(1, 1 - ratio / 2));
  return { level, factor, ratio };
}

function makeCandidate(start, end, ctx, activity, { bridge = false } = {}) {
  const { cost, cells } = cpCostOf(start, end, ctx);
  if (cost === 0) return null;
  // Exclure si une astreinte tombe dans la fenêtre.
  const onCallDays = cells.filter((d) => ctx.oncall.has(d));
  const span = restSpan(start, end, ctx);
  const act = windowActivity(cells, activity);
  const efficiency = span.totalDaysOff / cost;

  let score = 50;
  score += efficiency * 14;
  score += act.factor * 30;
  if (bridge) score += 22;
  if (onCallDays.length) score -= 500; // disqualifiant

  const reasons = [];
  if (bridge) reasons.push('Pont : prolonge un week-end / jour férié');
  if (efficiency >= 2) reasons.push(`Très rentable : ${span.totalDaysOff} jours de repos pour ${cost} CP`);
  else reasons.push(`${span.totalDaysOff} jours de repos pour ${cost} CP`);
  if (act.level === 'faible') reasons.push('Période de faible activité détectée (conversations Claude)');
  else if (act.level === 'élevée') reasons.push('Période de forte activité — à arbitrer');
  if (onCallDays.length) reasons.push(`Conflit : ${onCallDays.length} jour(s) d'astreinte dans la période`);

  return {
    startDate: start,
    endDate: end,
    cpCost: cost,
    cells,
    spanStart: span.spanStart,
    spanEnd: span.spanEnd,
    totalDaysOff: span.totalDaysOff,
    efficiency: Math.round(efficiency * 100) / 100,
    activityLevel: act.level,
    onCall: onCallDays.length > 0,
    bridge,
    score: Math.round(score * 10) / 10,
    reasons,
  };
}

// Génère des candidats "pont" autour de chaque férié de la plage.
function bridgeCandidates(state, from, to, ctx, activity) {
  const out = [];
  for (const h of state.holidays) {
    if (h.date < from || h.date > to) continue;
    if (isWeekend(h.date)) continue; // pas de pont si le férié est déjà le week-end
    const dow = dayOfWeek(h.date); // 1=lundi ... 4=jeudi
    // Férié mardi -> prendre le lundi ; jeudi -> prendre le vendredi ; mercredi -> les deux options
    if (dow === 2) {
      out.push(makeCandidate(addDays(h.date, -1), addDays(h.date, -1), ctx, activity, { bridge: true }));
    } else if (dow === 4) {
      out.push(makeCandidate(addDays(h.date, 1), addDays(h.date, 1), ctx, activity, { bridge: true }));
    } else if (dow === 3) {
      out.push(makeCandidate(addDays(h.date, 1), addDays(h.date, 2), ctx, activity, { bridge: true }));
      out.push(makeCandidate(addDays(h.date, -2), addDays(h.date, -1), ctx, activity, { bridge: true }));
    } else if (dow === 1) {
      out.push(makeCandidate(addDays(h.date, 1), addDays(h.date, 4), ctx, activity, { bridge: true }));
    } else if (dow === 5) {
      out.push(makeCandidate(addDays(h.date, -4), addDays(h.date, -1), ctx, activity, { bridge: true }));
    }
  }
  return out.filter(Boolean);
}

// Génère des semaines complètes (lundi -> vendredi) sur l'horizon.
function weeklyCandidates(from, to, ctx, activity) {
  const out = [];
  let cur = from;
  // avancer jusqu'au prochain lundi
  while (dayOfWeek(cur) !== 1) cur = addDays(cur, 1);
  while (cur <= to) {
    const start = cur;
    const end = addDays(cur, 4); // vendredi
    const c = makeCandidate(start, end, ctx, activity);
    if (c) out.push(c);
    cur = addDays(cur, 7);
  }
  return out;
}

// Sélection gloutonne : meilleurs scores, sans chevauchement entre recommandations.
function selectNonOverlapping(cands, limit) {
  cands.sort((a, b) => b.score - a.score);
  const chosen = [];
  const used = new Set();
  for (const c of cands) {
    if (c.score < 0) continue; // exclut les conflits d'astreinte
    const overlap = c.cells.some((d) => used.has(d));
    if (overlap) continue;
    chosen.push(c);
    for (const d of c.cells) used.add(d);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

export function recommend(state, opts = {}) {
  const today = toISO(new Date());
  const from = opts.from || today;
  const to = opts.to || addDays(from, 182); // ~6 mois
  const limit = opts.limit || 8;

  const ctx = offDaysContext(state);
  const activity = buildActivity(state);

  const candidates = [
    ...bridgeCandidates(state, from, to, ctx, activity),
    ...weeklyCandidates(from, to, ctx, activity),
  ].filter(Boolean);

  const chosen = selectNonOverlapping(candidates, limit);
  // tri final par date pour l'affichage
  chosen.sort((a, b) => a.startDate.localeCompare(b.startDate));
  // nettoyage : on n'expose pas le tableau cells brut
  return chosen.map(({ cells, ...rest }) => rest);
}
