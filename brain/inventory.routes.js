// File: brain/inventory.routes.js
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

// Initialize tables and migrate status column if needed
// Initialize tables and migrate status column if needed
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS item_groups (
    id TEXT PRIMARY KEY CHECK(length(id) = 2),
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    stock INTEGER NOT NULL CHECK(stock >= 0),
    reorder_level INTEGER NOT NULL CHECK(reorder_level >= 0),
    barcode TEXT,
    status TEXT DEFAULT 'Active',
    FOREIGN KEY(group_id) REFERENCES item_groups(id)
  )`);

  // ✅ Safe migration: only add 'status' column if it doesn't exist
  db.all(`PRAGMA table_info(items)`, (err, columns) => {
    if (err) {
      console.error("Failed to inspect table columns:", err);
      return;
    }
    const hasStatus = columns.some(col => col.name === "status");
    if (!hasStatus) {
      db.run(`ALTER TABLE items ADD COLUMN status TEXT DEFAULT 'Active'`);
    }
  });
});


const InventoryRoutes = {
  // GROUPS
  getItemGroups: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM item_groups ORDER BY id ASC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  addGroup: ({ id, name }) => {
    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO item_groups (id, name) VALUES (?, ?)`, [id, name], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  updateGroup: ({ id, name }) => {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE item_groups SET name = ? WHERE id = ?`, [name, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  deleteGroup: (id) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) AS total FROM items WHERE group_id = ?`, [id], (err, row) => {
        if (err) return reject(err);
        if (row.total > 0) return reject(new Error("Group has items. Cannot delete."));

        db.run(`DELETE FROM item_groups WHERE id = ?`, [id], (err2) => {
          if (err2) reject(err2);
          else resolve();
        });
      });
    });
  },

  // ITEMS
  getItems: ({ search = "", group = "All", status = "All" }) => {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT i.*, g.name AS group_name
        FROM items i
        LEFT JOIN item_groups g ON i.group_id = g.id
        WHERE 1=1`;
      const params = [];

      if (search) {
        query += ` AND (i.id LIKE ? OR i.name LIKE ? OR COALESCE(i.barcode, '') LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (group && group !== "All") {
        query += ` AND i.group_id = ?`;
        params.push(group);
      }

      if (status && status !== "All") {
        query += ` AND i.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY i.id ASC`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  addItem: (data) => {
    return new Promise((resolve, reject) => {
      InventoryRoutes.getNextItemId(data.group_id).then((newId) => {
        const stmt = db.prepare(`
          INSERT INTO items (
            id, group_id, name, description,
            unit_price, stock, reorder_level, barcode, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          newId,
          data.group_id,
          data.name,
          data.description || null,
          data.unit_price,
          data.stock,
          data.reorder_level,
          data.barcode || null,
          "Active"
        ], (err) => {
          if (err) reject(err);
          else resolve(newId);
        });
        stmt.finalize();
      }).catch(reject);
    });
  },

  updateItem: (data) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        UPDATE items SET
          name = ?, description = ?, unit_price = ?, stock = ?,
          reorder_level = ?, barcode = ?, status = ?
        WHERE id = ?
      `);
      stmt.run([
        data.name,
        data.description || null,
        data.unit_price,
        data.stock,
        data.reorder_level,
        data.barcode || null,
        data.status,
        data.id
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  },

  deleteItem: (id) => {
    // Not used anymore as per request; soft-deletion via status = 'Archived'
    return Promise.resolve();
  },

  getNextItemId: (groupId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id FROM items WHERE group_id = ? ORDER BY id DESC LIMIT 1`,
        [groupId],
        (err, row) => {
          if (err) return reject(err);
          const last = row?.id?.slice(2) || "0000";
          const next = (parseInt(last) + 1).toString().padStart(4, "0");
          resolve(`${groupId}${next}`);
        }
      );
    });
  },

  importItems: async (rows) => {
    let added = 0, skipped = 0, failed = 0;

    for (const row of rows) {
      try {
        const groupId = row["Item Group ID"];
        const name = row["Item Name"];
        const price = parseFloat(row["Unit Price"]);
        const stock = parseInt(row["Current Stock"]);
        const reorder = parseInt(row["Reorder Level"]);

        if (!groupId || !name || isNaN(price) || isNaN(stock) || isNaN(reorder)) {
          failed++;
          continue;
        }

        // Create group if not exists
        await new Promise((res, rej) => {
          db.run(`INSERT OR IGNORE INTO item_groups (id, name) VALUES (?, ?)`, [groupId, "Unnamed"], (err) => {
            if (err) rej(err);
            else res();
          });
        });

        // Check duplicates
        const duplicate = await new Promise((res, rej) => {
          db.get(
            `SELECT * FROM items WHERE group_id = ? AND name = ? AND (barcode = ? OR barcode IS NULL)`,
            [groupId, name, row["Barcode"] || null],
            (err, existing) => {
              if (err) rej(err);
              else res(existing);
            }
          );
        });

        if (duplicate) {
          skipped++;
          continue;
        }

        await InventoryRoutes.addItem({
          group_id: groupId,
          name,
          description: row["Description"] || null,
          unit_price: price,
          stock,
          reorder_level: reorder,
          barcode: row["Barcode"] || null
        });

        added++;
      } catch {
        failed++;
      }
    }

    return { added, skipped, failed };
  },

  exportItems: () => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT
          i.id AS "Item ID",
          i.name AS "Item Name",
          i.description AS "Description",
          i.unit_price AS "Unit Price",
          i.stock AS "Current Stock",
          i.reorder_level AS "Reorder Level",
          i.barcode AS "Barcode",
          g.name || ' (' || g.id || ')' AS "Item Group",
          i.status AS "Status"
        FROM items i
        LEFT JOIN item_groups g ON i.group_id = g.id
        ORDER BY i.id ASC
      `, [], (err, rows) => {
        if (err) return reject(err);
        const csv = stringify(rows, { header: true });
        resolve(csv);
      });
    });
  }
};

module.exports = InventoryRoutes;
