const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
    db.run("PRAGMA foreign_keys = ON;");
  }
});

// ----- Column additions (safe migrations) -----

// Products: has_sizes and created_at
db.all("PRAGMA table_info(products)", (err, columns) => {
  if (err) {
    console.error("Error checking products schema:", err);
    return;
  }

  const hasHasSizes = columns.some(col => col.name === 'has_sizes');
  if (!hasHasSizes) {
    db.run("ALTER TABLE products ADD COLUMN has_sizes INTEGER DEFAULT 1", (err) => {
      if (err) console.error("Failed to add has_sizes column:", err);
      else console.log("Added has_sizes column to products");
    });
  }

  const hasCreatedAt = columns.some(col => col.name === 'created_at');
  if (!hasCreatedAt) {
    db.run("ALTER TABLE products ADD COLUMN created_at DATETIME", (err) => {
      if (err) {
        console.error("Failed to add created_at column:", err);
      } else {
        console.log("Added created_at column to products");
        db.run("UPDATE products SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL", (err2) => {
          if (err2) console.error("Failed to set initial created_at:", err2);
          else console.log("Set initial created_at for existing products");
        });
      }
    });
  }
});

// Sales: discount columns, sale_date, payment_method, returned
db.all("PRAGMA table_info(sales)", (err, columns) => {
  if (err) {
    console.error("Error checking sales schema:", err);
    return;
  }

  const hasDiscountType = columns.some(col => col.name === 'discount_type');
  const hasDiscountValue = columns.some(col => col.name === 'discount_value');
  const hasDiscountAmount = columns.some(col => col.name === 'discount_amount');

  if (!hasDiscountType) {
    db.run("ALTER TABLE sales ADD COLUMN discount_type TEXT", (err) => {
      if (err) console.error("Failed to add discount_type column:", err);
      else console.log("Added discount_type column to sales");
    });
  }
  if (!hasDiscountValue) {
    db.run("ALTER TABLE sales ADD COLUMN discount_value REAL", (err) => {
      if (err) console.error("Failed to add discount_value column:", err);
      else console.log("Added discount_value column to sales");
    });
  }
  if (!hasDiscountAmount) {
    db.run("ALTER TABLE sales ADD COLUMN discount_amount REAL DEFAULT 0", (err) => {
      if (err) console.error("Failed to add discount_amount column:", err);
      else console.log("Added discount_amount column to sales");
    });
  }

  const hasSaleDate = columns.some(col => col.name === 'sale_date');
  if (!hasSaleDate) {
    db.run("ALTER TABLE sales ADD COLUMN sale_date TEXT", (err) => {
      if (err) console.error("Failed to add sale_date column:", err);
      else console.log("Added sale_date column to sales");
    });
  }

  const hasPaymentMethod = columns.some(col => col.name === 'payment_method');
  if (!hasPaymentMethod) {
    db.run("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'Cash'", (err) => {
      if (err) console.error("Failed to add payment_method column:", err);
      else console.log("Added payment_method column to sales");
    });
  }

  const hasReturned = columns.some(col => col.name === 'returned');
  if (!hasReturned) {
    db.run("ALTER TABLE sales ADD COLUMN returned INTEGER DEFAULT 0", (err) => {
      if (err) console.error("Failed to add returned column:", err);
      else console.log("Added returned column to sales");
    });
  }
});

// sale_items: size column
db.all("PRAGMA table_info(sale_items)", (err, columns) => {
  if (err) {
    console.error("Error checking sale_items schema:", err);
    return;
  }
  const hasSize = columns.some(col => col.name === 'size');
  if (!hasSize) {
    db.run("ALTER TABLE sale_items ADD COLUMN size TEXT", (err) => {
      if (err) console.error("Failed to add size column to sale_items:", err);
      else console.log("Added size column to sale_items");
    });
  }
});

// Initialize tables
db.serialize(() => {
  db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    supplier TEXT NOT NULL,
    cost_price REAL NOT NULL,
    margin_percent REAL NOT NULL,
    margin_rs REAL NOT NULL,
    selling_price REAL NOT NULL,
    qr_code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    size TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT
  )
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    total_amount REAL NOT NULL,
    profit REAL NOT NULL,
    bill_number TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    discount_type TEXT,
    discount_value REAL,
    discount_amount REAL DEFAULT 0,
    sale_date TEXT,
    payment_method TEXT DEFAULT 'Cash',
    returned INTEGER DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_sale REAL NOT NULL,
    profit_on_item REAL NOT NULL,
    size TEXT,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
                                         FOREIGN KEY (product_id) REFERENCES products(id)
  )
  `);
});

module.exports = db;
