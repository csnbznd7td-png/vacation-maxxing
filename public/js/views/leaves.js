import { ctx, el, openModal, closeModal, confirmDialog, run, requestRerender, toast } from '../ui.js';
import { api } from '../api.js';
import {
  formatFR, todayISO, previewDayCount, LEAVE_TYPE_LABELS, STATUS_LABELS, escapeHtml,
} from '../utils.js';

const filters = { status: 'all', type: 'all', year: 'all' };

function holidaySet() {
  return new Set(ctx.state.holidays.map((h) => h.date));
}

export function leaveFormModal({ existing = null, prefill = null } = {}) {
  const isEdit = !!existing;
  const today = todayISO();
  const defaults = { type: 'CP', startDate: today, endDate: today, halfStart: false, halfEnd: false, status: 'pending', comment: '' };
  const l = existing || { ...defaults, ...(prefill || {}) };

  const m = el(`
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${isEdit ? 'Modifier la demande' : 'Nouvelle demande de congé'}</h2>
      <div class="field">
        <label>Type</label>
        <select name="type">
          ${Object.entries(LEAVE_TYPE_LABELS).map(([v, lab]) => `<option value="${v}" ${v === l.type ? 'selected' : ''}>${lab}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="field"><label>Date de début</label><input type="date" name="startDate" value="${l.startDate}" /></div>
        <div class="field"><label>Date de fin</label><input type="date" name="endDate" value="${l.endDate}" /></div>
      </div>
      <div class="form-row">
        <div class="field checkbox"><input type="checkbox" name="halfStart" ${l.halfStart ? 'checked' : ''} id="hs" /><label for="hs">Début : après-midi seulement (½)</label></div>
        <div class="field checkbox"><input type="checkbox" name="halfEnd" ${l.halfEnd ? 'checked' : ''} id="he" /><label for="he">Fin : matin seulement (½)</label></div>
      </div>
      <div class="field">
        <label>Statut</label>
        <select name="status">
          ${Object.entries(STATUS_LABELS).map(([v, lab]) => `<option value="${v}" ${v === l.status ? 'selected' : ''}>${lab}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Commentaire</label><textarea name="comment" placeholder="Destination, motif…">${escapeHtml(l.comment)}</textarea></div>
      <div class="card" style="background:var(--surface-2);padding:10px 14px">
        Décompte estimé : <b><span id="dayCount">0</span> jour(s) ouvré(s)</b>
        <div class="muted small">week-ends et jours fériés exclus</div>
      </div>
      <div class="modal-actions">
        <button data-act="cancel">Annuler</button>
        <button data-act="save" class="btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </div>`);

  const read = () => ({
    type: m.querySelector('[name=type]').value,
    startDate: m.querySelector('[name=startDate]').value,
    endDate: m.querySelector('[name=endDate]').value,
    halfStart: m.querySelector('[name=halfStart]').checked,
    halfEnd: m.querySelector('[name=halfEnd]').checked,
    status: m.querySelector('[name=status]').value,
    comment: m.querySelector('[name=comment]').value,
  });

  const hSet = holidaySet();
  const updateCount = () => {
    const data = read();
    if (data.startDate && data.endDate && data.endDate >= data.startDate) {
      m.querySelector('#dayCount').textContent = previewDayCount(data, hSet);
    } else {
      m.querySelector('#dayCount').textContent = '—';
    }
  };
  m.querySelectorAll('input, select').forEach((i) => i.addEventListener('input', updateCount));
  updateCount();

  m.querySelector('[data-act=cancel]').onclick = closeModal;
  m.querySelector('[data-act=save]').onclick = async () => {
    const data = read();
    if (!data.startDate || !data.endDate) return toast('Renseignez les dates', 'error');
    if (data.endDate < data.startDate) return toast('La date de fin précède le début', 'error');
    await run(isEdit ? api.updateLeave(existing.id, data) : api.createLeave(data),
      isEdit ? 'Demande mise à jour' : 'Demande créée');
    closeModal();
    requestRerender();
  };

  return m;
}

export async function renderLeaves(root) {
  const hSet = holidaySet();
  const years = [...new Set(ctx.state.leaves.map((l) => l.startDate.slice(0, 4)))].sort().reverse();

  let list = ctx.state.leaves.slice();
  if (filters.status !== 'all') list = list.filter((l) => l.status === filters.status);
  if (filters.type !== 'all') list = list.filter((l) => l.type === filters.type);
  if (filters.year !== 'all') list = list.filter((l) => l.startDate.slice(0, 4) === filters.year);

  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <h1 class="section-title" style="margin:0">Congés</h1>
      <button class="btn-primary" id="newLeave">+ Nouvelle demande</button>
    </div>

    <div class="filters card">
      <div class="field"><label>Statut</label>
        <select id="fStatus">
          <option value="all">Tous</option>
          ${Object.entries(STATUS_LABELS).map(([v, lab]) => `<option value="${v}" ${filters.status === v ? 'selected' : ''}>${lab}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Type</label>
        <select id="fType">
          <option value="all">Tous</option>
          ${Object.entries(LEAVE_TYPE_LABELS).map(([v, lab]) => `<option value="${v}" ${filters.type === v ? 'selected' : ''}>${lab}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Année</label>
        <select id="fYear">
          <option value="all">Toutes</option>
          ${years.map((y) => `<option value="${y}" ${filters.year === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card" style="padding:0;overflow-x:auto">
      ${list.length ? `<table class="table">
        <thead><tr><th>Période</th><th>Type</th><th>Jours</th><th>Statut</th><th>Commentaire</th><th></th></tr></thead>
        <tbody>
          ${list.map((l) => {
            const period = l.startDate === l.endDate
              ? formatFR(l.startDate) + (l.halfStart ? ' (½)' : '')
              : `${formatFR(l.startDate)} → ${formatFR(l.endDate)}`;
            return `<tr data-id="${l.id}">
              <td>${period}</td>
              <td><span class="badge type">${LEAVE_TYPE_LABELS[l.type]}</span></td>
              <td>${previewDayCount(l, hSet)}</td>
              <td>
                <select class="statusSel btn-sm" data-id="${l.id}">
                  ${Object.entries(STATUS_LABELS).map(([v, lab]) => `<option value="${v}" ${l.status === v ? 'selected' : ''}>${lab}</option>`).join('')}
                </select>
              </td>
              <td class="muted small">${escapeHtml(l.comment || '')}</td>
              <td class="row-actions">
                <button class="btn-sm editBtn" data-id="${l.id}">Modifier</button>
                <button class="btn-sm btn-danger delBtn" data-id="${l.id}">Suppr.</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : '<div class="empty">Aucune demande pour ces filtres.</div>'}
    </div>
  `;

  root.querySelector('#newLeave').onclick = () => openModal(leaveFormModal());
  root.querySelector('#fStatus').onchange = (e) => { filters.status = e.target.value; renderLeaves(root); };
  root.querySelector('#fType').onchange = (e) => { filters.type = e.target.value; renderLeaves(root); };
  root.querySelector('#fYear').onchange = (e) => { filters.year = e.target.value; renderLeaves(root); };

  root.querySelectorAll('.statusSel').forEach((sel) => {
    sel.onchange = async () => {
      await run(api.setLeaveStatus(sel.dataset.id, sel.value), 'Statut mis à jour');
      requestRerender();
    };
  });
  root.querySelectorAll('.editBtn').forEach((b) => {
    b.onclick = () => {
      const leave = ctx.state.leaves.find((l) => l.id === b.dataset.id);
      openModal(leaveFormModal({ existing: leave }));
    };
  });
  root.querySelectorAll('.delBtn').forEach((b) => {
    b.onclick = async () => {
      if (await confirmDialog('Supprimer cette demande de congé ?', { danger: true, confirmLabel: 'Supprimer' })) {
        await run(api.deleteLeave(b.dataset.id), 'Demande supprimée');
        requestRerender();
      }
    };
  });
}
