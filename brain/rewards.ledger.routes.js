// File: brain/rewards.ledger.routes.js
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { stringify } = require("csv-stringify/sync");

const dbPath = path.join(__dirname, "..", "memory", "main.db");
const db = new sqlite3.Database(dbPath);

// 🧱 Ensure rewards_ledger table exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS rewards_ledger (
    id TEXT PRIMARY KEY,
    date TEXT,
    customer_id TEXT,
    customer_name TEXT,
    type TEXT, -- Earned | Redeemed
    points INTEGER,
    equivalent_value REAL,
    conversion_rate REAL,
    order_number TEXT,
    notes TEXT
  )`);
});

// 🔢 Generate Transaction ID
function generateTransactionId() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const datePart = `${yyyy}${mm}${dd}`;
    const prefix = `RL-${datePart}-`;

    db.get(
      `SELECT id FROM rewards_ledger WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`],
      (err, row) => {
        if (err) return reject(err);
        const last = row?.id?.split("-")[2] || "0000";
        const next = String(parseInt(last) + 1).padStart(4, "0");
        resolve(`${prefix}${next}`);
      }
    );
  });
}

const RewardsLedgerRoutes = {
  // 🔍 Get ledger entries with filters
  getLedger: (filters = {}) => {
    return new Promise((resolve, reject) => {
      const conditions = [];
      const params = [];

      if (filters.customer_id) {
        conditions.push("customer_id = ?");
        params.push(filters.customer_id);
      }

      if (filters.transaction_type && filters.transaction_type !== "All") {
        conditions.push("type = ?");
        params.push(filters.transaction_type);
      }

      if (filters.start_date) {
        conditions.push("date >= ?");
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push("date <= ?");
        params.push(filters.end_date);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const query = `SELECT * FROM rewards_ledger ${whereClause} ORDER BY date DESC`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // ➕ Add ledger entry
  addEntry: async (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        const id = await generateTransactionId();
        const now = new Date().toISOString();
        db.run(
          `INSERT INTO rewards_ledger (
            id, date, customer_id, customer_name, type,
            points, equivalent_value, conversion_rate, order_number, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            now,
            data.customer_id,
            data.customer_name,
            data.type,
            data.points,
            data.equivalent_value || null,
            data.conversion_rate || null,
            data.order_number || null,
            data.notes || null,
          ],
          (err) => {
            if (err) reject(err);
            else resolve(id);
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  },

  // 📝 Update Notes field only
  updateNotes: (id, notes) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE rewards_ledger SET notes = ? WHERE id = ?`,
        [notes, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // 📤 Export filtered ledger data
  exportLedger: (filters = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        const rows = await RewardsLedgerRoutes.getLedger(filters);
        const csv = stringify(rows, {
          header: true,
          columns: {
            id: "Transaction ID",
            date: "Date",
            customer_id: "Customer ID",
            customer_name: "Customer Name",
            type: "Type",
            points: "Points",
            equivalent_value: "Equivalent Value",
            conversion_rate: "Conversion Rate",
            order_number: "Order Number",
            notes: "Notes",
          },
        });
        resolve(csv);
      } catch (err) {
        reject(err);
      }
    });
  },
};

module.exports = RewardsLedgerRoutes;
