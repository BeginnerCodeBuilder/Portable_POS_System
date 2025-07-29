// File: brain/suppliers.routes.js
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const dbPath = path.join(__dirname, "..", "memory", "main.db");
const db = new sqlite3.Database(dbPath);

// ⏫ Ensure table exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    notes TEXT
  )`);
});

// 🛠 Normalize fields (only convert empty strings to null)
function normalize(value) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

const generateSupplierId = () => {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const datePart = `${yyyy}${mm}${dd}`;

    db.get(
      `SELECT id FROM suppliers WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
      [`S-${datePart}-%`],
      (err, row) => {
        if (err) return reject(err);
        const last = row?.id?.split("-")[2] || "0000";
        const next = String(parseInt(last) + 1).padStart(4, "0");
        resolve(`S-${datePart}-${next}`);
      }
    );
  });
};

const SuppliersRoutes = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM suppliers ORDER BY id ASC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  add: (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        const id = await generateSupplierId();
        db.run(
          `INSERT INTO suppliers (
            id, name, contact_person, email, phone, address, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.name,
            normalize(data.contact_person),
            normalize(data.email),
            data.phone,
            normalize(data.address),
            normalize(data.notes),
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

  update: (data) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE suppliers SET
          name = ?, contact_person = ?, email = ?, phone = ?, address = ?, notes = ?
        WHERE id = ?`,
        [
          data.name,
          normalize(data.contact_person),
          normalize(data.email),
          data.phone,
          normalize(data.address),
          normalize(data.notes),
          data.id,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  import: async (rows) => {
    let added = 0,
      skipped = 0,
      failed = 0;

    for (const row of rows) {
      try {
        const name = row["Supplier Name"];
        const contact = normalize(row["Contact Person"]);
        const email = normalize(row["Email"]);
        const phone = row["Phone Number"];
        const address = normalize(row["Address"]);
        const notes = normalize(row["Notes"]);

        if (!name || !phone) {
          failed++;
          continue;
        }

        const duplicate = await new Promise((res, rej) => {
          db.get(
            `SELECT * FROM suppliers WHERE name = ? AND (email = ? OR email IS NULL)`,
            [name, email],
            (err, row) => {
              if (err) rej(err);
              else res(row);
            }
          );
        });

        if (duplicate) {
          skipped++;
          continue;
        }

        await SuppliersRoutes.add({
          name,
          contact_person: contact,
          email,
          phone,
          address,
          notes,
        });

        added++;
      } catch {
        failed++;
      }
    }

    return { added, skipped, failed };
  },

  export: () => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          id AS "Supplier ID",
          name AS "Supplier Name",
          contact_person AS "Contact Person",
          email AS "Email",
          phone AS "Phone Number",
          address AS "Address",
          notes AS "Notes"
        FROM suppliers
        ORDER BY id ASC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          const csv = stringify(rows, { header: true });
          resolve(csv);
        }
      );
    });
  },
};

module.exports = SuppliersRoutes;
