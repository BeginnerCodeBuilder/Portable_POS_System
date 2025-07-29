// File: brain/billers.routes.js
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const dbPath = path.join(__dirname, "..", "memory", "main.db");
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
const db = new sqlite3.Database(dbPath);

// ────────────────────────────────────────────────
// 📦 Ensure Tables Exist
// ────────────────────────────────────────────────
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS billers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biller_id TEXT UNIQUE,
    company_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    status TEXT DEFAULT 'Active'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS biller_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biller_id TEXT,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    position TEXT DEFAULT 'Secondary'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS biller_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biller_id TEXT,
    timestamp TEXT,
    entity TEXT,
    entity_id TEXT,
    field TEXT,
    from_val TEXT,
    to_val TEXT
  )`);
});

// ────────────────────────────────────────────────
// 🆔 Auto-ID Generator
// ────────────────────────────────────────────────
function generateBillerID() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const base = `B-${datePart}`;

    db.get(
      `SELECT COUNT(*) as count FROM billers WHERE biller_id LIKE ?`,
      [`${base}-%`],
      (err, row) => {
        if (err) return reject(err);
        const next = String(row.count + 1).padStart(4, "0");
        resolve(`${base}-${next}`);
      }
    );
  });
}

// ────────────────────────────────────────────────
// 📁 Exported API Methods
// ────────────────────────────────────────────────
const BillersRoutes = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT b.*, c.name AS primary_contact_name, c.mobile AS primary_contact_mobile
        FROM billers b
        LEFT JOIN biller_contacts c
        ON b.biller_id = c.biller_id AND c.position = 'Primary'
        ORDER BY b.company_name
      `;
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getOne: (biller_id) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM billers WHERE biller_id = ?`, [biller_id], (err, biller) => {
        if (err || !biller) return reject("Biller not found");

        db.all(`SELECT * FROM biller_contacts WHERE biller_id = ?`, [biller_id], (err2, contacts) => {
          if (err2) return reject(err2);
          resolve({ biller, contacts });
        });
      });
    });
  },

  // ✅ New: Get just the contacts (used in modal)
  getContacts: (biller_id) => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM biller_contacts WHERE biller_id = ?`, [biller_id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  add: async ({ company_name, email, phone, address }) => {
    const biller_id = await generateBillerID();
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`INSERT INTO billers (biller_id, company_name, email, phone, address) VALUES (?, ?, ?, ?, ?)`);
      stmt.run([biller_id, company_name, email, phone, address], function (err) {
        if (err) return reject(err);
        resolve({ success: true, biller_id });
      });
    });
  },

  update: ({ biller_id, company_name, email, phone, address, status }) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM billers WHERE biller_id = ?`, [biller_id], (err, original) => {
        if (err || !original) return reject("Not found");

        const fields = { company_name, email, phone, address, status };
        const changes = [];

        for (const [key, val] of Object.entries(fields)) {
          if ((original[key] || "") !== (val || "")) {
            changes.push({ field: key, from: original[key], to: val });
          }
        }

        const stmt = db.prepare(`UPDATE billers SET company_name = ?, email = ?, phone = ?, address = ?, status = ? WHERE biller_id = ?`);
        stmt.run(company_name, email, phone, address, status, biller_id, function (err2) {
          if (err2) return reject(err2);

          const logStmt = db.prepare(`INSERT INTO biller_logs (biller_id, timestamp, entity, entity_id, field, from_val, to_val) VALUES (?, datetime('now'), 'biller', ?, ?, ?, ?)`);
          changes.forEach(change => {
            logStmt.run(biller_id, biller_id, change.field, change.from, change.to);
          });

          resolve({ success: true });
        });
      });
    });
  },

  updateContacts: (biller_id, contacts) => {
    return new Promise((resolve, reject) => {
      const logStmt = db.prepare(`INSERT INTO biller_logs (biller_id, timestamp, entity, entity_id, field, from_val, to_val) VALUES (?, datetime('now'), 'contact', ?, ?, ?, ?)`);
      let pending = contacts.length;
      if (pending === 0) return resolve({ success: true });

      contacts.forEach((c) => {
        db.get(`SELECT * FROM biller_contacts WHERE id = ?`, [c.id], (err, original) => {
          if (err || !original) {
            if (--pending === 0) resolve({ success: true });
            return;
          }

          const stmt = db.prepare(`UPDATE biller_contacts SET name = ?, mobile = ?, status = ?, position = ? WHERE id = ?`);
          stmt.run(c.name, c.phone, c.status, c.position, c.id, (err2) => {
            if (!err2) {
              ["name", "mobile", "status", "position"].forEach(field => {
                if ((original[field] || "") !== (c[field] || "")) {
                  logStmt.run(biller_id, c.id, field, original[field], c[field]);
                }
              });
            }

            if (--pending === 0) resolve({ success: true });
          });
        });
      });
    });
  },

  getLogs: (biller_id) => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM biller_logs WHERE biller_id = ? ORDER BY timestamp DESC`, [biller_id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  import: async (rows) => {
    let added = 0, skipped = 0;
    for (const row of rows) {
      const { company_name, email, phone, address } = row;
      if (!company_name || !phone || !address) {
        skipped++;
        continue;
      }

      const duplicate = await new Promise((res) => {
        db.get(`SELECT * FROM billers WHERE company_name = ? AND email = ?`, [company_name, email || ""], (err, existing) => {
          res(existing);
        });
      });

      if (duplicate) {
        skipped++;
        continue;
      }

      await BillersRoutes.add({ company_name, email, phone, address });
      added++;
    }

    return { added, skipped };
  },

  export: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM billers ORDER BY company_name`, [], (err, rows) => {
        if (err) return reject(err);
        const output = stringify(rows, { header: true });
        resolve(output);
      });
    });
  }
};

module.exports = BillersRoutes;
