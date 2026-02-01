const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Inne',
        quantity REAL NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'szt.',
        expiry_date DATE NOT NULL,
        added_by TEXT NOT NULL DEFAULT 'Ja',
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        product_name TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        expiry_date DATE NOT NULL,
        added_by TEXT NOT NULL,
        added_at TIMESTAMPTZ NOT NULL,
        removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reason TEXT NOT NULL DEFAULT 'used'
      )
    `);

    console.log('Baza danych zainicjalizowana.');
  } finally {
    client.release();
  }
}

// --- Products ---

async function getAllProducts() {
  const { rows } = await pool.query(
    'SELECT * FROM products ORDER BY expiry_date ASC'
  );
  return rows.map(formatProduct);
}

async function addProduct({ name, category, quantity, unit, expiryDate, addedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO products (name, category, quantity, unit, expiry_date, added_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name.trim(), category || 'Inne', quantity || 1, unit || 'szt.', expiryDate, addedBy || 'Ja']
  );
  return formatProduct(rows[0]);
}

async function updateProduct(id, { name, category, quantity, unit, expiryDate, addedBy }) {
  const { rows } = await pool.query(
    `UPDATE products SET
       name = COALESCE($2, name),
       category = COALESCE($3, category),
       quantity = COALESCE($4, quantity),
       unit = COALESCE($5, unit),
       expiry_date = COALESCE($6, expiry_date),
       added_by = COALESCE($7, added_by)
     WHERE id = $1 RETURNING *`,
    [id, name?.trim(), category, quantity, unit, expiryDate, addedBy]
  );
  if (rows.length === 0) return null;
  return formatProduct(rows[0]);
}

async function deleteProduct(id, reason) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM products WHERE id = $1', [id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const p = rows[0];
    await client.query(
      `INSERT INTO history (product_name, category, quantity, unit, expiry_date, added_by, added_at, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [p.name, p.category, p.quantity, p.unit, p.expiry_date, p.added_by, p.added_at, reason || 'used']
    );

    await client.query('DELETE FROM products WHERE id = $1', [id]);

    // Keep history at max 500 entries
    await client.query(`
      DELETE FROM history WHERE id NOT IN (
        SELECT id FROM history ORDER BY removed_at DESC LIMIT 500
      )
    `);

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- History ---

async function getHistory() {
  const { rows } = await pool.query(
    'SELECT * FROM history ORDER BY removed_at DESC LIMIT 500'
  );
  return rows.map(formatHistoryItem);
}

async function clearHistory() {
  await pool.query('DELETE FROM history');
}

// --- Expiring ---

async function getExpiring(days) {
  const { rows } = await pool.query(
    `SELECT * FROM products
     WHERE expiry_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
     ORDER BY expiry_date ASC`,
    [days]
  );
  return rows.map(formatProduct);
}

// --- Formatters ---

function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    expiryDate: row.expiry_date instanceof Date
      ? row.expiry_date.toISOString().split('T')[0]
      : row.expiry_date,
    addedBy: row.added_by,
    addedAt: row.added_at
  };
}

function formatHistoryItem(row) {
  return {
    id: row.id,
    name: row.product_name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    expiryDate: row.expiry_date instanceof Date
      ? row.expiry_date.toISOString().split('T')[0]
      : row.expiry_date,
    addedBy: row.added_by,
    addedAt: row.added_at,
    removedAt: row.removed_at,
    reason: row.reason
  };
}

module.exports = {
  initDB,
  getAllProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getHistory,
  clearHistory,
  getExpiring
};
