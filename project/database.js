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
    // Enable foreign key constraints
    db.run("PRAGMA foreign_keys = ON;");
  }
});

// Check and add has_sizes column to products table
db.all("PRAGMA table_info(products)", (err, columns) => {
  if (err) {
    console.error("Error checking schema:", err);
    return;
  }
  const hasHasSizes = columns.some(col => col.name === 'has_sizes');
  if (!hasHasSizes) {
    db.run("ALTER TABLE products ADD COLUMN has_sizes INTEGER DEFAULT 1", (err) => {
      if (err) console.error("Failed to add has_sizes column:", err);
      else console.log("Added has_sizes column to products");
    });
  }
});

// Check and add discount columns to sales table
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
      qr_code TEXT UNIQUE
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
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
});

module.exports = db;