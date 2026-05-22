const STORAGE_KEYS = {
  USERS: 'ptr_users_v1',
  SESSION: 'ptr_session_v1'
};

/* =========================================================
   UTILITIES
========================================================= */

const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

function safeAddListener(selector, event, handler) {
  const el = qs(selector);

  if (el) {
    el.addEventListener(event, handler);
  }
}

function setTextIfExists(selector, text) {
  const el = qs(selector);

  if (el) {
    el.textContent = text;
  }
}

function now() {
  return Date.now();
}

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('pt-BR');
}

function hhmmss(seconds) {
  const h = Math.floor(seconds / 3600);
  seconds %= 3600;

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toast(msg, opts = {}) {
  const wrap = qs('.toast-wrap') || (() => {
    const e = document.createElement('div');
    e.className = 'toast-wrap';
    document.body.appendChild(e);
    return e;
  })();

  const t = document.createElement('div');

  t.className = 'toast';
  t.textContent = msg;

  wrap.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(8px)';
  }, opts.timeout || 3000);

  setTimeout(() => {
    t.remove();
  }, (opts.timeout || 3000) + 350);
}

/* =========================================================
   TEMA
========================================================= */

function toggleTheme() {
  document.body.classList.toggle('dark');

  localStorage.setItem(
    'ptr_theme',
    document.body.classList.contains('dark') ? 'dark' : 'light'
  );
}

/* =========================================================
   USERS
========================================================= */

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  } catch {
    return [];
  }
}

function saveUsers(list) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
}

function findUserByEmail(email) {
  return loadUsers().find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
}

function ensureAdminUser() {
  const users = loadUsers();

  const alreadyExists = users.find(
    (u) => u.email === 'admin@pointer.com'
  );

  if (!alreadyExists) {
    users.push({
      id: Date.now(),
      name: 'Administrador',
      email: 'admin@pointer.com',
      password: 'admin123',
      role: 'Administrador',
      isAdmin: true,
      avatar: 'AD'
    });

    saveUsers(users);
  }
}

function registerUser({ name, email, password, role }) {
  const users = loadUsers();

  if (findUserByEmail(email)) {
    toast('Email já cadastrado');
    return false;
  }

  users.push({
    id: Date.now(),
    name,
    email,
    password,
    role,
    isAdmin: false,
    avatar: initials(name)
  });

  saveUsers(users);

  toast('Cadastro realizado com sucesso');

  return true;
}

/* =========================================================
   SESSION
========================================================= */

function setSession(email) {
  localStorage.setItem(
    STORAGE_KEYS.SESSION,
    JSON.stringify({
      email,
      at: now()
    })
  );
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION));
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

function logout() {
  clearSession();

  document.body.classList.remove('logged-in');

  qs('#sistema').style.display = 'none';
  qs('#loginBox').style.display = 'block';

  toast('Desconectado');

  renderLoginForm();
}

function isAdmin() {
  const session = getSession();

  if (!session) return false;

  const user = findUserByEmail(session.email);

  return user?.isAdmin === true;
}

/* =========================================================
   AUTH UI
========================================================= */

function renderLoginForm() {
  qs('#email').value = '';
  qs('#senha').value = '';
  qs('#name').value = '';
  qs('#role').value = 'Colaborador';

  showAuthTab('login');
}

function showAuthTab(tab) {
  qsa('.auth-tab').forEach((el) => {
    el.style.display = 'none';
  });

  qs(`#tab-${tab}`).style.display = 'block';
}

/* =========================================================
   LOGIN & REGISTER
========================================================= */

function handleRegister(e) {
  e.preventDefault();

  const name = qs('#name').value.trim();
  const email = qs('#reg-email').value.trim();
  const password = qs('#reg-senha').value;
  const role = qs('#role').value;

  if (!name || !email || !password) {
    toast('Preencha todos os campos');
    return;
  }

  const ok = registerUser({
    name,
    email,
    password,
    role
  });

  if (ok) {
    setTimeout(() => {
      showAuthTab('login');
    }, 400);
  }
}

function handleLogin(e) {
  e.preventDefault();

  const email = qs('#email').value.trim();
  const password = qs('#senha').value;

  const user = findUserByEmail(email);

  if (!user || user.password !== password) {
    toast('Credenciais inválidas');
    return;
  }

  setSession(user.email);

  document.body.classList.add('logged-in');

  qs('#loginBox').style.display = 'none';
  qs('#sistema').style.display = 'block';

  toast(`Bem-vindo, ${user.name.split(' ')[0]}`);

  renderUserInUI(user);

  mostrarTela('dashboard');

  iniciarGraficos();
  refreshDashboard();
  renderHistory();
}

/* =========================================================
   RECORDS
========================================================= */

function recordsKey(email) {
  return `ptr_records_${email}`;
}

function loadRecords(email) {
  try {
    return JSON.parse(localStorage.getItem(recordsKey(email)) || '[]');
  } catch {
    return [];
  }
}

function saveRecords(email, records) {
  localStorage.setItem(recordsKey(email), JSON.stringify(records));
}

function addEvent(email, ev) {
  const records = loadRecords(email);

  records.push(ev);

  saveRecords(email, records);
}

/* =========================================================
   PONTO
========================================================= */

function createEvent(type, successMessage) {
  const session = getSession();

  if (!session) {
    toast('Faça login');
    return;
  }

  const user = findUserByEmail(session.email);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      addEvent(user.email, {
        type,
        ts: now(),
        location: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }
      });

      toast(`${successMessage} com localização`);

      refreshDashboard();
      renderHistory();
    },

    () => {
      addEvent(user.email, {
        type,
        ts: now()
      });

      toast(`${successMessage} sem localização`);

      refreshDashboard();
      renderHistory();
    }
  );
}

function startEntrada() {
  createEvent('entrada', 'Entrada registrada');
}

function startPausa() {
  createEvent('pausa_start', 'Pausa iniciada');
}

function endPausa() {
  createEvent('pausa_end', 'Pausa encerrada');
}

function endSaida() {
  createEvent('saida', 'Saída registrada');
}

/* =========================================================
   SUMMARY
========================================================= */

function computeSummary(email) {
  const events = loadRecords(email);

  let workedSeconds = 0;
  let pauses = 0;
  let extras = 0;

  const days = new Set();

  let currentEntrada = null;
  let lastPausa = null;
  let totalPauseSeconds = 0;

  events.forEach((ev) => {
    const d = new Date(ev.ts);

    days.add(d.toDateString());

    if (ev.type === 'entrada') {
      currentEntrada = ev.ts;
      lastPausa = null;
    }

    if (ev.type === 'pausa_start') {
      lastPausa = ev.ts;
    }

    if (ev.type === 'pausa_end' && lastPausa) {
      const pauseDuration = Math.floor(
        (ev.ts - lastPausa) / 1000
      );

      pauses += pauseDuration;
      totalPauseSeconds += pauseDuration;

      lastPausa = null;
    }

    if (ev.type === 'saida' && currentEntrada) {
      const dur = Math.floor(
        (ev.ts - currentEntrada) / 1000
      );

      workedSeconds += Math.max(
        0,
        dur - totalPauseSeconds
      );

      currentEntrada = null;
      totalPauseSeconds = 0;
    }
  });

  extras = Math.max(
    0,
    workedSeconds / 3600 - (days.size * 8)
  );

  return {
    workedSeconds,
    pauses,
    extrasHours: Math.round(extras * 100) / 100,
    days: days.size
  };
}

/* =========================================================
   USER UI
========================================================= */

function renderUserInUI(user) {
  const adminOnlyPages = [
    'relatorios',
    'funcionarios'
  ];

  adminOnlyPages.forEach((page) => {
    const link = qsa('.menu a').find((l) =>
      l.getAttribute('onclick')?.includes(page)
    );

    if (link) {
      link.style.display = user.isAdmin
        ? 'flex'
        : 'none';
    }
  });

  const avatar = user.avatar || initials(user.name);

  setTextIfExists('#sidebarUserName', user.name);
  setTextIfExists('#sidebarUserRole', user.role);
  setTextIfExists('#sidebarAvatar', avatar);

  setTextIfExists('#cardUserName', user.name);
  setTextIfExists('#cardAvatar', avatar);

  setTextIfExists('#userName', user.name);
  setTextIfExists('#userRole', user.role);
  setTextIfExists('#userAvatar', avatar);
}

/* =========================================================
   DASHBOARD
========================================================= */

function refreshDashboard() {
  const session = getSession();

  if (!session) return;

  const user = findUserByEmail(session.email);

  if (!user) return;

  const sum = computeSummary(user.email);

  qs('#meta-hours').textContent = hhmmss(
    Math.floor(sum.workedSeconds)
  );

  qs('#meta-extras').textContent = `${sum.extrasHours}h`;

  qs('#meta-pauses').textContent = hhmmss(sum.pauses);

  qs('#meta-days').textContent = `${sum.days}d`;

  qs('#current-time').textContent =
    new Date().toLocaleTimeString();
}

/* =========================================================
   PAGES
========================================================= */

function mostrarTela(id) {
  if (
    (id === 'relatorios' || id === 'funcionarios') &&
    !isAdmin()
  ) {
    toast('Acesso permitido apenas para administradores');
    return;
  }

  qsa('.tela').forEach((tela) => {
    tela.style.display = 'none';
  });

  const telaAtual = qs(`#${id}`);

  if (telaAtual) {
    telaAtual.style.display = 'block';
  }

  qsa('.menu a').forEach((link) => {
    link.classList.remove('active');
  });

  const active = qsa('.menu a').find((l) =>
    l.getAttribute('onclick')?.includes(
      `mostrarTela('${id}')`
    )
  );

  if (active) {
    active.classList.add('active');
    active.setAttribute('aria-current', 'page');
  }

  const labels = {
    dashboard: 'Dashboard',
    historico: 'Histórico',
    relatorios: 'Relatórios',
    funcionarios: 'Funcionários'
  };

  if (qs('#dash-title')) {
    qs('#dash-title').textContent = labels[id] || 'Pointer';
  }

  if (id === 'dashboard') {
    iniciarGraficos();
    refreshDashboard();
  }

  if (id === 'historico') {
    renderHistory();
  }

  if (id === 'relatorios') {
    renderReports();
  }

  if (id === 'funcionarios') {
    renderEmployees();
  }
}

/* =========================================================
   HISTORY
========================================================= */

function buildHistoryHTML(ev, idx, includeDelete = false) {
  return `
  <div class="history-entry">
    <strong>${ev.type.toUpperCase()}</strong>
    — ${formatTime(ev.ts)}

    ${
      ev.location
        ? `
        <small>
          📍 ${ev.location.lat.toFixed(4)},
          ${ev.location.lng.toFixed(4)}
        </small>
      `
        : ''
    }

    ${
      ev.adjustmentRequest
        ? `
        <small>
          🛠 Ajuste solicitado
          (${ev.adjustmentRequest.status})
        </small>
      `
        : ''
    }
  </div>

  <div class="history-actions">
    <button type="button"
      onclick="editHistoryEntry(${idx})">
      Editar
    </button>

    <button type="button"
      onclick="requestAdjustment(${idx})">
      Solicitar ajuste
    </button>

    ${
      includeDelete
        ? `
        <button type="button"
          onclick="deleteHistoryEntry(${idx})">
          Apagar
        </button>
      `
        : ''
    }
  </div>
  `;
}

function renderHistory() {
  const session = getSession();

  if (!session) return;

  const events = loadRecords(session.email);

  const recent = qs('#lista');

  if (recent) {
    recent.innerHTML = '';

    events
      .slice(-6)
      .reverse()
      .forEach((ev, i) => {
        const li = document.createElement('li');

        const idx = events.length - 1 - i;

        li.innerHTML = buildHistoryHTML(ev, idx);

        recent.appendChild(li);
      });
  }

  const full = qs('#lista-hist');

  if (full) {
    full.innerHTML = '';

    events
      .slice()
      .reverse()
      .forEach((ev, i) => {
        const li = document.createElement('li');

        const realIdx = events.length - 1 - i;

        li.innerHTML = buildHistoryHTML(
          ev,
          realIdx,
          true
        );

        full.appendChild(li);
      });
  }
}

/* =========================================================
   AJUSTES
========================================================= */

function requestAdjustment(index) {
  const session = getSession();

  if (!session) return;

  const motivo = prompt(
    'Digite o motivo do ajuste:'
  );

  if (!motivo) {
    toast('Motivo obrigatório');
    return;
  }

  const records = loadRecords(session.email);

  if (!records[index]) {
    toast('Registro não encontrado');
    return;
  }

  records[index].adjustmentRequest = {
    status: 'pendente',
    motivo,
    requestedAt: now()
  };

  saveRecords(session.email, records);

  toast('Solicitação enviada');

  renderHistory();
}

/* =========================================================
   EDITAR
========================================================= */

function editHistoryEntry(index) {
  const session = getSession();

  if (!session) return;

  const email = session.email;

  const records = loadRecords(email);

  if (!records[index]) {
    toast('Registro não encontrado');
    return;
  }

  const entry = records[index];

  const newType = prompt(
    'Editar tipo (entrada/pausa_start/pausa_end/saida):',
    entry.type
  );

  if (!newType) return;

  const newTs = prompt(
    'Editar timestamp:',
    entry.ts
  );

  entry.type = newType;

  if (newTs) {
    entry.ts = parseInt(newTs, 10) || entry.ts;
  }

  saveRecords(email, records);

  toast('Registro atualizado');

  renderHistory();
  renderReports();
  refreshDashboard();
}

/* =========================================================
   DELETE
========================================================= */

function deleteHistoryEntry(index) {
  const session = getSession();

  if (!session) return;

  const email = session.email;

  const records = loadRecords(email);

  if (!records[index]) {
    toast('Registro não encontrado');
    return;
  }

  if (!confirm('Remover este registro?')) {
    return;
  }

  records.splice(index, 1);

  saveRecords(email, records);

  toast('Registro removido');

  renderHistory();
  renderReports();
  refreshDashboard();
}

/* =========================================================
   REPORTS
========================================================= */

function renderReports() {
  const tbody = qs('#table-reports tbody');

  if (!tbody) return;

  tbody.innerHTML = '';

  const users = loadUsers();

  users.forEach((u) => {
    const s = computeSummary(u.email);

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${u.name}</td>
      <td>${hhmmss(Math.floor(s.workedSeconds))}</td>
      <td>${s.extrasHours}h</td>
      <td>${s.days}d</td>
    `;

    tbody.appendChild(tr);
  });
}

/* =========================================================
   EMPLOYEES
========================================================= */

function renderEmployees() {
  const ul = qs('#emp-list');

  if (!ul) return;

  ul.innerHTML = '';

  const users = loadUsers();

  users.forEach((u) => {
    const li = document.createElement('li');

    li.style.padding = '10px';
    li.style.borderBottom =
      '1px solid rgba(0,0,0,0.04)';

    li.textContent =
      `${u.name} — ${u.role} — ${u.email}`;

    ul.appendChild(li);
  });
}

/* =========================================================
   CHARTS
========================================================= */

let chartLine = null;
let chartDonut = null;

function iniciarGraficos() {
  if (typeof Chart !== 'function') return;

  const ctx = qs('#graficoLinha').getContext('2d');

  if (chartLine) {
    chartLine.destroy();
  }

  const days = [
    'Seg',
    'Ter',
    'Qua',
    'Qui',
    'Sex',
    'Sáb',
    'Dom'
  ];

  const data = days.map(
    () => Math.floor(Math.random() * 3) + 6
  );

  const grad = ctx.createLinearGradient(0, 0, 0, 200);

  grad.addColorStop(0, 'rgba(37,99,235,0.9)');
  grad.addColorStop(1, 'rgba(96,165,250,0.05)');

  chartLine = new Chart(ctx, {
    type: 'line',

    data: {
      labels: days,

      datasets: [
        {
          label: 'Horas',
          data,
          borderColor: 'rgba(37,99,235,1)',
          backgroundColor: grad,
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 3
        }
      ]
    },

    options: {
      responsive: true,

      plugins: {
        legend: {
          display: false
        }
      }
    }
  });

  const ctx2 = qs('#graficoPizza').getContext('2d');

  if (chartDonut) {
    chartDonut.destroy();
  }

  chartDonut = new Chart(ctx2, {
    type: 'doughnut',

    data: {
      labels: [
        'Trabalhando',
        'Pausa',
        'Offline'
      ],

      datasets: [
        {
          data: [
            Math.floor(Math.random() * 60) + 20,
            Math.floor(Math.random() * 20) + 5,
            Math.floor(Math.random() * 20) + 5
          ],

          backgroundColor: [
            '#2563eb',
            '#f59e0b',
            '#6b7280'
          ]
        }
      ]
    },

    options: {
      responsive: true,

      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

/* =========================================================
   SEARCH
========================================================= */

function handleSearch(e) {
  const q = (e.target.value || '').toLowerCase();

  qsa('#lista li').forEach((li) => {
    li.style.display = li.textContent
      .toLowerCase()
      .includes(q)
      ? ''
      : 'none';
  });

  qsa('#lista-hist li').forEach((li) => {
    li.style.display = li.textContent
      .toLowerCase()
      .includes(q)
      ? ''
      : 'none';
  });
}

/* =========================================================
   BOOT
========================================================= */

function boot() {
  ensureAdminUser();

  safeAddListener(
    '#form-register',
    'submit',
    handleRegister
  );

  safeAddListener(
    '#form-login',
    'submit',
    handleLogin
  );

  safeAddListener('#btn-logout', 'click', logout);

  safeAddListener(
    '#btn-entrada',
    'click',
    startEntrada
  );

  safeAddListener(
    '#btn-pausa-start',
    'click',
    startPausa
  );

  safeAddListener(
    '#btn-pausa-end',
    'click',
    endPausa
  );

  safeAddListener(
    '#btn-saida',
    'click',
    endSaida
  );

  safeAddListener(
    '#btn-entrada-h',
    'click',
    startEntrada
  );

  safeAddListener(
    '#btn-pausa-start-h',
    'click',
    startPausa
  );

  safeAddListener(
    '#btn-pausa-end-h',
    'click',
    endPausa
  );

  safeAddListener(
    '#btn-saida-h',
    'click',
    endSaida
  );

  safeAddListener(
    '#searchHist',
    'input',
    handleSearch
  );

  safeAddListener(
    '#searchHistPage',
    'input',
    (e) => {
      if (qs('#searchHist')) {
        qs('#searchHist').value = e.target.value;
      }

      handleSearch(e);
    }
  );

  safeAddListener(
    '#toggle-theme',
    'click',
    toggleTheme
  );

  safeAddListener(
    '#toggle-theme-sidebar',
    'click',
    toggleTheme
  );

  if (localStorage.getItem('ptr_theme') === 'dark') {
    document.body.classList.add('dark');
  }

  const session = getSession();

  if (session && findUserByEmail(session.email)) {
    document.body.classList.add('logged-in');

    qs('#loginBox').style.display = 'none';
    qs('#sistema').style.display = 'block';

    renderUserInUI(
      findUserByEmail(session.email)
    );

    mostrarTela('dashboard');

    iniciarGraficos();
    refreshDashboard();
    renderHistory();
    renderReports();
    renderEmployees();
  } else {
    document.body.classList.remove('logged-in');

    qs('#sistema').style.display = 'none';
    qs('#loginBox').style.display = 'block';

    showAuthTab('login');
  }

  setInterval(() => {
    const current = qs('#current-time');

    if (current) {
      current.textContent =
        new Date().toLocaleTimeString();
    }
  }, 1000);
}

document.addEventListener(
  'DOMContentLoaded',
  boot
);