const express = require('express');
const path = require('path');
const db = require('./db');
const { startBot } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

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
