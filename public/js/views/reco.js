import { ctx, openModal, run, requestRerender, toast } from '../ui.js';
import { api } from '../api.js';
import { leaveFormModal } from './leaves.js';
import { formatFR, todayISO, addDays, escapeHtml } from '../utils.js';

const rangeState = { from: null, to: null };

export async function renderReco(root) {
  if (!rangeState.from) rangeState.from = todayISO();
  if (!rangeState.to) rangeState.to = addDays(todayISO(), 182);

  root.innerHTML = `
    <h1 class="section-title">Recommandations de congés</h1>
    <div class="card" style="margin-bottom:16px">
      <p class="muted small">Périodes optimales calculées en croisant : <b>ponts</b> autour des week-ends et jours fériés,
        <b>évitement des astreintes</b>, <b>activité Claude</b> (périodes creuses privilégiées) et <b>efficacité</b> (jours de repos par CP dépensé).</p>
      <div class="filters" style="margin:0">
        <div class="field"><label>Du</label><input type="date" id="from" value="${rangeState.from}" /></div>
        <div class="field"><label>Au</label><input type="date" id="to" value="${rangeState.to}" /></div>
        <button id="calc" class="btn-primary">Calculer</button>
      </div>
    </div>
    <div id="results"><div class="empty">Calcul en cours…</div></div>
  `;

  root.querySelector('#calc').onclick = () => {
    rangeState.from = root.querySelector('#from').value || todayISO();
    rangeState.to = root.querySelector('#to').value || addDays(rangeState.from, 182);
    loadResults(root);
  };

  loadResults(root);
}

async function loadResults(root) {
  const box = root.querySelector('#results');
  let recs;
  try {
    const r = await api.recommendations(rangeState.from, rangeState.to);
    recs = r.recommendations;
  } catch (err) {
    box.innerHTML = `<div class="empty">Erreur : ${escapeHtml(err.message)}</div>`;
    return;
  }
  if (!recs.length) {
    box.innerHTML = '<div class="empty">Aucune recommandation sur cette période. Ajustez les dates ou importez vos astreintes / activité.</div>';
    return;
  }

  box.innerHTML = `<div class="grid" style="gap:14px">${recs.map((r, i) => {
    const period = r.startDate === r.endDate ? formatFR(r.startDate) : `${formatFR(r.startDate)} → ${formatFR(r.endDate)}`;
    const actChip = r.activityLevel !== 'inconnue'
      ? `<span class="chip ${r.activityLevel}">activité ${r.activityLevel}</span>` : '';
    return `<div class="card reco-card ${r.bridge ? 'bridge' : ''}">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
        <div>
          <div class="reco-dates">${period}</div>
          <div class="reco-meta">
            <span><b>${r.cpCost}</b> jour(s) de congé</span>
            <span><b>${r.totalDaysOff}</b> jours de repos (${formatFR(r.spanStart)} → ${formatFR(r.spanEnd)})</span>
            <span>efficacité <b>×${r.efficiency}</b></span>
          </div>
          <div class="btn-row">
            ${r.bridge ? '<span class="chip" style="background:var(--primary-soft);color:var(--primary)">Pont</span>' : ''}
            ${actChip}
          </div>
          <ul class="reco-reasons">${r.reasons.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
        </div>
        <button class="btn-primary btn-sm createReco" data-i="${i}">Poser ce congé</button>
      </div>
    </div>`;
  }).join('')}</div>`;

  box.querySelectorAll('.createReco').forEach((b) => {
    b.onclick = () => {
      const r = recs[Number(b.dataset.i)];
      openModal(leaveFormModal({ prefill: { type: 'CP', startDate: r.startDate, endDate: r.endDate, status: 'pending' } }));
    };
  });
}
