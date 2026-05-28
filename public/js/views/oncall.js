import { ctx, confirmDialog, run, requestRerender, toast } from '../ui.js';
import { api } from '../api.js';
import { formatFR } from '../utils.js';

// Extrait toutes les dates (ISO ou JJ/MM/AAAA) d'un texte libre / CSV.
export function parseDatesFromText(text) {
  const found = new Set();
  const iso = /(\d{4})-(\d{2})-(\d{2})/g;
  let mm;
  while ((mm = iso.exec(text))) {
    found.add(`${mm[1]}-${mm[2]}-${mm[3]}`);
  }
  const fr = /\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/g;
  while ((mm = fr.exec(text))) {
    const d = String(mm[1]).padStart(2, '0');
    const mo = String(mm[2]).padStart(2, '0');
    found.add(`${mm[3]}-${mo}-${d}`);
  }
  // validation simple
  return [...found].filter((s) => {
    const [y, mo, d] = s.split('-').map(Number);
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
  }).sort();
}

export async function renderOncall(root) {
  const dates = ctx.state.oncall;

  root.innerHTML = `
    <h1 class="section-title">Astreintes</h1>
    <div class="card" style="margin-bottom:16px">
      <h3>Importer un planning d'astreinte</h3>
      <p class="muted small">Importez un fichier CSV (ou collez le contenu). Les dates au format
        <code>AAAA-MM-JJ</code> ou <code>JJ/MM/AAAA</code> sont détectées automatiquement, quelle que soit la colonne.
        Pour un fichier Excel, exportez-le d'abord en CSV.</p>
      <div class="field">
        <label>Fichier CSV / texte</label>
        <input type="file" id="file" accept=".csv,.txt,text/csv,text/plain" />
      </div>
      <div class="field">
        <label>… ou coller les dates</label>
        <textarea id="paste" placeholder="2026-07-10, 2026-07-11&#10;15/08/2026"></textarea>
      </div>
      <div class="filters" style="margin:0">
        <div class="field"><label>Mode</label>
          <select id="mode">
            <option value="merge">Fusionner avec l'existant</option>
            <option value="replace">Remplacer tout</option>
          </select>
        </div>
        <button id="importBtn" class="btn-primary">Importer</button>
        <span id="preview" class="muted small"></span>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3 style="margin:0">Jours d'astreinte enregistrés (${dates.length})</h3>
        ${dates.length ? '<button id="clearBtn" class="btn-sm btn-danger">Tout vider</button>' : ''}
      </div>
      ${dates.length ? `<div class="btn-row" style="margin-top:12px">
        ${dates.map((d) => `<span class="chip" data-d="${d}" style="cursor:pointer" title="Cliquer pour retirer">${formatFR(d)} ✕</span>`).join('')}
      </div>` : '<div class="empty">Aucune astreinte enregistrée.</div>'}
    </div>
  `;

  let parsed = [];
  const preview = root.querySelector('#preview');
  const setParsed = (arr) => {
    parsed = arr;
    preview.textContent = arr.length ? `${arr.length} date(s) détectée(s)` : '';
  };

  const fileInput = root.querySelector('#file');
  fileInput.onchange = async () => {
    const f = fileInput.files[0];
    if (!f) return;
    const text = await f.text();
    setParsed(parseDatesFromText(text));
  };
  root.querySelector('#paste').oninput = (e) => setParsed(parseDatesFromText(e.target.value));

  root.querySelector('#importBtn').onclick = async () => {
    if (!parsed.length) return toast('Aucune date détectée', 'error');
    const mode = root.querySelector('#mode').value;
    const r = await run(api.importOncall(parsed, mode), null);
    toast(`Import terminé : ${r.count} jour(s) d'astreinte au total`);
    requestRerender();
  };

  const clearBtn = root.querySelector('#clearBtn');
  if (clearBtn) clearBtn.onclick = async () => {
    if (await confirmDialog('Vider toutes les astreintes ?', { danger: true, confirmLabel: 'Vider' })) {
      await run(api.clearOncall(), 'Astreintes vidées');
      requestRerender();
    }
  };

  root.querySelectorAll('.chip[data-d]').forEach((c) => {
    c.onclick = async () => {
      const remaining = ctx.state.oncall.filter((d) => d !== c.dataset.d);
      await run(api.importOncall(remaining, 'replace'), 'Astreinte retirée');
      requestRerender();
    };
  });
}
