const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const dayjs = require("dayjs");
const { stringify } = require("csv-stringify/sync");
const { parse } = require("csv-parse/sync");

const dbPath = path.join(__dirname, "..", "memory", "main.db");

if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new sqlite3.Database(dbPath);
const CUSTOMER_PREFIX = "C";

// ───────────────────────────────────────────
// 🔸 Create Table
// ───────────────────────────────────────────
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    type TEXT DEFAULT 'Regular',
    status TEXT DEFAULT 'Active',
    date_joined TEXT NOT NULL,
    last_edit TEXT,
    change_log TEXT DEFAULT '[]'
  )`);
});

// ───────────────────────────────────────────
// 🔹 Helper: Generate Customer ID
// ───────────────────────────────────────────
function generateCustomerId() {
  return new Promise((resolve, reject) => {
    const datePart = dayjs().format("YYYYMMDD");
    const prefix = `${CUSTOMER_PREFIX}-${datePart}`;
    db.get(
      `SELECT id FROM customers WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`],
      (err, row) => {
        if (err) return reject(err);
        let next = 1;
        if (row) {
          const lastNum = parseInt(row.id.split("-")[2]);
          next = lastNum + 1;
        }
        const newId = `${prefix}-${String(next).padStart(4, "0")}`;
        resolve(newId);
      }
    );
  });
}

// ───────────────────────────────────────────
// 🔹 Core Module
// ───────────────────────────────────────────
const CustomerRoutes = {
  // ➕ Add
  addCustomer: async (data) => {
    const id = await generateCustomerId();
    const dateJoined = dayjs().format("YYYY-MM-DD HH:mm:ss");

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO customers (
          id, first_name, last_name, email, phone, address,
          type, status, date_joined
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.first_name,
          data.last_name || "",
          data.email || "",
          data.phone,
          data.address,
          data.type || "Regular",
          data.status || "Active",
          dateJoined,
        ],
        (err) => {
          if (err) reject(err);
          else resolve({ success: true, id });
        }
      );
    });
  },

  // ✏️ Update
  updateCustomer: (data) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM customers WHERE id = ?`, [data.id], (err, existing) => {
        if (err || !existing) return reject("Customer not found");

        const updates = {
          first_name: data.first_name,
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone,
          address: data.address,
          type: data.type,
          status: data.status,
          last_edit: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        };

        const log = JSON.parse(existing.change_log || "[]");
        const now = dayjs().format("YYYY-MM-DD HH:mm:ss");

        for (const key in updates) {
          if (updates[key] !== existing[key]) {
            log.push({
              field: key,
              from: existing[key],
              to: updates[key],
              timestamp: now,
            });
          }
        }

        db.run(
          `UPDATE customers SET
            first_name = ?, last_name = ?, email = ?, phone = ?, address = ?,
            type = ?, status = ?, last_edit = ?, change_log = ?
          WHERE id = ?`,
          [
            updates.first_name,
            updates.last_name,
            updates.email,
            updates.phone,
            updates.address,
            updates.type,
            updates.status,
            updates.last_edit,
            JSON.stringify(log),
            data.id,
          ],
          (err2) => {
            if (err2) reject(err2);
            else resolve({ success: true });
          }
        );
      });
    });
  },

  // 📥 Import from CSV
  importCustomers: async (rows) => {
    let imported = 0, updated = 0, skipped = 0;

    for (const row of rows) {
      const [id, firstName, lastName, email, phone, address] = row;

      if (!firstName || !phone || !address) {
        skipped++;
        continue;
      }

      let cid = id;
      if (!/^C-\d{8}-\d{4}$/.test(cid)) {
        cid = await generateCustomerId();
      }

      await new Promise((res) => {
        db.get(`SELECT id FROM customers WHERE id = ?`, [cid], (err, found) => {
          if (found) {
            CustomerRoutes.updateCustomer({
              id: cid,
              first_name: firstName,
              last_name,
              email,
              phone,
              address,
              type: "Regular",
              status: "Active",
            }).then(() => {
              updated++;
              res();
            });
          } else {
            db.run(
              `INSERT INTO customers (
                id, first_name, last_name, email, phone, address, type, status, date_joined
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                cid,
                firstName,
                lastName || "",
                email || "",
                phone,
                address,
                "Regular",
                "Active",
                dayjs().format("YYYY-MM-DD HH:mm:ss"),
              ],
              (err2) => {
                if (!err2) imported++;
                res();
              }
            );
          }
        });
      });
    }

    return { success: true, imported, updated, skipped };
  },

  // 📤 Export to CSV
  exportCustomers: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM customers ORDER BY date_joined DESC`, [], (err, rows) => {
        if (err) return reject(err);

        const headers = [
          "Customer ID", "First Name", "Last Name", "Email",
          "Phone", "Address", "Type", "Status", "Date Joined"
        ];

        const data = rows.map((r) => [
          r.id, r.first_name, r.last_name, r.email,
          r.phone, r.address, r.type, r.status, r.date_joined,
        ]);

        const csv = stringify([headers, ...data]);
        const filename = `customers_export_${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
        const filepath = path.join(__dirname, "../exports", filename);

        if (!fs.existsSync(path.dirname(filepath))) {
          fs.mkdirSync(path.dirname(filepath));
        }

        fs.writeFileSync(filepath, csv);
        resolve({ success: true, path: filepath, filename });
      });
    });
  },

  // 🔍 Fetch All (with Filters)
  getAllCustomers: (filters = {}) => {
    return new Promise((resolve, reject) => {
      const { search, mode, type = [], status = [] } = filters;
      let query = `SELECT * FROM customers WHERE 1=1`;
      const params = [];

      if (search && mode) {
        const like = `%${search}%`;
        if (mode === "Any") {
          query += ` AND (id LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR address LIKE ?)`;
          params.push(like, like, like, like, like);
        } else if (mode === "Customer ID") {
          query += ` AND id LIKE ?`;
          params.push(like);
        } else if (mode === "Name") {
          query += ` AND (first_name LIKE ? OR last_name LIKE ?)`;
          params.push(like, like);
        } else if (mode === "Mobile") {
          query += ` AND phone LIKE ?`;
          params.push(like);
        } else if (mode === "Address") {
          query += ` AND address LIKE ?`;
          params.push(like);
        }
      }

      if (type.length) {
        query += ` AND type IN (${type.map(() => "?").join(",")})`;
        params.push(...type);
      }

      if (status.length) {
        query += ` AND status IN (${status.map(() => "?").join(",")})`;
        params.push(...status);
      }

      query += ` ORDER BY date_joined DESC`;

      db.all(query, params, (err2, rows) => {
        if (err2) reject(err2);
        else resolve(rows);
      });
    });
  },

  // 📝 Change Log
  getCustomerLog: (id) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT change_log FROM customers WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return resolve([]);
        resolve(JSON.parse(row.change_log || "[]"));
      });
    });
  },
};

module.exports = CustomerRoutes;
