import { ctx, run, requestRerender, toast } from '../ui.js';
import { api } from '../api.js';

export async function renderSettings(root) {
  const s = ctx.state.settings;

  root.innerHTML = `
    <h1 class="section-title">Paramètres</h1>
    <div class="card" style="max-width:560px">
      <h3>Quotas annuels</h3>
      <div class="form-row">
        <div class="field"><label>Jours de CP acquis / an</label><input type="number" id="cp" min="0" step="0.5" value="${s.cpTotalPerYear}" /></div>
        <div class="field"><label>Jours de RTT acquis / an</label><input type="number" id="rtt" min="0" step="0.5" value="${s.rttTotalPerYear}" /></div>
      </div>
      <div class="field"><label>Report de CP (année précédente)</label><input type="number" id="carry" min="0" step="0.5" value="${s.cpCarryOver}" /></div>
      <div class="modal-actions">
        <button id="save" class="btn-primary">Enregistrer</button>
      </div>
    </div>

    <div class="card" style="max-width:560px;margin-top:16px">
      <h3>À propos</h3>
      <p class="muted small">Application personnelle mono-utilisateur. Les données sont stockées localement sur le serveur
        (fichier <code>data/data.json</code>). Le solde de récupération augmente d'un jour pour chaque jour férié
        tombant un week-end.</p>
    </div>
  `;

  root.querySelector('#save').onclick = async () => {
    const payload = {
      cpTotalPerYear: Number(root.querySelector('#cp').value),
      rttTotalPerYear: Number(root.querySelector('#rtt').value),
      cpCarryOver: Number(root.querySelector('#carry').value),
    };
    if ([payload.cpTotalPerYear, payload.rttTotalPerYear, payload.cpCarryOver].some((n) => Number.isNaN(n) || n < 0)) {
      return toast('Valeurs invalides', 'error');
    }
    await run(api.saveSettings(payload), 'Paramètres enregistrés');
    requestRerender();
  };
}
