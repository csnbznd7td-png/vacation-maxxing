import { monthNameShort } from '../utils.js';

const TYPE_COLORS = {
  CP: '#0f766e',
  RTT: '#2563eb',
  recuperation: '#0891b2',
  sans_solde: '#94a3b8',
};
const TYPE_ORDER = ['CP', 'RTT', 'recuperation', 'sans_solde'];

// Histogramme empilé des jours pris par mois (SVG responsive).
export function monthlyBarChart(months) {
  const W = 720, H = 240, padL = 28, padB = 28, padT = 12, padR = 8;
  const plotW = W - padL - padR;
  const plotH = H - padB - padT;
  const n = months.length;
  const gap = 10;
  const barW = (plotW - gap * (n - 1)) / n;
  const max = Math.max(1, ...months.map((m) => m.total));
  const niceMax = Math.ceil(max);

  let bars = '';
  let labels = '';
  months.forEach((m, i) => {
    const x = padL + i * (barW + gap);
    let yCursor = padT + plotH;
    for (const t of TYPE_ORDER) {
      const v = m[t] || 0;
      if (v <= 0) continue;
      const h = (v / niceMax) * plotH;
      yCursor -= h;
      bars += `<rect class="bar" x="${x.toFixed(1)}" y="${yCursor.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${TYPE_COLORS[t]}" rx="2"><title>${monthNameShort(m.month)} — ${t} : ${v} j</title></rect>`;
    }
    if (m.total > 0) {
      labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(padT + plotH - (m.total / niceMax) * plotH - 4).toFixed(1)}" text-anchor="middle" style="font-weight:700;fill:#0f172a">${m.total}</text>`;
    }
    labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${monthNameShort(m.month)}</text>`;
  });

  // axe Y : 0 et max
  const axis = `
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#e2e8f0" />
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#e2e8f0" />
    <text x="${padL - 6}" y="${padT + plotH}" text-anchor="end">0</text>
    <text x="${padL - 6}" y="${padT + 8}" text-anchor="end">${niceMax}</text>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Jours de congés pris par mois">${axis}${bars}${labels}</svg>`;
}

export function chartLegend() {
  return `<div class="legend">
    <span><i class="dot" style="background:${TYPE_COLORS.CP}"></i>CP</span>
    <span><i class="dot" style="background:${TYPE_COLORS.RTT}"></i>RTT</span>
    <span><i class="dot" style="background:${TYPE_COLORS.recuperation}"></i>Récupération</span>
    <span><i class="dot" style="background:${TYPE_COLORS.sans_solde}"></i>Sans solde</span>
  </div>`;
}
