// État partagé + helpers d'interface (sans dépendance aux vues : pas de cycle).

export const ctx = {
  state: null, // dernière réponse /api/state
  year: new Date().getUTCFullYear(),
};

let rerenderFn = () => {};
export function setRerender(fn) { rerenderFn = fn; }
export function requestRerender() { rerenderFn(); }

// ---- Toast ----
let toastTimer = null;
export function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast ' + type; }, 3200);
}

// ---- Création d'éléments depuis du HTML ----
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---- Modale générique ----
export function openModal(innerEl) {
  closeModal();
  const backdrop = el('<div class="modal-backdrop"></div>');
  backdrop.appendChild(innerEl);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
  document.body.appendChild(backdrop);
  document.addEventListener('keydown', escClose);
  const focusable = innerEl.querySelector('input, select, textarea, button');
  if (focusable) focusable.focus();
  return backdrop;
}
export function closeModal() {
  const b = document.querySelector('.modal-backdrop');
  if (b) b.remove();
  document.removeEventListener('keydown', escClose);
}
function escClose(e) { if (e.key === 'Escape') closeModal(); }

// ---- Confirmation ----
export function confirmDialog(message, { confirmLabel = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = el(`
      <div class="modal" role="dialog" aria-modal="true">
        <h2>Confirmation</h2>
        <p>${message}</p>
        <div class="modal-actions">
          <button data-act="cancel">Annuler</button>
          <button data-act="ok" class="${danger ? 'btn-danger' : 'btn-primary'}">${confirmLabel}</button>
        </div>
      </div>`);
    m.querySelector('[data-act="cancel"]').onclick = () => { closeModal(); resolve(false); };
    m.querySelector('[data-act="ok"]').onclick = () => { closeModal(); resolve(true); };
    openModal(m);
  });
}

// Exécute une action async avec gestion d'erreur uniforme.
export async function run(promise, okMsg) {
  try {
    const r = await promise;
    if (okMsg) toast(okMsg);
    return r;
  } catch (err) {
    toast(err.message || 'Une erreur est survenue', 'error');
    throw err;
  }
}
