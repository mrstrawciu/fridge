const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, '[]');
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
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
    units: ['szt.', 'kg', 'g', 'l', 'ml', 'opak.'],
    twilio: {
      accountSid: '',
      authToken: '',
      fromNumber: 'whatsapp:+14155238886',
      toNumbers: []
    },
    notifyDaysBefore: 2
  }, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper functions ---

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// --- API Routes ---

// Get config (categories, units, users)
app.get('/api/config', (req, res) => {
  const config = readJSON(CONFIG_FILE);
  res.json({
    users: config.users,
    categories: config.categories,
    units: config.units
  });
});

// Get all products
app.get('/api/products', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  res.json(products);
});

// Add a product
app.post('/api/products', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const { name, category, quantity, unit, expiryDate, addedBy } = req.body;

  if (!name || !expiryDate) {
    return res.status(400).json({ error: 'Nazwa i data ważności są wymagane' });
  }

  const product = {
    id: generateId(),
    name: name.trim(),
    category: category || 'Inne',
    quantity: quantity || 1,
    unit: unit || 'szt.',
    expiryDate,
    addedBy: addedBy || 'Ja',
    addedAt: new Date().toISOString()
  };

  products.push(product);
  writeJSON(PRODUCTS_FILE, products);
  res.status(201).json(product);
});

// Update a product
app.put('/api/products/:id', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const index = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Produkt nie znaleziony' });
  }

  const { name, category, quantity, unit, expiryDate, addedBy } = req.body;
  products[index] = {
    ...products[index],
    name: name !== undefined ? name.trim() : products[index].name,
    category: category !== undefined ? category : products[index].category,
    quantity: quantity !== undefined ? quantity : products[index].quantity,
    unit: unit !== undefined ? unit : products[index].unit,
    expiryDate: expiryDate !== undefined ? expiryDate : products[index].expiryDate,
    addedBy: addedBy !== undefined ? addedBy : products[index].addedBy
  };

  writeJSON(PRODUCTS_FILE, products);
  res.json(products[index]);
});

// Delete a product (move to history)
app.delete('/api/products/:id', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const index = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Produkt nie znaleziony' });
  }

  const removed = products.splice(index, 1)[0];
  removed.removedAt = new Date().toISOString();
  removed.reason = req.query.reason || 'used'; // 'used', 'expired', 'other'

  const history = readJSON(HISTORY_FILE);
  history.unshift(removed);
  // Keep last 500 history entries
  if (history.length > 500) history.length = 500;

  writeJSON(PRODUCTS_FILE, products);
  writeJSON(HISTORY_FILE, history);
  res.json({ ok: true });
});

// Get history
app.get('/api/history', (req, res) => {
  const history = readJSON(HISTORY_FILE);
  res.json(history);
});

// Clear history
app.post('/api/history/clear', (req, res) => {
  writeJSON(HISTORY_FILE, []);
  res.json({ ok: true });
});

// Get products expiring soon (for notifications)
app.get('/api/expiring', (req, res) => {
  const config = readJSON(CONFIG_FILE);
  const products = readJSON(PRODUCTS_FILE);
  const days = parseInt(req.query.days) || config.notifyDaysBefore || 2;
  const now = new Date();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const expiring = products.filter(p => {
    const exp = new Date(p.expiryDate);
    return exp <= threshold;
  }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  res.json(expiring);
});

app.listen(PORT, () => {
  console.log(`Lodówka działa na http://localhost:${PORT}`);
});
