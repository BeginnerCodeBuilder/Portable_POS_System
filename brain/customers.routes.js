// File: backend/routes/customers.routes.js
const { ipcMain } = require("electron");
const db = require("../db");

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    date_joined TEXT DEFAULT CURRENT_DATE
  );

  CREATE TABLE IF NOT EXISTS customer_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    field TEXT,
    from TEXT,
    to TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

ipcMain.handle("customers:getAll", async (_, filters = {}) => {
  let query = "SELECT * FROM customers WHERE 1=1";
  const params = [];

  if (filters.type) {
    query += " AND type = ?";
    params.push(filters.type);
  }

  if (filters.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }

  const stmt = db.prepare(query);
  return stmt.all(...params);
});

ipcMain.handle("customers:add", async (_, data) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO customers (first_name, last_name, phone, email, address, type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.first_name,
      data.last_name || null,
      data.phone,
      data.email || null,
      data.address,
      data.type,
      data.status
    );
    return { success: true };
  } catch (err) {
    console.error("Add failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("customers:update", async (_, data) => {
  try {
    const existing = db.prepare("SELECT * FROM customers WHERE id = ?").get(data.id);
    if (!existing) throw new Error("Customer not found");

    const logStmt = db.prepare(`
      INSERT INTO customer_logs (customer_id, field, from, to)
      VALUES (?, ?, ?, ?)
    `);

    const fields = ["first_name", "last_name", "email", "phone", "address", "type", "status"];
    for (const field of fields) {
      const oldValue = existing[field] || "";
      const newValue = data[field] || "";
      if (oldValue !== newValue) {
        logStmt.run(data.id, field, oldValue, newValue);
      }
    }

    const updateStmt = db.prepare(`
      UPDATE customers SET
        first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, type = ?, status = ?
      WHERE id = ?
    `);
    updateStmt.run(
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      data.address,
      data.type,
      data.status,
      data.id
    );

    return { success: true };
  } catch (err) {
    console.error("Update failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("customers:getLogs", (_, customerId) => {
  const stmt = db.prepare(`
    SELECT * FROM customer_logs WHERE customer_id = ? ORDER BY timestamp DESC
  `);
  return stmt.all(customerId);
});

ipcMain.handle("customers:getPointsEquivalent", (_, customerId) => {
  const stmt = db.prepare(`
    SELECT SUM(points) as total_points, SUM(amount) as total_amount
    FROM rewards_ledger
    WHERE customer_id = ? AND type = 'Earned'
  `);
  const result = stmt.get(customerId);
  if (!result || !result.total_points || !result.total_amount) return { rate: 0.01 };
  const rate = result.total_amount / result.total_points;
  return { rate };
});
