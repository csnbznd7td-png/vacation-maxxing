import { ctx, confirmDialog, run, requestRerender, toast } from '../ui.js';
import { api } from '../api.js';
import { parseDatesFromText } from './oncall.js';
import { formatFR } from '../utils.js';

// Récupère récursivement toutes les dates (timestamps) d'un objet JSON
// (robuste aux exports Claude : created_at, updated_at, sent_at, messages…).
function collectTimestamps(node, out, depth = 0) {
  if (node == null || depth > 12) return;
  if (typeof node === 'string') {
    const m = node.match(/^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/);
    if (m) out.push(m[1]);
    return;
  }
  if (Array.isArray(node)) {
    for (const x of node) collectTimestamps(x, out, depth + 1);
    return;
  }
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) collectTimestamps(node[k], out, depth + 1);
  }
}

function aggregate(dates) {
  const map = new Map();
  for (const d of dates) map.set(d, (map.get(d) || 0) + 1);
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

function parseTextActivity(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(/[,;\t]/).map((s) => s.trim());
    let date = null;
    let count = null;
    for (const c of cells) {
      const ds = parseDatesFromText(c);
      if (ds.length && !date) date = ds[0];
      else if (/^\d+$/.test(c) && count === null) count = Number(c);
    }
    if (!date) {
      const ds = parseDatesFromText(line);
      if (ds.length) date = ds[0];
    }
    if (date) map.set(date, (map.get(date) || 0) + (count || 1));
  }
  return [...map.entries()].map(([date, c]) => ({ date, count: c }));
}

export function parseActivity(text, filename = '') {
  const trimmed = text.trim();
  const looksJson = filename.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{');
  if (looksJson) {
    try {
      const data = JSON.parse(trimmed);
      // Cas générique : tableau de {date,count}
      if (Array.isArray(data) && data.length && data.every((x) => x && x.date)) {
        return data.map((x) => ({ date: String(x.date).slice(0, 10), count: Number(x.count) > 0 ? Number(x.count) : 1, title: x.title }));
      }
      const stamps = [];
      collectTimestamps(data, stamps);
      if (stamps.length) return aggregate(stamps);
    } catch {
      // tombe sur le parsing texte
    }
  }
  return parseTextActivity(text);
}

export async function renderActivity(root) {
  const conv = ctx.state.conversations;

  root.innerHTML = `
    <h1 class="section-title">Activité Claude</h1>
    <div class="card" style="margin-bottom:16px">
      <h3>Importer l'historique de conversations</h3>
      <p class="muted small">
        Importez l'export JSON de vos conversations Claude (<code>conversations.json</code>) ou un CSV.
        L'application mesure votre <b>activité par jour</b> : les périodes creuses (passées comme planifiées)
        sont privilégiées pour les recommandations de congés, les périodes chargées sont signalées.
        Les timestamps sont détectés automatiquement.
      </p>
      <div class="field">
        <label>Fichier JSON / CSV</label>
        <input type="file" id="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" />
      </div>
      <div class="field">
        <label>… ou coller (JSON, ou lignes « date,nombre »)</label>
        <textarea id="paste" placeholder='2026-07-15, 8&#10;2026-08-01, 1'></textarea>
      </div>
      <div class="filters" style="margin:0">
        <div class="field"><label>Mode</label>
          <select id="mode">
            <option value="replace">Remplacer tout</option>
            <option value="merge">Fusionner avec l'existant</option>
          </select>
        </div>
        <button id="importBtn" class="btn-primary">Importer</button>
        <span id="preview" class="muted small"></span>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3 style="margin:0">Données d'activité</h3>
        ${conv.count ? '<button id="clearBtn" class="btn-sm btn-danger">Effacer</button>' : ''}
      </div>
      ${conv.count
        ? `<p style="margin:12px 0 0"><b>${conv.count}</b> jour(s) d'activité enregistré(s)
            ${conv.range ? `<span class="muted">du ${formatFR(conv.range.from)} au ${formatFR(conv.range.to)}</span>` : ''}</p>
           <p class="muted small">Ces données alimentent le moteur de recommandations.</p>`
        : '<div class="empty">Aucune donnée d\'activité. Importez vos conversations pour affiner les recommandations.</div>'}
    </div>
  `;

  let parsed = [];
  const preview = root.querySelector('#preview');
  const setParsed = (arr) => {
    parsed = arr;
    preview.textContent = arr.length ? `${arr.length} jour(s) d'activité détecté(s)` : 'Aucune donnée détectée';
  };

  const fileInput = root.querySelector('#file');
  fileInput.onchange = async () => {
    const f = fileInput.files[0];
    if (!f) return;
    const text = await f.text();
    setParsed(parseActivity(text, f.name));
  };
  root.querySelector('#paste').oninput = (e) => {
    const v = e.target.value.trim();
    setParsed(v ? parseActivity(v) : []);
  };

  root.querySelector('#importBtn').onclick = async () => {
    if (!parsed.length) return toast('Aucune donnée détectée', 'error');
    const mode = root.querySelector('#mode').value;
    const r = await run(api.importConversations(parsed, mode), null);
    toast(`Import terminé : ${r.count} jour(s) d'activité`);
    requestRerender();
  };

  const clearBtn = root.querySelector('#clearBtn');
  if (clearBtn) clearBtn.onclick = async () => {
    if (await confirmDialog('Effacer toutes les données d\'activité ?', { danger: true, confirmLabel: 'Effacer' })) {
      await run(api.clearConversations(), 'Données effacées');
      requestRerender();
    }
  };
}
