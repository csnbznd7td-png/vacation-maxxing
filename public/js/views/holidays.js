import { ctx, el, openModal, closeModal, confirmDialog, run, requestRerender, toast } from '../ui.js';
import { api } from '../api.js';
import { formatFR, isWeekend, dayOfWeek, escapeHtml } from '../utils.js';

const DOW_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function holidayFormModal(existing) {
  const isEdit = !!existing;
  const h = existing || { date: '', name: '', recoveryDate: '' };

  const m = el(`
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${isEdit ? 'Modifier le jour férié' : 'Ajouter un jour férié'}</h2>
      <div class="field"><label>Date</label><input type="date" name="date" value="${h.date}" /></div>
      <div class="field"><label>Nom</label><input type="text" name="name" value="${escapeHtml(h.name)}" placeholder="ex. Lundi de Pentecôte" /></div>
      <div class="field" id="recupField" style="display:none">
        <label>Date de récupération (férié tombant un week-end)</label>
        <input type="date" name="recoveryDate" value="${h.recoveryDate || ''}" />
        <span class="muted small">Par défaut : 1er jour ouvré du mois suivant.</span>
      </div>
      <div class="modal-actions">
        <button data-act="cancel">Annuler</button>
        <button data-act="save" class="btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </div>`);

  const dateInput = m.querySelector('[name=date]');
  const recupField = m.querySelector('#recupField');
  const toggleRecup = () => {
    const d = dateInput.value;
    recupField.style.display = d && isWeekend(d) ? '' : 'none';
  };
  dateInput.addEventListener('input', toggleRecup);
  toggleRecup();

  m.querySelector('[data-act=cancel]').onclick = closeModal;
  m.querySelector('[data-act=save]').onclick = async () => {
    const data = {
      date: dateInput.value,
      name: m.querySelector('[name=name]').value.trim(),
      recoveryDate: m.querySelector('[name=recoveryDate]').value || undefined,
    };
    if (!data.date) return toast('Renseignez la date', 'error');
    if (!data.name) return toast('Renseignez le nom', 'error');
    await run(isEdit ? api.updateHoliday(existing.id, data) : api.createHoliday(data),
      isEdit ? 'Jour férié mis à jour' : 'Jour férié ajouté');
    closeModal();
    requestRerender();
  };
  return m;
}

export async function renderHolidays(root) {
  const list = ctx.state.holidays;
  const now = new Date().getUTCFullYear();
  const yearOpts = [];
  for (let y = now - 1; y <= now + 3; y++) yearOpts.push(y);

  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <h1 class="section-title" style="margin:0">Jours fériés</h1>
      <button class="btn-primary" id="addH">+ Ajouter</button>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Générer les jours fériés officiels</h3>
      <div class="filters" style="margin:0">
        <div class="field"><label>Pays</label>
          <select id="genCountry">
            <option value="FR">France</option>
            <option value="LU">Luxembourg</option>
          </select>
        </div>
        <div class="field"><label>Année</label>
          <select id="genYear">${yearOpts.map((y) => `<option value="${y}" ${y === ctx.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
        </div>
        <button id="genBtn" class="btn-primary">Générer</button>
        <span class="muted small">Les doublons (même date) sont ignorés.</span>
      </div>
    </div>

    <div class="card" style="padding:0;overflow-x:auto">
      ${list.length ? `<table class="table">
        <thead><tr><th>Date</th><th>Jour</th><th>Nom</th><th>Récupération</th><th></th></tr></thead>
        <tbody>
          ${list.map((h) => `
            <tr>
              <td>${formatFR(h.date)}</td>
              <td class="${isWeekend(h.date) ? '' : 'muted'}">${DOW_FULL[dayOfWeek(h.date)]}${isWeekend(h.date) ? ' (week-end)' : ''}</td>
              <td>${escapeHtml(h.name)}</td>
              <td>${h.recoveryDate ? `<span class="badge" style="background:var(--recup-soft);color:var(--recup)">${formatFR(h.recoveryDate)}</span>` : '<span class="muted">—</span>'}</td>
              <td class="row-actions">
                <button class="btn-sm editH" data-id="${h.id}">Modifier</button>
                <button class="btn-sm btn-danger delH" data-id="${h.id}">Suppr.</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<div class="empty">Aucun jour férié. Utilisez « Générer » ci-dessus.</div>'}
    </div>
  `;

  root.querySelector('#addH').onclick = () => openModal(holidayFormModal(null));
  root.querySelector('#genBtn').onclick = async () => {
    const y = Number(root.querySelector('#genYear').value);
    const country = root.querySelector('#genCountry').value;
    const r = await run(api.generateHolidays(y, country), null);
    toast(`${r.added} jour(s) férié(s) ajouté(s) pour ${y} (${country})`);
    requestRerender();
  };
  root.querySelectorAll('.editH').forEach((b) => {
    b.onclick = () => openModal(holidayFormModal(ctx.state.holidays.find((h) => h.id === b.dataset.id)));
  });
  root.querySelectorAll('.delH').forEach((b) => {
    b.onclick = async () => {
      if (await confirmDialog('Supprimer ce jour férié ?', { danger: true, confirmLabel: 'Supprimer' })) {
        await run(api.deleteHoliday(b.dataset.id), 'Jour férié supprimé');
        requestRerender();
      }
    };
  });
}
