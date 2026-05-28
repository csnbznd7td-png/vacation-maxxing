async function req(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch { /* pas de corps */ }
  if (!res.ok) {
    const msg = (data && data.error) || `Erreur ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  state: (year) => req('GET', `/api/state${year ? `?year=${year}` : ''}`),
  saveSettings: (s) => req('PUT', '/api/settings', s),

  createLeave: (l) => req('POST', '/api/leaves', l),
  updateLeave: (id, l) => req('PUT', `/api/leaves/${id}`, l),
  setLeaveStatus: (id, status) => req('PATCH', `/api/leaves/${id}/status`, { status }),
  deleteLeave: (id) => req('DELETE', `/api/leaves/${id}`),

  createHoliday: (h) => req('POST', '/api/holidays', h),
  updateHoliday: (id, h) => req('PUT', `/api/holidays/${id}`, h),
  deleteHoliday: (id) => req('DELETE', `/api/holidays/${id}`),
  generateHolidays: (year, country) => req('POST', '/api/holidays/generate', { year, country }),
  holidayCountries: () => req('GET', '/api/holidays/countries'),

  importOncall: (dates, mode) => req('POST', '/api/oncall/import', { dates, mode }),
  clearOncall: () => req('DELETE', '/api/oncall'),

  importConversations: (entries, mode) => req('POST', '/api/conversations/import', { entries, mode }),
  clearConversations: () => req('DELETE', '/api/conversations'),

  recommendations: (from, to) => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return req('GET', `/api/recommendations?${p.toString()}`);
  },
};
