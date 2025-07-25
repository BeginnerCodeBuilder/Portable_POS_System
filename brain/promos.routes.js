const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { app } = require("electron");
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const dbPath = path.join(__dirname, "..", "memory", "main.db");
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
const db = new sqlite3.Database(dbPath);

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS promos (
    code TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    rule_summary TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'Scheduled',
    max_redemptions INTEGER,
    redemptions INTEGER DEFAULT 0,
    note TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS promo_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    date TEXT NOT NULL,
    UNIQUE(code, customer_id)
  )`);
});

const PromosRoutes = {
  savePromo: (data) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO promos (
          code, type, rule_summary, start_date, end_date,
          status, max_redemptions, redemptions, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        data.code,
        data.type,
        data.rule_summary,
        data.start_date,
        data.end_date || null,
        data.status,
        data.max_redemptions || null,
        data.redemptions || 0,
        data.note || null
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  },

  getPromos: (filters) => {
    return new Promise((resolve, reject) => {
      const { search = "", status = "All" } = filters;

      const today = new Date().toISOString().split("T")[0];

      // Auto-update statuses based on date
      db.serialize(() => {
        db.run(`
          UPDATE promos
          SET status = 'Expired'
          WHERE end_date IS NOT NULL AND DATE(end_date) < DATE(?)
        `, [today]);

        db.run(`
          UPDATE promos
          SET status = 'Scheduled'
          WHERE DATE(start_date) > DATE(?)
        `, [today]);

        db.run(`
          UPDATE promos
          SET status = 'Active'
          WHERE DATE(start_date) <= DATE(?)
            AND (end_date IS NULL OR DATE(end_date) >= DATE(?))
            AND status != 'Used'
        `, [today, today]);

        let query = `SELECT * FROM promos WHERE 1=1`;
        const params = [];

        if (search) {
          query += ` AND (code LIKE ? OR rule_summary LIKE ?)`;
          params.push(`%${search}%`, `%${search}%`);
        }

        if (status && status !== "All") {
          query += ` AND status = ?`;
          params.push(status);
        }

        query += ` ORDER BY start_date DESC`;

        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    });
  },

  updatePromo: (data) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        UPDATE promos SET
          start_date = ?, end_date = ?, max_redemptions = ?, note = ?, status = ?
        WHERE code = ?
      `);
      stmt.run([
        data.start_date,
        data.end_date || null,
        data.max_redemptions || null,
        data.note || null,
        data.status,
        data.code
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  },

  exportPromos: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM promos ORDER BY start_date DESC`, [], (err, rows) => {
        if (err) return reject(err);
        const csv = stringify(rows, {
          header: true,
          columns: [
            "code", "type", "rule_summary", "start_date", "end_date",
            "status", "max_redemptions", "redemptions", "note"
          ]
        });
        resolve(csv);
      });
    });
  },

  importPromos: (rows) => {
    return new Promise((resolve, reject) => {
      let added = 0, skipped = 0;

      const stmt = db.prepare(`
        INSERT OR IGNORE INTO promos (
          code, type, rule_summary, start_date, end_date,
          status, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        for (const row of rows) {
          if (!row.code || !row.type || !row.rule_summary || !row.start_date || !row.status) {
            skipped++;
            continue;
          }

          stmt.run([
            row.code,
            row.type,
            row.rule_summary,
            row.start_date,
            row.end_date || null,
            row.status,
            row.note || null
          ]);
          added++;
        }

        stmt.finalize(() => {
          resolve({ added, skipped });
        });
      } catch (err) {
        reject(err);
      }
    });
  },

  getPromoStats: () => {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'Used' THEN 1 ELSE 0 END) AS used,
          SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) AS expired
        FROM promos
      `, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  recordRedemption: ({ code, customer_id, order_id }) => {
    return new Promise((resolve, reject) => {
      const date = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT OR IGNORE INTO promo_usage (code, customer_id, order_id, date)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run([code, customer_id, order_id, date], (err) => {
        if (err) return reject(err);

        // Only increment if it's a new customer for this code
        db.run(`UPDATE promos SET redemptions = redemptions + 1 WHERE code = ?`, [code], (err2) => {
          if (err2) reject(err2);
          else resolve();
        });
      });
      stmt.finalize();
    });
  }
};

module.exports = PromosRoutes;
