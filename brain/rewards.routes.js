// File: brain/rewards.routes.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { app } = require('electron');
const fs = require('fs');
const { stringify } = require('csv-stringify/sync'); // ✅ For CSV export

const dbPath = path.join(__dirname, '..', 'memory', 'main.db');
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    rule TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    note TEXT,
    status TEXT DEFAULT 'Active',
    min_spend REAL,
    reference_code TEXT,
    customer_id TEXT,
    points INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS conversion_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    points INTEGER NOT NULL,
    peso REAL NOT NULL,
    date TEXT NOT NULL
  )`);
});

const RewardsRoutes = {
  saveRewardRule: (data) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`REPLACE INTO rewards (
        id, rule, start_date, end_date, note, status,
        min_spend, reference_code, customer_id, points
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      stmt.run([
        data.id,
        data.rule,
        data.start_date,
        data.end_date || null,
        data.note,
        data.status,
        data.min_spend || null,
        data.reference_code || null,
        data.customer_id || null,
        data.points || 0
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  },

  getAllRewardRules: () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM rewards ORDER BY start_date DESC", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  updateRewardRule: (data) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`UPDATE rewards SET
        start_date = ?, end_date = ?, status = ?, note = ?
        WHERE id = ?`);
      stmt.run([
        data.start_date,
        data.end_date || null,
        data.status,
        data.note,
        data.id
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  },

  saveConversionRate: (data) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare("INSERT INTO conversion_rates (points, peso, date) VALUES (?, ?, ?)");
      stmt.run([data.points, data.peso, data.date], (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  },

  getLatestConversionRate: () => {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM conversion_rates ORDER BY date DESC LIMIT 1", [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // ✅ Export all reward rules as CSV
  exportRewards: async () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM rewards ORDER BY start_date DESC", [], (err, rows) => {
        if (err) return reject(err);

        const csv = stringify(rows, {
          header: true,
          columns: [
            "id",
            "rule",
            "start_date",
            "end_date",
            "note",
            "status",
            "min_spend",
            "reference_code",
            "customer_id",
            "points"
          ]
        });

        resolve(csv);
      });
    });
  }
};




module.exports = RewardsRoutes;
