import { ctx } from '../ui.js';
import { api } from '../api.js';
import { monthlyBarChart, chartLegend } from '../components/charts.js';
import { formatFR, todayISO, LEAVE_TYPE_LABELS, STATUS_LABELS, escapeHtml } from '../utils.js';

function statTile(cls, label, value, sub) {
  return `<div class="card stat ${cls}">
    <span class="label">${label}</span>
    <span class="value">${value}</span>
    <span class="sub">${sub}</span>
  </div>`;
}

function progressBar(used, total) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return `<div class="progress"><span style="width:${pct}%"></span></div>`;
}

export async function renderDashboard(root) {
  const { balances, monthly, year } = ctx.state;
  const today = todayISO();

  const upcoming = ctx.state.leaves
    .filter((l) => l.endDate >= today && l.status !== 'rejected')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5);

  const nextHolidays = ctx.state.holidays
    .filter((h) => h.date >= today)
    .slice(0, 5);

  root.innerHTML = `
    <h1 class="section-title">Tableau de bord <span class="muted small">— ${year}</span></h1>

    <div class="grid cols-4" style="margin-bottom:16px">
      <div class="card stat cp">
        <span class="label">CP restants</span>
        <span class="value">${balances.cp.remaining}</span>
        <span class="sub">${balances.cp.used} pris · ${balances.cp.pending} en attente · ${balances.cp.total} acquis</span>
        ${progressBar(balances.cp.used, balances.cp.total)}
      </div>
      <div class="card stat rtt">
        <span class="label">RTT restants</span>
        <span class="value">${balances.rtt.remaining}</span>
        <span class="sub">${balances.rtt.used} pris · ${balances.rtt.pending} en attente · ${balances.rtt.total} acquis</span>
        ${progressBar(balances.rtt.used, balances.rtt.total)}
      </div>
      <div class="card stat recup">
        <span class="label">Récupération dispo.</span>
        <span class="value">${balances.recup.available}</span>
        <span class="sub">${balances.recup.earned} acquis · ${balances.recup.used} utilisés</span>
      </div>
      ${statTile('sans', 'Demandes en attente', ctx.state.leaves.filter((l) => l.status === 'pending').length, 'à valider manuellement')}
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h2>Congés pris par mois (${year})</h2>
        ${monthlyBarChart(monthly)}
        ${chartLegend()}
      </div>
      <div class="card" id="recoPreview">
        <h2>Recommandations</h2>
        <p class="muted small">Calcul en cours…</p>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <h2>Congés à venir</h2>
        ${upcoming.length ? `<table class="table"><tbody>${upcoming.map((l) => `
          <tr>
            <td>${formatFR(l.startDate)}${l.endDate !== l.startDate ? ' → ' + formatFR(l.endDate) : ''}</td>
            <td><span class="badge type">${LEAVE_TYPE_LABELS[l.type]}</span></td>
            <td><span class="badge ${l.status}">${STATUS_LABELS[l.status]}</span></td>
          </tr>`).join('')}</tbody></table>`
          : '<div class="empty">Aucun congé à venir.</div>'}
      </div>
      <div class="card">
        <h2>Prochains jours fériés</h2>
        ${nextHolidays.length ? `<table class="table"><tbody>${nextHolidays.map((h) => `
          <tr>
            <td>${formatFR(h.date)}</td>
            <td>${escapeHtml(h.name)}</td>
            <td>${h.recoveryDate ? `<span class="badge" style="background:var(--recup-soft);color:var(--recup)">récup. ${formatFR(h.recoveryDate)}</span>` : ''}</td>
          </tr>`).join('')}</tbody></table>`
          : '<div class="empty">Aucun jour férié défini. Allez dans « Jours fériés » pour les générer.</div>'}
      </div>
    </div>
  `;

  // Recommandations (chargement asynchrone)
  try {
    const { recommendations } = await api.recommendations(today);
    const box = root.querySelector('#recoPreview');
    const top = recommendations.slice(0, 3);
    box.innerHTML = `<h2>Recommandations</h2>${top.length ? top.map((r) => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:700">${formatFR(r.startDate)}${r.endDate !== r.startDate ? ' → ' + formatFR(r.endDate) : ''}</div>
        <div class="muted small">${r.totalDaysOff} j de repos pour ${r.cpCost} CP · efficacité ×${r.efficiency}${r.bridge ? ' · pont' : ''}</div>
      </div>`).join('') + '<div style="margin-top:10px"><a class="btn btn-sm" href="#/reco">Voir toutes les recommandations</a></div>'
      : '<div class="empty">Aucune suggestion sur la période.</div>'}`;
  } catch {
    const box = root.querySelector('#recoPreview');
    if (box) box.innerHTML = '<h2>Recommandations</h2><div class="empty">Indisponible pour le moment.</div>';
  }
}
