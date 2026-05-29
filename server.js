const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

/* =========================================================
   DATABASE SETUP
========================================================= */

const db = new sqlite3.Database('./pointer.db', (err) => {
  if (err) console.error(err);
  else console.log('Banco de dados conectado');
});

// Criar tabelas se não existirem
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      isAdmin BOOLEAN DEFAULT 0,
      createdAt INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY,
      userEmail TEXT NOT NULL,
      type TEXT NOT NULL,
      ts INTEGER NOT NULL,
      latitude REAL,
      longitude REAL,
      createdAt INTEGER,
      FOREIGN KEY(userEmail) REFERENCES users(email)
    )
  `);

  // Inserir admin padrão se não existir
  db.get('SELECT * FROM users WHERE email = ?', ['admin@pointer.com'], (err, row) => {
    if (!err && !row) {
      db.run(
        'INSERT INTO users (name, email, password, role, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        ['Administrador', 'admin@pointer.com', 'admin123', 'Administrador', 1, Date.now()]
      );
    }
  });
});

/* =========================================================
   API ENDPOINTS - USERS
========================================================= */

// Registrar novo usuário
app.post('/api/users/register', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  db.run(
    'INSERT INTO users (name, email, password, role, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, password, role, 0, Date.now()],
    function (err) {
      if (err) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      res.json({ success: true });
    }
  );
});

// Login
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ success: true, user: userWithoutPassword });
    }
  );
});

/* =========================================================
   API ENDPOINTS - RECORDS
========================================================= */

// Obter registros de um usuário
app.get('/api/records/:email', (req, res) => {
  const { email } = req.params;

  db.all(
    'SELECT * FROM records WHERE userEmail = ? ORDER BY ts ASC',
    [email],
    (err, records) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao carregar registros' });
      }
      res.json({ records: records || [] });
    }
  );
});

// Adicionar novo registro
app.post('/api/records', (req, res) => {
  const { userEmail, type, ts, latitude, longitude } = req.body;

  if (!userEmail || !type || !ts) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  db.run(
    'INSERT INTO records (userEmail, type, ts, latitude, longitude, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [userEmail, type, ts, latitude || null, longitude || null, Date.now()],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao salvar registro' });
      }
      res.json({ success: true, recordId: this.lastID });
    }
  );
});

// Sincronizar múltiplos registros (para enviar vários de uma vez)
app.post('/api/records/sync', (req, res) => {
  const { userEmail, records } = req.body;

  if (!userEmail || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  let synced = 0;
  const errors = [];

  const syncNext = (index) => {
    if (index >= records.length) {
      return res.json({ success: true, synced, errors });
    }

    const record = records[index];
    db.run(
      'INSERT OR IGNORE INTO records (userEmail, type, ts, latitude, longitude, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [userEmail, record.type, record.ts, record.latitude || null, record.longitude || null, Date.now()],
      (err) => {
        if (err) {
          errors.push({ record, error: err.message });
        } else {
          synced++;
        }
        syncNext(index + 1);
      }
    );
  };

  syncNext(0);
});

// Endpoint para sincronizar múltiplos usuários (para migração de dados)
app.post('/api/users/sync', (req, res) => {
  const { users } = req.body;

  if (!Array.isArray(users)) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  let synced = 0;
  const errors = [];

  const syncNext = (index) => {
    if (index >= users.length) {
      return res.json({ success: true, synced, errors });
    }

    const user = users[index];
    db.run(
      'INSERT OR IGNORE INTO users (name, email, password, role, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [user.name, user.email, user.password, user.role || 'Colaborador', user.isAdmin ? 1 : 0, user.createdAt || Date.now()],
      (err) => {
        if (err) {
          errors.push({ user: user.email, error: err.message });
        } else {
          synced++;
        }
        syncNext(index + 1);
      }
    );
  };

  syncNext(0);
});

// Endpoint para obter todos os usuários (apenas para admin)
app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, role, isAdmin FROM users', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao carregar usuários' });
    }
    res.json({ users: users || [] });
  });
});

app.get('/status', (req, res) => {
  res.json({ ok: true, port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
