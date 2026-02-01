const express = require('express');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { startBot } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || '';

const CONFIG = {
  users: ['Ja', 'Żona'],
  categories: [
    'Nabiał',
    'Mięso i ryby',
    'Warzywa',
    'Owoce',
    'Napoje',
    'Pieczywo',
    'Mrożonki',
    'Sosy i przyprawy',
    'Słodycze',
    'Inne'
  ],
  units: ['szt.', 'kg', 'g', 'l', 'ml', 'opak.']
};

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Auth ---

function makeToken(password) {
  return crypto.createHash('sha256').update(password + '_lodowka').digest('hex').slice(0, 32);
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(c => {
    const [k, ...v] = c.split('=');
    cookies[k.trim()] = v.join('=').trim();
  });
  return cookies;
}

// Login endpoint
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (!APP_PASSWORD) return res.redirect('/');
  if (password === APP_PASSWORD) {
    const token = makeToken(APP_PASSWORD);
    res.setHeader('Set-Cookie', `auth=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 90}`);
    return res.redirect('/');
  }
  res.redirect('/login.html?error=1');
});

// Auth middleware - protect everything except login page
app.use((req, res, next) => {
  if (!APP_PASSWORD) return next(); // no password = no protection

  if (req.path === '/login.html' || req.path === '/login') return next();

  const cookies = parseCookies(req.headers.cookie);
  const expected = makeToken(APP_PASSWORD);

  if (cookies.auth === expected) return next();

  // Not authenticated - serve login page
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Nie zalogowany' });
  }
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

app.get('/api/config', (req, res) => {
  res.json(CONFIG);
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getAllProducts();
    res.json(products);
  } catch (err) {
    console.error('Błąd pobierania produktów:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, category, quantity, unit, expiryDate, addedBy } = req.body;

  if (!name || !expiryDate) {
    return res.status(400).json({ error: 'Nazwa i data ważności są wymagane' });
  }

  try {
    const product = await db.addProduct({ name, category, quantity, unit, expiryDate, addedBy });
    res.status(201).json(product);
  } catch (err) {
    console.error('Błąd dodawania produktu:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { name, category, quantity, unit, expiryDate, addedBy } = req.body;

  try {
    const product = await db.updateProduct(req.params.id, { name, category, quantity, unit, expiryDate, addedBy });
    if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    res.json(product);
  } catch (err) {
    console.error('Błąd aktualizacji produktu:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await db.deleteProduct(req.params.id, req.query.reason || 'used');
    if (!result) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Błąd usuwania produktu:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const history = await db.getHistory();
    res.json(history);
  } catch (err) {
    console.error('Błąd pobierania historii:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.post('/api/history/clear', async (req, res) => {
  try {
    await db.clearHistory();
    res.json({ ok: true });
  } catch (err) {
    console.error('Błąd czyszczenia historii:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.get('/api/expiring', async (req, res) => {
  const days = parseInt(req.query.days) || 2;
  try {
    const expiring = await db.getExpiring(days);
    res.json(expiring);
  } catch (err) {
    console.error('Błąd pobierania przeterminowanych:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// --- Start ---

async function start() {
  // Retry DB connection (Railway may start DB after the app)
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await db.initDB();
      break;
    } catch (err) {
      if (attempt === 5) throw err;
      const delay = attempt * 3;
      console.log(`Połączenie z bazą nieudane (próba ${attempt}/5). Ponawiam za ${delay}s...`);
      await new Promise(r => setTimeout(r, delay * 1000));
    }
  }

  startBot();
  app.listen(PORT, () => {
    console.log(`Lodówka działa na http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Nie udało się uruchomić aplikacji:', err.message || err);
  process.exit(1);
});
