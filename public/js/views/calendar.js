import { ctx } from '../ui.js';
import {
  parseISO, toISO, addDays, eachDay, isWeekend, dayOfWeek, todayISO,
  monthName, dowLabels, LEAVE_TYPE_LABELS, escapeHtml,
} from '../utils.js';

let cal = null; // { year, month(1-12) }

function buildMaps() {
  const holidayMap = new Map();
  const recupMap = new Map();
  for (const h of ctx.state.holidays) {
    holidayMap.set(h.date, h.name);
    if (h.recoveryDate) recupMap.set(h.recoveryDate, h.name);
  }
  const oncall = new Set(ctx.state.oncall);
  const leaveMap = new Map();
  const ordered = [...ctx.state.leaves].sort((a, b) => (a.status === 'approved' ? 1 : 0) - (b.status === 'approved' ? 1 : 0));
  for (const l of ordered) {
    if (l.status === 'rejected') continue;
    for (const d of eachDay(l.startDate, l.endDate)) {
      if (isWeekend(d)) continue;
      leaveMap.set(d, { type: l.type, status: l.status });
    }
  }
  return { holidayMap, recupMap, oncall, leaveMap };
}

function renderGrid(root) {
  const { year, month } = cal;
  const maps = buildMaps();
  const today = todayISO();
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  // offset lundi = 0
  let offset = dayOfWeek(first) - 1;
  if (offset < 0) offset = 6;
  const gridStart = addDays(first, -offset);

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const inMonth = Number(d.slice(5, 7)) === month;
    const classes = ['cal-cell'];
    if (!inMonth) classes.push('out');
    if (isWeekend(d)) classes.push('weekend');
    if (d === today) classes.push('today');

    let tags = '';
    if (maps.holidayMap.has(d)) tags += `<span class="cal-tag holiday" title="${escapeHtml(maps.holidayMap.get(d))}">${escapeHtml(maps.holidayMap.get(d))}</span>`;
    if (maps.recupMap.has(d)) tags += `<span class="cal-tag recup" title="Récupération (${escapeHtml(maps.recupMap.get(d))})">Récup.</span>`;
    if (maps.oncall.has(d)) tags += `<span class="cal-tag oncall">Astreinte</span>`;
    if (maps.leaveMap.has(d)) {
      const lv = maps.leaveMap.get(d);
      tags += `<span class="cal-tag leave-${lv.status === 'approved' ? 'approved' : 'pending'}">${LEAVE_TYPE_LABELS[lv.type]}</span>`;
    }

    cells += `<div class="${classes.join(' ')}">
      <span class="cal-day">${Number(d.slice(8, 10))}</span>
      ${tags}
    </div>`;
  }

  const dows = dowLabels().map((d) => `<div class="cal-dow">${d}</div>`).join('');

  root.innerHTML = `
    <h1 class="section-title">Calendrier</h1>
    <div class="card">
      <div class="cal-head">
        <div class="btn-row">
          <button id="prevM" class="btn-sm">‹ Préc.</button>
          <button id="todayM" class="btn-sm">Aujourd'hui</button>
          <button id="nextM" class="btn-sm">Suiv. ›</button>
        </div>
        <div class="cal-title">${monthName(month)} ${year}</div>
        <div style="width:120px"></div>
      </div>
      <div class="cal-grid">${dows}</div>
      <div class="cal-grid" style="margin-top:6px">${cells}</div>
      <div class="legend">
        <span><i class="dot" style="background:var(--holiday)"></i>Jour férié</span>
        <span><i class="dot" style="background:var(--recup)"></i>Récupération</span>
        <span><i class="dot" style="background:var(--oncall)"></i>Astreinte</span>
        <span><i class="dot" style="background:var(--approved)"></i>Congé accepté</span>
        <span><i class="dot" style="background:var(--pending)"></i>Congé en attente</span>
      </div>
    </div>`;

  root.querySelector('#prevM').onclick = () => { shift(-1); renderGrid(root); };
  root.querySelector('#nextM').onclick = () => { shift(1); renderGrid(root); };
  root.querySelector('#todayM').onclick = () => {
    const t = parseISO(todayISO());
    cal = { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
    renderGrid(root);
  };
}

function shift(delta) {
  let m = cal.month + delta;
  let y = cal.year;
  if (m < 1) { m = 12; y -= 1; }
  if (m > 12) { m = 1; y += 1; }
  cal = { year: y, month: m };
}

export async function renderCalendar(root) {
  if (!cal) {
    const t = parseISO(todayISO());
    cal = { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
  }
  renderGrid(root);
}
