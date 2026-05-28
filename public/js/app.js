import { api } from './api.js';
import { ctx, setRerender, toast } from './ui.js';

import { renderDashboard } from './views/dashboard.js';
import { renderLeaves } from './views/leaves.js';
import { renderCalendar } from './views/calendar.js';
import { renderHolidays } from './views/holidays.js';
import { renderOncall } from './views/oncall.js';
import { renderActivity } from './views/activity.js';
import { renderReco } from './views/reco.js';
import { renderSettings } from './views/settings.js';

const routes = {
  dashboard: renderDashboard,
  leaves: renderLeaves,
  calendar: renderCalendar,
  holidays: renderHolidays,
  oncall: renderOncall,
  activity: renderActivity,
  reco: renderReco,
  settings: renderSettings,
};

const viewEl = document.getElementById('view');

function currentRoute() {
  const r = (location.hash || '#/dashboard').replace('#/', '');
  return routes[r] ? r : 'dashboard';
}

function setActiveNav(route) {
  document.querySelectorAll('[data-route]').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === route);
  });
}

async function loadAndRender() {
  const route = currentRoute();
  setActiveNav(route);
  try {
    ctx.state = await api.state(ctx.year);
  } catch (err) {
    viewEl.innerHTML = `<div class="empty">Impossible de charger les données : ${err.message}</div>`;
    return;
  }
  viewEl.innerHTML = '';
  await routes[route](viewEl);
  viewEl.focus();
  window.scrollTo(0, 0);
}

setRerender(loadAndRender);

function populateYears() {
  const sel = document.getElementById('yearSelect');
  const now = new Date().getUTCFullYear();
  const years = [];
  for (let y = now - 3; y <= now + 3; y++) years.push(y);
  sel.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
  sel.value = String(ctx.year);
  sel.addEventListener('change', () => {
    ctx.year = Number(sel.value);
    loadAndRender();
  });
}

// Navigation mobile
const sidenav = document.getElementById('sidenav');
document.getElementById('navToggle').addEventListener('click', () => {
  sidenav.classList.toggle('open');
  toggleBackdrop(sidenav.classList.contains('open'));
});
function toggleBackdrop(show) {
  let b = document.querySelector('.backdrop-nav');
  if (show && !b) {
    b = document.createElement('div');
    b.className = 'backdrop-nav';
    b.onclick = () => { sidenav.classList.remove('open'); b.remove(); };
    document.body.appendChild(b);
  } else if (!show && b) {
    b.remove();
  }
}
document.querySelectorAll('[data-route]').forEach((a) => {
  a.addEventListener('click', () => {
    sidenav.classList.remove('open');
    toggleBackdrop(false);
  });
});

window.addEventListener('hashchange', loadAndRender);

populateYears();
loadAndRender();
