const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { app } = require('electron');
const fs = require('fs');
const stringify = require('csv-stringify/sync').stringify; // ✅ install with: npm i csv-stringify
const parse = require('csv-parse/sync').parse; // ✅ install with: npm i csv-parse

// 💾 Use consistent DB location
const dbPath = path.join(__dirname, '..', 'memory', 'main.db');
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
const db = new sqlite3.Database(dbPath);


// 🧱 Create table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    refill INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT DEFAULT 'Circulation',
    date_added TEXT NOT NULL
  )`);
});

const VouchersRoutes = {
  saveVouchers: (data) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString().split("T")[0];
      const stmt = db.prepare(`INSERT OR IGNORE INTO vouchers (
        id, refill, start_date, end_date, status, date_added
      ) VALUES (?, ?, ?, ?, ?, ?)`);

      let saved = 0;
      let skipped = 0;

      db.serialize(() => {
        for (const id of data.voucher_ids) {
          const status = data.start_date > now ? 'Scheduled' : 'Circulation';
          stmt.run([
            id,
            data.refill,
            data.start_date,
            data.end_date || null,
            status,
            now
          ], function (err) {
            if (err) {
              console.error("Voucher insert error:", err.message);
              skipped++;
            } else {
              if (this.changes === 1) saved++;
              else skipped++;
            }
          });
        }

        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve({ saved, skipped });
        });
      });
    });
  },

  // ✅ NEW: Filter + Paginated GET
getVouchers: (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM vouchers`;
    const conditions = [];
    const params = [];

    if (filters.status && filters.status !== 'All') {
      conditions.push(`status = ?`);
      params.push(filters.status);
    }

    if (filters.search && filters.search.trim()) {
      conditions.push(`id LIKE ?`);
      params.push(`%${filters.search.trim()}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY date_added DESC`;

    const limit = parseInt(filters.limit || 10);
    const offset = (parseInt(filters.page || 1) - 1) * limit;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);

      // Total count
      let countQuery = `SELECT COUNT(*) as total FROM vouchers`;
      const countParams = [];

      if (conditions.length > 0) {
        countQuery += ` WHERE ` + conditions.join(" AND ");
        countParams.push(...params.slice(0, -2)); // exclude limit/offset
      }

      db.get(countQuery, countParams, (err2, countRow) => {
        if (err2) reject(err2);
        else resolve({ data: rows, total: countRow.total });
      });
    });
  });
},


  updateVoucher: (data) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`UPDATE vouchers SET
        refill = ?, start_date = ?, end_date = ?, status = ?
        WHERE id = ?`);
      stmt.run([
        data.refill,
        data.start_date,
        data.end_date || null,
        data.status,
        data.id
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  },

  getVoucherSummary: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT
        SUM(CASE WHEN status = 'Circulation' THEN 1 ELSE 0 END) AS circulation,
        SUM(CASE WHEN status = 'Used' THEN 1 ELSE 0 END) AS used,
        SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) AS expired,
        SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) AS scheduled
      FROM vouchers`, [], (err, row) => {
        if (err) reject(err);
        else resolve(row[0]);
      });
    });
  },

// ✅ Export vouchers to CSV string
exportVouchers: async (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM vouchers`;
    const conditions = [];
    const params = [];

    if (filters.status && filters.status !== 'All') {
      conditions.push(`status = ?`);
      params.push(filters.status);
    }

    if (filters.search && filters.search.trim()) {
      conditions.push(`id LIKE ?`);
      params.push(`%${filters.search.trim()}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY date_added DESC`;

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);

      const csv = stringify(rows, {
        header: true,
        columns: [
          "id", "refill", "start_date", "end_date", "status", "date_added"
        ]
      });

      resolve(csv);
    });
  });
},

// ✅ Export vouchers to CSV string
exportVouchers: async (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM vouchers`;
    const conditions = [];
    const params = [];

    if (filters.status && filters.status !== 'All') {
      conditions.push(`status = ?`);
      params.push(filters.status);
    }

    if (filters.search && filters.search.trim()) {
      conditions.push(`id LIKE ?`);
      params.push(`%${filters.search.trim()}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY date_added DESC`;

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);

      const csv = stringify(rows, {
        header: true,
        columns: [
          "id", "refill", "start_date", "end_date", "status", "date_added"
        ]
      });

      resolve(csv);
    });
  });
},

// ✅ Import vouchers from array of parsed CSV rows
importVouchers: async (rows) => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString().split("T")[0];
    const stmt = db.prepare(`INSERT OR IGNORE INTO vouchers (
      id, refill, start_date, end_date, status, date_added
    ) VALUES (?, ?, ?, ?, ?, ?)`);

    let saved = 0;
    let skipped = 0;

    db.serialize(() => {
      for (const row of rows) {
        const id = (row.id || "").trim();
        const refill = parseInt(row.refill);
        const start_date = row.start_date?.trim();
        const end_date = row.end_date?.trim() || null;
        const status = ["Circulation", "Used", "Expired", "Scheduled"].includes(row.status)
          ? row.status : "Circulation";
        const date_added = row.date_added || now;

        if (!id || !refill || !start_date || id.length !== 10) {
          skipped++;
          continue;
        }

        stmt.run([
          id,
          refill,
          start_date,
          end_date,
          status,
          date_added
        ], function (err) {
          if (err) {
            console.error("Import error:", err.message);
            skipped++;
          } else {
            if (this.changes === 1) saved++;
            else skipped++;
          }
        });
      }

      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve({ saved, skipped });
      });
    });
  });
}


};

module.exports = VouchersRoutes;
