/*
  Full application logic: users, session, ponto, charts, toasts, dark mode
*/

const STORAGE_KEYS = {
  USERS: 'ptr_users_v1',
  SESSION: 'ptr_session_v1'
};

/* ---------- Utilities ---------- */
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

function toast(msg, opts = {}) {
  const wrap = qs('.toast-wrap') || (function () {
    const e = document.createElement('div'); e.className = 'toast-wrap'; document.body.appendChild(e); return e;
  })();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(8px)'; }, opts.timeout || 3000);
  setTimeout(() => t.remove(), (opts.timeout || 3000) + 350);
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('pt-BR');
}

function hhmmss(seconds) {
  const h = Math.floor(seconds / 3600); seconds %= 3600; const m = Math.floor(seconds / 60); const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ---------- Users & Session ---------- */
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]'); } catch (e) { return [] }
}

function saveUsers(list) { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list)); }

function findUserByEmail(email) { return loadUsers().find(u => u.email.toLowerCase() === email.toLowerCase()); }

function registerUser({ name, email, password, role }) {
  const users = loadUsers();
  if (findUserByEmail(email)) { toast('Email já cadastrado'); return false; }
  users.push({ id: Date.now(), name, email, password, role, avatar: initials(name) });
  saveUsers(users);
  toast('Cadastro realizado com sucesso');
  return true;
}

function initials(name) { return name.split(' ').map(p => p[0] || '').slice(0, 2).join('').toUpperCase(); }

function setSession(email) { localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ email, at: Date.now() })); }

function getSession() { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION)); } catch (e) { return null } }

function clearSession() { localStorage.removeItem(STORAGE_KEYS.SESSION); }

function logout() { clearSession(); document.body.classList.remove('logged-in'); qs('#sistema').style.display = 'none'; qs('#loginBox').style.display = 'block'; toast('Desconectado'); renderLoginForm(); }

/* ---------- Auth UI ---------- */
function renderLoginForm() {
  // reset forms
  qs('#email').value = ''; qs('#senha').value = ''; qs('#name').value = ''; qs('#role').value = 'Colaborador';
  // show login tab
  showAuthTab('login');
}

function showAuthTab(tab) { qsa('.auth-tab').forEach(el => el.style.display = 'none'); qs(`#tab-${tab}`).style.display = 'block'; }

/* ---------- Registration & Login handlers ---------- */
function handleRegister(e) {
  e.preventDefault();
  const name = qs('#name').value.trim();
  const email = qs('#reg-email').value.trim();
  const password = qs('#reg-senha').value;
  const role = qs('#role').value;
  if (!name || !email || !password) { toast('Preencha todos os campos'); return; }
  const ok = registerUser({ name, email, password, role });
  if (ok) { setTimeout(() => showAuthTab('login'), 400); }
}

function handleLogin(e) {
  e.preventDefault();
  const email = qs('#email').value.trim();
  const password = qs('#senha').value;
  const user = findUserByEmail(email);
  if (!user || user.password !== password) { toast('Credenciais inválidas'); return; }
  setSession(user.email);
  document.body.classList.add('logged-in');
  qs('#loginBox').style.display = 'none';
  qs('#sistema').style.display = 'block';
  toast(`Bem-vindo, ${user.name.split(' ')[0]}`);
  renderUserInUI(user);
  iniciarGraficos();
  refreshDashboard();
}

/* ---------- Ponto (time tracking) ---------- */
function recordsKey(email) { return `ptr_records_${email}`; }

function loadRecords(email) { try { return JSON.parse(localStorage.getItem(recordsKey(email)) || '[]'); } catch (e) { return [] } }

function saveRecords(email, records) { localStorage.setItem(recordsKey(email), JSON.stringify(records)); }

function addEvent(email, ev) { const r = loadRecords(email); r.push(ev); saveRecords(email, r); }

function now() { return Date.now(); }

function startEntrada() { const s = getSession(); if (!s) { toast('Faça login'); return; } const user = findUserByEmail(s.email); addEvent(user.email, { type: 'entrada', ts: now() }); toast('Entrada registrada'); refreshDashboard(); renderHistory(); }

function startPausa() { const s = getSession(); if (!s) { toast('Faça login'); return; } addEvent(s.email, { type: 'pausa_start', ts: now() }); toast('Pausa iniciada'); refreshDashboard(); renderHistory(); }

function endPausa() { const s = getSession(); if (!s) { toast('Faça login'); return; } addEvent(s.email, { type: 'pausa_end', ts: now() }); toast('Pausa encerrada'); refreshDashboard(); renderHistory(); }

function endSaida() { const s = getSession(); if (!s) { toast('Faça login'); return; } addEvent(s.email, { type: 'saida', ts: now() }); toast('Saída registrada'); refreshDashboard(); renderHistory(); }

function computeSummary(email) {
  // compute simple aggregates from events
  const events = loadRecords(email);
  let workedSeconds = 0, pauses = 0, extras = 0, days = new Set();
  let currentEntrada = null, lastPausa = null, totalPauseSeconds = 0;
  events.forEach(ev => {
    const d = new Date(ev.ts); days.add(d.toDateString());
    if (ev.type === 'entrada') { currentEntrada = ev.ts; lastPausa = null; }
    if (ev.type === 'pausa_start') { lastPausa = ev.ts; }
    if (ev.type === 'pausa_end' && lastPausa) { totalPauseSeconds += Math.floor((ev.ts - lastPausa) / 1000); lastPausa = null; }
    if (ev.type === 'saida' && currentEntrada) { const dur = Math.floor((ev.ts - currentEntrada) / 1000); workedSeconds += Math.max(0, dur - totalPauseSeconds); currentEntrada = null; totalPauseSeconds = 0; }
  });
  // hours per week simple estimate
  extras = Math.max(0, workedSeconds / 3600 - (days.size * 8));
  return { workedSeconds, pauses: totalPauseSeconds, extrasHours: Math.round(extras * 100) / 100, days: days.size };
}

/* ---------- Render / UI ---------- */
function renderUserInUI(user) { qs('#userName').textContent = user.name; qs('#userRole').textContent = user.role; qs('#avatar').textContent = user.avatar || initials(user.name); }

function refreshDashboard() {
  const s = getSession(); if (!s) return; const user = findUserByEmail(s.email); if (!user) return; const sum = computeSummary(user.email);
  qs('#meta-hours').textContent = hhmmss(Math.floor(sum.workedSeconds));
  qs('#meta-extras').textContent = `${sum.extrasHours}h`;
  qs('#meta-pauses').textContent = hhmmss(sum.pauses);
  qs('#meta-days').textContent = `${sum.days}d`;
  // clock
  qs('#current-time').textContent = new Date().toLocaleTimeString();
}

// Show/hide pages
function mostrarTela(id) {
  qsa('.tela').forEach(t => t.style.display = 'none');
  const el = qs('#' + id);
  if (el) el.style.display = 'block';
  // update charts/data when navigating
  if (id === 'dashboard') { iniciarGraficos(); refreshDashboard(); }
  if (id === 'historico') { renderHistory(); }
  if (id === 'relatorios') { renderReports(); }
  if (id === 'funcionarios') { renderEmployees(); }
}

// enhanced history rendering with edit/delete and support for historico page
function renderHistory() {
  const s = getSession(); if (!s) return; const events = loadRecords(s.email);
  // dashboard list (recent)
  const recent = qs('#lista'); if (recent) { recent.innerHTML = ''; events.slice(-6).reverse().forEach((ev, i) => { const li = document.createElement('li'); const idx = events.length - 1 - i; li.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>${ev.type.toUpperCase()}</strong> — ${formatTime(ev.ts)}</div><div style="display:flex;gap:8px"><button onclick="editHistoryEntry(${idx})">Editar</button><button onclick="deleteHistoryEntry(${idx})">Apagar</button></div></div>`; recent.appendChild(li); }); }

  // full historico page
  const full = qs('#lista-hist'); if (full) { full.innerHTML = ''; events.slice().reverse().forEach((ev, i) => { const realIdx = events.length - 1 - i; const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.innerHTML = `<div><strong>${ev.type.toUpperCase()}</strong> — ${formatTime(ev.ts)}</div><div style="display:flex;gap:8px"><button onclick="editHistoryEntry(${realIdx})">Editar</button><button onclick="deleteHistoryEntry(${realIdx})">Apagar</button></div>`; full.appendChild(li); }); }
}

function editHistoryEntry(index) {
  const s = getSession(); if (!s) return; const email = s.email; const records = loadRecords(email);
  if (!records[index]) { toast('Registro não encontrado'); return; }
  const entry = records[index];
  const newType = prompt('Editar tipo (entrada/pausa_start/pausa_end/saida):', entry.type);
  if (!newType) return;
  const newTs = prompt('Editar timestamp (ms desde 1970) ou deixe vazio para manter:', entry.ts);
  entry.type = newType;
  if (newTs) entry.ts = parseInt(newTs, 10) || entry.ts;
  saveRecords(email, records);
  toast('Registro atualizado');
  renderHistory(); renderReports(); refreshDashboard();
}

function deleteHistoryEntry(index) {
  const s = getSession(); if (!s) return; const email = s.email; const records = loadRecords(email);
  if (!records[index]) { toast('Registro não encontrado'); return; }
  if (!confirm('Remover este registro?')) return;
  records.splice(index, 1); saveRecords(email, records); toast('Registro removido'); renderHistory(); renderReports(); refreshDashboard();
}

/* ---------- Reports & Employees rendering ---------- */
function renderReports() {
  const tbody = qs('#table-reports tbody'); if (!tbody) return; tbody.innerHTML = ''; const users = loadUsers(); users.forEach(u => { const s = computeSummary(u.email); const tr = document.createElement('tr'); tr.innerHTML = `<td>${u.name}</td><td>${hhmmss(Math.floor(s.workedSeconds))}</td><td>${s.extrasHours}h</td><td>${s.days}d</td>`; tbody.appendChild(tr); });
}

function renderEmployees() {
  const ul = qs('#emp-list'); if (!ul) return; ul.innerHTML = ''; const users = loadUsers(); users.forEach(u => { const li = document.createElement('li'); li.style.padding = '10px'; li.style.borderBottom = '1px solid rgba(0,0,0,0.04)'; li.textContent = `${u.name} — ${u.role} — ${u.email}`; ul.appendChild(li); });
}

/* ---------- Charts ---------- */
let chartLine = null, chartDonut = null;
function iniciarGraficos() {
  if (typeof Chart !== 'function') return; const s = getSession(); if (!s) return; const user = findUserByEmail(s.email);
  // line - weekly hours (fake from records)
  const ctx = qs('#graficoLinha').getContext('2d'); if (chartLine) chartLine.destroy();
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const data = days.map(() => Math.floor(Math.random() * 3) + 6);
  const grad = ctx.createLinearGradient(0, 0, 0, 200); grad.addColorStop(0, 'rgba(37,99,235,0.9)'); grad.addColorStop(1, 'rgba(96,165,250,0.05)');
  chartLine = new Chart(ctx, { type: 'line', data: { labels: days, datasets: [{ label: 'Horas', data, borderColor: 'rgba(37,99,235,1)', backgroundColor: grad, borderWidth: 3, fill: true, tension: 0.35, pointRadius: 3 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
  // donut
  const ctx2 = qs('#graficoPizza').getContext('2d'); if (chartDonut) chartDonut.destroy();
  chartDonut = new Chart(ctx2, { type: 'doughnut', data: { labels: ['Trabalhando', 'Pausa', 'Offline'], datasets: [{ data: [Math.floor(Math.random() * 60) + 20, Math.floor(Math.random() * 20) + 5, Math.floor(Math.random() * 20) + 5], backgroundColor: ['#2563eb', '#f59e0b', '#6b7280'] }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
}

/* ---------- Search & Filters ---------- */
function handleSearch(e) {
  const q = (e.target.value || '').toLowerCase();
  // filter quick dashboard list
  qsa('#lista li').forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  // filter full historico list
  qsa('#lista-hist li').forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

/* ---------- Init ---------- */
function boot() {
  // wire auth forms
  qs('#form-register').addEventListener('submit', handleRegister);
  qs('#form-login').addEventListener('submit', handleLogin);
  if (qs('#btn-logout')) qs('#btn-logout').addEventListener('click', logout);
  if (qs('#btn-entrada')) qs('#btn-entrada').addEventListener('click', startEntrada);
  if (qs('#btn-pausa-start')) qs('#btn-pausa-start').addEventListener('click', startPausa);
  if (qs('#btn-pausa-end')) qs('#btn-pausa-end').addEventListener('click', endPausa);
  if (qs('#btn-saida')) qs('#btn-saida').addEventListener('click', endSaida);
  // historico page buttons (duplicate actions)
  if (qs('#btn-entrada-h')) qs('#btn-entrada-h').addEventListener('click', startEntrada);
  if (qs('#btn-pausa-start-h')) qs('#btn-pausa-start-h').addEventListener('click', startPausa);
  if (qs('#btn-pausa-end-h')) qs('#btn-pausa-end-h').addEventListener('click', endPausa);
  if (qs('#btn-saida-h')) qs('#btn-saida-h').addEventListener('click', endSaida);
  if (qs('#searchHist')) qs('#searchHist').addEventListener('input', handleSearch);
  if (qs('#searchHistPage')) qs('#searchHistPage').addEventListener('input', (e) => { if (qs('#searchHist')) qs('#searchHist').value = e.target.value; handleSearch(e); });
  qs('#toggle-theme').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('ptr_theme', document.body.classList.contains('dark') ? 'dark' : 'light'); });
  if (qs('#toggle-theme-sidebar')) qs('#toggle-theme-sidebar').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('ptr_theme', document.body.classList.contains('dark') ? 'dark' : 'light'); });

  // restore theme
  if (localStorage.getItem('ptr_theme') === 'dark') document.body.classList.add('dark');

  const session = getSession(); if (session && findUserByEmail(session.email)) {
    document.body.classList.add('logged-in'); qs('#loginBox').style.display = 'none'; qs('#sistema').style.display = 'block'; renderUserInUI(findUserByEmail(session.email)); mostrarTela('dashboard'); iniciarGraficos(); refreshDashboard(); renderHistory(); renderReports(); renderEmployees();
  } else { document.body.classList.remove('logged-in'); qs('#sistema').style.display = 'none'; qs('#loginBox').style.display = 'block'; showAuthTab('login'); }

  // clock update
  setInterval(() => { qs('#current-time').textContent = new Date().toLocaleTimeString(); }, 1000);
}

document.addEventListener('DOMContentLoaded', boot);