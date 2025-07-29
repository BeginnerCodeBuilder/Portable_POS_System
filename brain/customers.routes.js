// File: brain/customers.routes.js
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const dbPath = path.join(__dirname, "..", "memory", "main.db");
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
const db = new sqlite3.Database(dbPath);

// ─────────────────────────────────────────────────────────────
// 🧱 Ensure Tables Exist
// ─────────────────────────────────────────────────────────────
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    custom_id TEXT UNIQUE,  -- ✅ add this line
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    type TEXT,
    status TEXT,
    date_joined TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customer_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  timestamp TEXT,
  field TEXT,
  "from" TEXT,
  "to" TEXT
)`);

});

// ─────────────────────────────────────────────────────────────
// 🔍 GET customers (with optional filters)
// ─────────────────────────────────────────────────────────────
function getAll(filters = {}) {
  return new Promise((resolve, reject) => {
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

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// ➕ Auto ID Generation
// ─────────────────────────────────────────────────────────────


function generateCustomerID() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const phTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const yyyy = phTime.getFullYear();
    const mm = String(phTime.getMonth() + 1).padStart(2, "0");
    const dd = String(phTime.getDate()).padStart(2, "0");
    const datePart = `${yyyy}${mm}${dd}`;

    const prefix = `C-${datePart}-`;

    db.get(`SELECT COUNT(*) as count FROM customers WHERE custom_id LIKE ?`, [`${prefix}%`], (err, row) => {
      if (err) return reject(err);
      const count = row.count + 1;
      const suffix = String(count).padStart(4, "0");
      resolve(`${prefix}${suffix}`);
    });
  });
}


// ─────────────────────────────────────────────────────────────
// ➕ Add a new customer
// ─────────────────────────────────────────────────────────────
async function add(data) {
  const { first_name, last_name, email, phone, address, type, status } = data;
  if (!first_name || !phone || !address) {
    return { success: false, message: "Missing required fields." };
  }

  const custom_id = await generateCustomerID();

  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO customers
      (custom_id, first_name, last_name, email, phone, address, type, status, date_joined)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'))`);

    stmt.run(custom_id, first_name, last_name, email, phone, address, type, status, function (err) {
      if (err) return resolve({ success: false, message: "Insert failed." });
      resolve({ success: true, id: this.lastID, custom_id }); // also return the new custom_id
    });
  });
}


// ─────────────────────────────────────────────────────────────
// ✏️ Update customer + log changes
// ─────────────────────────────────────────────────────────────
function update(data) {
  return new Promise((resolve, reject) => {
    const { id, first_name, last_name, email, phone, address, type, status } = data;
    db.get("SELECT * FROM customers WHERE id = ?", [id], (err, original) => {
      if (err || !original) return reject("Customer not found.");

      const changes = [];
      const fields = { first_name, last_name, email, phone, address, type, status };

      for (const [key, newVal] of Object.entries(fields)) {
        const oldVal = original[key] || "";
        if (String(oldVal).trim() !== String(newVal).trim()) {
          changes.push({ field: key, from: oldVal, to: newVal });
        }
      }

      const stmt = db.prepare(`UPDATE customers SET
        first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, type = ?, status = ?
        WHERE id = ?`);

      stmt.run(first_name, last_name, email, phone, address, type, status, id, function (err) {
        if (err) return reject(err);

        const logStmt = db.prepare(`INSERT INTO customer_logs (customer_id, timestamp, field, "from", "to") VALUES (?, datetime('now'), ?, ?, ?)`);
        for (const change of changes) {
          logStmt.run(id, change.field, change.from, change.to);
        }

        resolve({ success: true });
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 📜 Get change logs for a customer
// ─────────────────────────────────────────────────────────────
function getLogs(customerId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM customer_logs WHERE customer_id = ? ORDER BY timestamp DESC",
      [customerId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// ─────────────────────────────────────────────────────────────
// 🎁 Get rewards summary for a customer
// ─────────────────────────────────────────────────────────────
function getRewardsSummary(customerId) {
  return new Promise((resolve, reject) => {
    const summary = {
      earned: 0,
      redeemed: 0,
      expired: 0,
      equivalent: 0
    };

    const query = `
      SELECT type, SUM(points) AS totalPoints, SUM(equivalent_value) AS totalValue
      FROM rewards_ledger
      WHERE customer_id = ?
      GROUP BY type
    `;

    db.all(query, [customerId], (err, rows) => {
      if (err) return reject(err);

      for (const row of rows) {
        const type = row.type.toLowerCase();
        if (type === "earned") summary.earned = row.totalPoints;
        if (type === "redeemed") summary.redeemed = row.totalPoints;
        if (type === "expired") summary.expired = row.totalPoints;
        summary.equivalent += row.totalValue || 0;
      }

      resolve(summary);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 📤 Export customers to CSV
// ─────────────────────────────────────────────────────────────
function exportCustomers() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM customers", [], (err, rows) => {
      if (err) return reject(err);

      const csv = stringify(rows, {
        header: true,
        columns: [
          "id",
          "first_name",
          "last_name",
          "email",
          "phone",
          "address",
          "type",
          "status",
          "date_joined"
        ],
      });

      const exportPath = path.join(__dirname, "..", "memory", "customers_export.csv");
      fs.writeFileSync(exportPath, csv);
      resolve(exportPath);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 📥 Import customers from CSV
// ─────────────────────────────────────────────────────────────
function importCustomers(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error("File not found."));
    }

    const data = fs.readFileSync(filePath);
    const records = parse(data, { columns: true, skip_empty_lines: true });

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const insertStmt = db.prepare(`INSERT INTO customers
      (first_name, last_name, email, phone, address, type, status, date_joined)
      VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`);

    const updateStmt = db.prepare(`UPDATE customers SET
      first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, type = ?, status = ?
      WHERE id = ?`);

    db.serialize(() => {
      records.forEach(row => {
        if (!row.id) {
          insertStmt.run(
            row.first_name,
            row.last_name,
            row.email,
            row.phone,
            row.address,
            row.type,
            row.status
          );
          imported++;
        } else {
          db.get("SELECT * FROM customers WHERE id = ?", [row.id], (err, existing) => {
            if (existing) {
              updateStmt.run(
                row.first_name,
                row.last_name,
                row.email,
                row.phone,
                row.address,
                row.type,
                row.status,
                row.id
              );
              updated++;
            } else {
              skipped++;
            }
          });
        }
      });
    });

    resolve({ imported, updated, skipped });
  });
}

module.exports = {
  getAll,
  getOne, // ✅ ADD THIS
  add,
  update,
  getLogs,
  getRewardsSummary,
  exportCustomers,
  importCustomers
};


function getOne(id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM customers WHERE id = ?", [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

