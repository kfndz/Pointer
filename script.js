const STORAGE_KEYS = {
  USERS: 'ptr_users_v1',
  SESSION: 'ptr_session_v1'
};

const API_URL = 'https://pointer-5zd3.onrender.com/api';

/* =========================================================
   SYNC - SINCRONIZAÇÃO COM SERVIDOR
========================================================= */

async function syncUserToServer(userData) {
  try {
    const response = await fetch(`${API_URL} /users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    return response.ok;
  } catch (e) {
    console.warn('Erro ao sincronizar usuário com servidor:', e);
    return false;
  }
}

async function syncRecordsToServer(userEmail, records) {
  try {
    const response = await fetch(`${API_URL} /records/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, records })
    });

    return response.ok;
  } catch (e) {
    console.warn('Erro ao sincronizar registros com servidor:', e);
    return false;
  }
}

async function syncRecordToServer(userEmail, record) {
  try {
    const response = await fetch(`${API_URL}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail,
        type: record.type,
        ts: record.ts,
        latitude: record.location?.lat || null,
        longitude: record.location?.lng || null
      })
    });

    return response.ok;
  } catch (e) {
    console.warn('Erro ao sincronizar registro com servidor:', e);
    return false;
  }
}

async function loadRecordsFromServer(userEmail) {
  try {
    const response = await fetch(`${API_URL}/records/${userEmail}`);

    if (!response.ok) return [];

    const data = await response.json();

    return (data.records || []).map((record) => ({
      type: record.type,
      ts: record.ts,
      adjustmentRequest: record.adjustmentRequest || null,
      location:
        record.latitude && record.longitude
          ? {
            lat: record.latitude,
            lng: record.longitude
          }
          : null
    }));
  } catch (e) {
    console.warn('Erro ao carregar registros do servidor:', e);
    return [];
  }
}

async function syncAllUsersToServer() {
  try {
    const users = loadUsers();

    const response = await fetch(`${API_URL}/users/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users })
    });

    if (response.ok) {
      const result = await response.json();

      console.log(
        `Sincronizados ${result.synced} usuários com servidor`
      );

      return true;
    }

    return false;
  } catch (e) {
    console.warn(
      'Erro ao sincronizar usuários com servidor:',
      e
    );

    return false;
  }
}

async function syncAllRecordsToServer() {
  try {
    const users = loadUsers();

    let totalSynced = 0;

    for (const user of users) {
      const records = loadRecords(user.email);

      if (records.length > 0) {
        const response = await fetch(
          `${API_URL}/records/sync`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userEmail: user.email,
              records
            })
          }
        );

        if (response.ok) {
          const result = await response.json();

          totalSynced += result.synced;
        }
      }
    }

    console.log(
      `Sincronizados ${totalSynced} registros com servidor`
    );

    return true;
  } catch (e) {
    console.warn(
      'Erro ao sincronizar registros com servidor:',
      e
    );

    return false;
  }
}

async function loginAtServer(email, password) {
  try {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data.user;
  } catch (e) {
    console.warn(
      'Erro ao fazer login no servidor:',
      e
    );

    return null;
  }
}

/* =========================================================
   UTILITIES
========================================================= */

const qs = (s) => document.querySelector(s);

const qsa = (s) =>
  Array.from(document.querySelectorAll(s));

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

  return `${String(h).padStart(
    2,
    '0'
  )}:${String(m).padStart(
    2,
    '0'
  )}:${String(s).padStart(2, '0')}`;
}

function toast(msg, opts = {}) {
  const wrap =
    qs('.toast-wrap') ||
    (() => {
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
    document.body.classList.contains('dark')
      ? 'dark'
      : 'light'
  );
}

/* =========================================================
   USERS
========================================================= */

function loadUsers() {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEYS.USERS) || '[]'
    );
  } catch {
    return [];
  }
}

function saveUsers(list) {
  localStorage.setItem(
    STORAGE_KEYS.USERS,
    JSON.stringify(list)
  );
}

function findUserByEmail(email) {
  return loadUsers().find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase()
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

function registerUser({
  name,
  email,
  password,
  role
}) {
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
    return JSON.parse(
      localStorage.getItem(STORAGE_KEYS.SESSION)
    );
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

async function restoreSession(session) {
  try {
    const localUser = findUserByEmail(session.email);

    if (!localUser) {
      logout();
      return;
    }

    document.body.classList.add('logged-in');

    qs('#loginBox').style.display = 'none';
    qs('#sistema').style.display = 'block';

    const serverRecords = await loadRecordsFromServer(
      session.email
    );

    const localRecords = loadRecords(session.email);

    const mergedRecords = mergeRecords(
      localRecords,
      serverRecords
    );

    saveRecords(session.email, mergedRecords);

    renderUserInUI(localUser);

    renderAdminUserSelect();

    mostrarTela('dashboard');

    iniciarGraficos();
    refreshDashboard();
    renderHistory();
    renderReports();
    renderEmployees();

    console.log('Sessão restaurada');
  } catch (e) {
    console.warn(
      'Erro ao restaurar sessão:',
      e
    );

    logout();
  }
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

  const userData = {
    name,
    email,
    password,
    role
  };

  const ok = registerUser(userData);

  if (ok) {
    syncUserToServer(userData).then((success) => {
      if (success) {
        toast('Cadastro sincronizado na nuvem');
      }
    });

    setTimeout(() => {
      showAuthTab('login');
    }, 400);
  }
}

function handleLogin(e) {
  e.preventDefault();

  const email = qs('#email').value.trim();

  const password = qs('#senha').value;

  loginAtServer(email, password).then(
    async (serverUser) => {
      let user = null;

      if (serverUser) {
        user = serverUser;

        const users = loadUsers();

        const existingIndex = users.findIndex(
          (u) =>
            u.email.toLowerCase() ===
            email.toLowerCase()
        );

        if (existingIndex >= 0) {
          users[existingIndex] = {
            ...users[existingIndex],
            name: user.name,
            password,
            role: user.role,
            isAdmin: user.isAdmin
          };
        } else {
          users.push({
            id: user.id || Date.now(),
            name: user.name,
            email: user.email,
            password,
            role: user.role,
            isAdmin: user.isAdmin || false,
            avatar:
              user.avatar || initials(user.name)
          });
        }

        saveUsers(users);
      } else {
        user = findUserByEmail(email);

        if (
          !user ||
          user.password !== password
        ) {
          toast('Credenciais inválidas');

          return;
        }
      }

      setSession(user.email);

      const serverRecords =
        await loadRecordsFromServer(email);

      const localRecords = loadRecords(email);

      const mergedRecords = mergeRecords(
        localRecords,
        serverRecords
      );

      saveRecords(email, mergedRecords);

      if (
        localRecords.length >
        serverRecords.length
      ) {
        await syncRecordsToServer(
          email,
          mergedRecords
        );
      }

      toast('Dados sincronizados com sucesso');

      document.body.classList.add('logged-in');

      qs('#loginBox').style.display = 'none';

      qs('#sistema').style.display = 'block';

      toast(
        `Bem-vindo, ${user.name.split(' ')[0]
        }`
      );

      renderUserInUI(user);

      renderAdminUserSelect();

      mostrarTela('dashboard');

      iniciarGraficos();
      refreshDashboard();
      renderHistory();
      renderReports();
      renderEmployees();
    }
  );
}

/* =========================================================
   RECORDS
========================================================= */

function recordsKey(email) {
  return `ptr_records_${email}`;
}

function loadRecords(email) {
  try {
    return JSON.parse(
      localStorage.getItem(recordsKey(email)) ||
      '[]'
    );
  } catch {
    return [];
  }
}

function saveRecords(email, records) {
  localStorage.setItem(
    recordsKey(email),
    JSON.stringify(records)
  );
}

function mergeRecords(
  localRecords,
  serverRecords
) {
  const mergedMap = new Map();

  [...localRecords, ...serverRecords].forEach(
    (record) => {
      const key = `${record.type}_${record.ts}`;

      if (!mergedMap.has(key)) {
        mergedMap.set(key, record);
      }
    }
  );

  return Array.from(
    mergedMap.values()
  ).sort((a, b) => a.ts - b.ts);
}

function addEvent(email, ev) {
  const records = loadRecords(email);

  records.push(ev);

  saveRecords(email, records);

  syncRecordToServer(email, ev);
}

/* =========================================================
   PONTO
========================================================= */

function createEvent(
  type,
  successMessage
) {
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

      toast(
        `${successMessage} com localização`
      );

      refreshDashboard();
      renderHistory();
    },

    () => {
      addEvent(user.email, {
        type,
        ts: now()
      });

      toast(
        `${successMessage} sem localização`
      );

      refreshDashboard();
      renderHistory();
    }
  );
}

function startEntrada() {
  createEvent(
    'entrada',
    'Entrada registrada'
  );
}

function startPausa() {
  createEvent(
    'pausa_start',
    'Pausa iniciada'
  );
}

function endPausa() {
  createEvent(
    'pausa_end',
    'Pausa encerrada'
  );
}

function endSaida() {
  createEvent(
    'saida',
    'Saída registrada'
  );
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

    if (
      ev.type === 'pausa_end' &&
      lastPausa
    ) {
      const pauseDuration = Math.floor(
        (ev.ts - lastPausa) / 1000
      );

      pauses += pauseDuration;

      totalPauseSeconds += pauseDuration;

      lastPausa = null;
    }

    if (
      ev.type === 'saida' &&
      currentEntrada
    ) {
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
    workedSeconds / 3600 - days.size * 8
  );

  return {
    workedSeconds,
    pauses,
    extrasHours:
      Math.round(extras * 100) / 100,
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
      l
        .getAttribute('onclick')
        ?.includes(page)
    );

    if (link) {
      link.style.display = user.isAdmin
        ? 'flex'
        : 'none';
    }
  });

  const avatar =
    user.avatar || initials(user.name);

  setTextIfExists(
    '#sidebarUserName',
    user.name
  );

  setTextIfExists(
    '#sidebarUserRole',
    user.role
  );

  setTextIfExists(
    '#sidebarAvatar',
    avatar
  );

  setTextIfExists(
    '#cardUserName',
    user.name
  );

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

  const targetEmail =
    (arguments.length > 0 &&
      arguments[0]) ||
    (session && session.email);

  if (!targetEmail) return;

  const user =
    findUserByEmail(targetEmail);

  if (!user) return;

  const sum = computeSummary(user.email);

  qs('#meta-hours').textContent =
    hhmmss(Math.floor(sum.workedSeconds));

  qs('#meta-extras').textContent =
    `${sum.extrasHours}h`;

  qs('#meta-pauses').textContent =
    hhmmss(sum.pauses);

  qs('#meta-days').textContent =
    `${sum.days}d`;

  qs('#current-time').textContent =
    new Date().toLocaleTimeString();
}

/* =========================================================
   PAGES
========================================================= */

function mostrarTela(id) {
  if (
    (id === 'relatorios' ||
      id === 'funcionarios') &&
    !isAdmin()
  ) {
    toast(
      'Acesso permitido apenas para administradores'
    );

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

  const active = qsa('.menu a').find(
    (l) =>
      l
        .getAttribute('onclick')
        ?.includes(
          `mostrarTela('${id}')`
        )
  );

  if (active) {
    active.classList.add('active');

    active.setAttribute(
      'aria-current',
      'page'
    );
  }

  const labels = {
    dashboard: 'Dashboard',
    historico: 'Histórico',
    relatorios: 'Relatórios',
    funcionarios: 'Funcionários'
  };

  if (qs('#dash-title')) {
    qs('#dash-title').textContent =
      labels[id] || 'Pointer';
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

function buildHistoryHTML(
  ev,
  idx,
  includeDelete = false,
  showActions = true
) {
  return `
  <div class="history-entry">
    <strong>${ev.type.toUpperCase()}</strong>
    — ${formatTime(ev.ts)}

    ${ev.location
      ? `
        <small>
          📍 ${ev.location.lat.toFixed(
        4
      )},
          ${ev.location.lng.toFixed(4)}
        </small>
      `
      : ''
    }

    ${ev.adjustmentRequest
      ? `
        <small>
          🛠 Ajuste solicitado
          (${ev.adjustmentRequest.status})
        </small>
      `
      : ''
    }
  </div>

  ${showActions
      ? `
  <div class="history-actions">
    <button type="button"
      onclick="editHistoryEntry(${idx})">
      Editar
    </button>

    <button type="button"
      onclick="requestAdjustment(${idx})">
      Solicitar ajuste
    </button>

    ${includeDelete
        ? `
        <button type="button"
          onclick="deleteHistoryEntry(${idx})">
          Apagar
        </button>
      `
        : ''
      }
  </div>
  `
      : ''
    }
  `;
}

function renderHistory(email) {
  const session = getSession();

  if (!session && !email) return;

  const targetEmail =
    email || session.email;

  const events = loadRecords(targetEmail);

  const recent = qs('#lista');

  if (recent) {
    recent.innerHTML = '';

    const showActions = session
      ? targetEmail === session.email
      : false;

    events
      .slice(-6)
      .reverse()
      .forEach((ev, i) => {
        const li =
          document.createElement('li');

        const idx =
          events.length - 1 - i;

        li.innerHTML = buildHistoryHTML(
          ev,
          idx,
          false,
          showActions
        );

        recent.appendChild(li);
      });
  }

  const full = qs('#lista-hist');

  if (full) {
    full.innerHTML = '';

    const showActionsFull = session
      ? targetEmail === session.email
      : false;

    events
      .slice()
      .reverse()
      .forEach((ev, i) => {
        const li =
          document.createElement('li');

        const realIdx =
          events.length - 1 - i;

        li.innerHTML = buildHistoryHTML(
          ev,
          realIdx,
          true,
          showActionsFull
        );

        full.appendChild(li);
      });
  }
}

function renderAdminUserSelect() {
  const wrap = qs('#admin-panel');

  const sel = qs('#admin-user-select');

  if (!sel || !wrap) return;

  if (!isAdmin()) {
    wrap.style.display = 'none';

    return;
  }

  wrap.style.display = 'block';

  const users = loadUsers();

  sel.innerHTML = '';

  users.forEach((u) => {
    const opt =
      document.createElement('option');

    opt.value = u.email;

    opt.textContent = `${u.name} (${u.email})`;

    sel.appendChild(opt);
  });

  const session = getSession();

  if (session) {
    sel.value = session.email;
  }
}

function viewEmployeeRecords(email) {
  mostrarTela('historico');

  const sel = qs('#admin-user-select');

  if (sel) {
    sel.value = email;
  }

  renderHistory(email);
  iniciarGraficos(email);
  refreshDashboard(email);
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

  const records = loadRecords(
    session.email
  );

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
    entry.ts =
      parseInt(newTs, 10) || entry.ts;
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
  const tbody =
    qs('#table-reports tbody');

  if (!tbody) return;

  tbody.innerHTML = '';

  const users = loadUsers();

  users.forEach((u) => {
    const s = computeSummary(u.email);

    const tr =
      document.createElement('tr');

    tr.innerHTML = `
      <td>${u.name}</td>
      <td>${hhmmss(
      Math.floor(s.workedSeconds)
    )}</td>
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
    const li =
      document.createElement('li');

    li.style.padding = '10px';

    li.style.borderBottom =
      '1px solid rgba(0,0,0,0.04)';

    li.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div>${u.name} — ${u.role} — ${u.email}</div>
        <div>
          <button type="button" onclick="viewEmployeeRecords('${u.email}')">
            Ver registros
          </button>
        </div>
      </div>
    `;

    ul.appendChild(li);
  });
}

/* =========================================================
   CHARTS
========================================================= */

let chartLine = null;
let chartDonut = null;

function computeWeeklyHours(email) {
  const events = (
    loadRecords(email) || []
  )
    .slice()
    .sort((a, b) => a.ts - b.ts);

  const hours = [
    0, 0, 0, 0, 0, 0, 0
  ];

  let currentEntrada = null;
  let lastPausa = null;
  let totalPauseSeconds = 0;

  events.forEach((ev) => {
    const d = new Date(ev.ts);

    let dayIndex = d.getDay();

    dayIndex =
      dayIndex === 0
        ? 6
        : dayIndex - 1;

    if (ev.type === 'entrada') {
      currentEntrada = ev.ts;
      lastPausa = null;
      totalPauseSeconds = 0;
    }

    if (ev.type === 'pausa_start') {
      lastPausa = ev.ts;
    }

    if (
      ev.type === 'pausa_end' &&
      lastPausa
    ) {
      const pauseDuration = Math.floor(
        (ev.ts - lastPausa) / 1000
      );

      totalPauseSeconds += pauseDuration;

      lastPausa = null;
    }

    if (
      ev.type === 'saida' &&
      currentEntrada
    ) {
      const dur = Math.floor(
        (ev.ts - currentEntrada) / 1000
      );

      const worked = Math.max(
        0,
        dur - totalPauseSeconds
      );

      hours[dayIndex] += worked / 3600;

      currentEntrada = null;
      totalPauseSeconds = 0;
      lastPausa = null;
    }
  });

  return hours;
}

function iniciarGraficos() {
  if (typeof Chart !== 'function')
    return;

  const session = getSession();

  const targetEmail =
    (arguments.length > 0 &&
      arguments[0]) ||
    (session && session.email);

  const lineCanvas = qs(
    '#graficoLinha'
  );

  const donutCanvas = qs(
    '#graficoPizza'
  );

  if (!lineCanvas || !donutCanvas)
    return;

  const ctx =
    lineCanvas.getContext('2d');

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

  let data = days.map(() => 0);

  if (targetEmail) {
    const weekly =
      computeWeeklyHours(targetEmail);

    data = days.map(
      (_, i) =>
        Math.round(
          (weekly[i] + Number.EPSILON) *
          100
        ) / 100
    );
  }

  const grad =
    ctx.createLinearGradient(
      0,
      0,
      0,
      200
    );

  grad.addColorStop(
    0,
    'rgba(37,99,235,0.9)'
  );

  grad.addColorStop(
    1,
    'rgba(96,165,250,0.05)'
  );

  chartLine = new Chart(ctx, {
    type: 'line',

    data: {
      labels: days,

      datasets: [
        {
          label: 'Horas',
          data,
          borderColor:
            'rgba(37,99,235,1)',
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

  const ctx2 =
    donutCanvas.getContext('2d');

  if (chartDonut) {
    chartDonut.destroy();
  }

  let donutValues = [30, 10, 10];

  if (targetEmail) {
    const sum =
      computeSummary(targetEmail);

    const workedHours =
      Math.round(
        (sum.workedSeconds / 3600) *
        100
      ) / 100;

    const pauseHours =
      Math.round(
        (sum.pauses / 3600) * 100
      ) / 100;

    const expected = sum.days * 8;

    const offlineHours = Math.max(
      0,
      Math.round(
        (expected - workedHours) *
        100
      ) / 100
    );

    donutValues = [
      workedHours,
      pauseHours,
      offlineHours
    ];
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
          data: donutValues,

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
  const q = (
    e.target.value || ''
  ).toLowerCase();

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

  const syncInitialized =
    localStorage.getItem(
      'ptr_sync_initialized'
    );

  if (!syncInitialized) {
    Promise.all([
      syncAllUsersToServer(),
      syncAllRecordsToServer()
    ]).then(() => {
      localStorage.setItem(
        'ptr_sync_initialized',
        'true'
      );

      console.log(
        'Sincronização inicial concluída'
      );
    });
  }

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

  safeAddListener(
    '#btn-logout',
    'click',
    logout
  );

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
        qs('#searchHist').value =
          e.target.value;
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
    '#admin-user-select',
    'change',
    (e) => {
      renderHistory(e.target.value);
      iniciarGraficos(e.target.value);
      refreshDashboard(e.target.value);
    }
  );

  safeAddListener(
    '#toggle-theme-sidebar',
    'click',
    toggleTheme
  );

  if (
    localStorage.getItem('ptr_theme') ===
    'dark'
  ) {
    document.body.classList.add('dark');
  }

  const session = getSession();

  if (
    session &&
    findUserByEmail(session.email)
  ) {
    restoreSession(session);
  } else {
    document.body.classList.remove(
      'logged-in'
    );

    qs('#sistema').style.display =
      'none';

    qs('#loginBox').style.display =
      'block';

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
