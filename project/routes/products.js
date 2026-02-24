const express = require('express');
const router = express.Router();
const db = require('../database');
const QRCode = require('qrcode');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });

// Show CSV upload form
router.get('/upload-csv', (req, res) => {
  res.render('products/upload_csv');
});

// Handle CSV upload and import
router.post('/upload-csv', upload.single('csvfile'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // Example: CSV columns should match your DB fields, e.g. name, category, supplier, size, stock
      const dbOps = results.map(row => {
        return new Promise((resolve, reject) => {
          const code = (row.category + '_' + row.name + '_' + row.supplier).replace(/\s+/g, '').toUpperCase();
          // Always try to find product by qr_code or product_code
          db.get('SELECT id FROM products WHERE qr_code = ? OR product_code = ?', [code, code], (err, product) => {
            if (err) return reject(err);
            const insertOrUpdateVariant = (productId) => {
              if (row.size) {
                db.run('INSERT OR REPLACE INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)', [productId, row.size, row.stock], err2 => {
                  if (err2) return reject(err2);
                  resolve();
                });
              } else {
                // No size, do not insert/update variant
                resolve();
              }
            };
            if (product) {
              // Product exists, just insert/update variant if needed
              insertOrUpdateVariant(product.id);
            } else {
              // Insert product, then variant if size is present
              db.run('INSERT INTO products (product_code, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price, qr_code) VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?)', [code, row.category, row.name, row.supplier, code], function(err3) {
                if (err3) return reject(err3);
                const newId = this.lastID;
                insertOrUpdateVariant(newId);
              });
            }
          });
        });
      });
      Promise.all(dbOps)
        .then(() => {
          fs.unlinkSync(req.file.path);
          res.redirect('/products');
        })
        .catch(e => {
          fs.unlinkSync(req.file.path);
          res.status(500).send('Error importing CSV: ' + e.message);
        });
    });
});
router.post('/delete/:id', (req, res) => {
  const id = req.params.id;
  // First, delete sale_items referencing this product
  db.run('DELETE FROM sale_items WHERE product_id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting sale_items:', err);
      return res.status(500).send('Error deleting sale items');
    }
    // Optionally, delete sales with no sale_items left (cleanup)
    db.run('DELETE FROM sales WHERE id IN (SELECT s.id FROM sales s LEFT JOIN sale_items si ON s.id = si.sale_id WHERE si.id IS NULL)', [], function(err) {
      if (err) {
        console.error('Error cleaning up sales:', err);
        return res.status(500).send('Error cleaning up sales');
      }
      // Now delete the product
      db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting product:', err);
          return res.status(500).send('Error deleting product');
        }
        res.redirect('/products');
      });
    });
  });
});


// List products
router.get('/', (req, res) => {
  db.all('SELECT * FROM products', [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.render('products/index', { products: rows });
  });
});

// Show add product form
router.get('/add', (req, res) => {
  res.render('products/add');
});

// Add product
router.post('/add', (req, res) => {
  const {
    category,
    name,
    supplier,
    cost_price,
    margin_percent,
    margin_rs,
    selling_price,
    sizes
  } = req.body;
  // No required field checks; allow null/empty values

  // Generate product_code and qr_code: category + name + supplier (all uppercase, no spaces)
  const productCode = `${category}_${name}_${supplier}`.replace(/\s+/g, '').toUpperCase();

  db.run(
    `INSERT INTO products (product_code, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [productCode, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price, productCode],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error saving product');
      }
      const productId = this.lastID;
      // Ensure sizes is always an array
      let sizeEntries = [];
      if (Array.isArray(sizes)) {
        sizeEntries = sizes;
      } else if (sizes && typeof sizes === 'object') {
        sizeEntries = Object.values(sizes);
      }
      if (!sizeEntries || sizeEntries.length === 0) {
        return res.redirect('/products');
      }
      let completed = 0;
      let started = 0;
      for (let i = 0; i < sizeEntries.length; i++) {
        const variant = sizeEntries[i];
        if (!variant || !variant.size || variant.stock === undefined) continue;
        started++;
        db.run(
          `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`,
          [productId, variant.size, variant.stock],
          (err) => {
            if (err) console.error('Error saving variant:', err);
            completed++;
            if (completed === started) {
              res.redirect('/products');
            }
          }
        );
      }
      // If no valid variants were started, redirect immediately
      if (started === 0) res.redirect('/products');
    }
  );
});

// View single product (with QR code)
router.get('/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!product) {
      return res.status(404).send('Product not found');
    }
    // Generate QR code image as data URL using the new product ID string
    QRCode.toDataURL(product.qr_code, (err, url) => {
      if (err) {
        console.error(err);
        return res.status(500).send('QR generation error');
      }
      res.render('products/show', { product, qrCodeUrl: url });
    });
  });
});

// Show edit product form (NEW)
router.get('/edit/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, productRow) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!productRow) {
      return res.status(404).send('Product not found');
    }
    db.all('SELECT size, stock FROM product_variants WHERE product_id = ?', [id], (err2, variants) => {
      if (err2) {
        console.error(err2);
        return res.status(500).send('Database error');
      }
      // Create a plain object with all product fields and variants
      const product = { ...productRow, variants: variants || [] };
      res.render('products/edit', { product });
    });
  });
});

// Update product (NEW)
router.post('/update/:id', (req, res) => {
  const id = req.params.id;
  const {
    category,
    name,
    supplier,
    cost_price,
    margin_percent,
    margin_rs,
    selling_price,
    sizes
  } = req.body;

  // No required field checks; allow null/empty values

  // Regenerate product_code and qr_code
  const productCode = `${category}_${name}_${supplier}`.replace(/\s+/g, '').toUpperCase();

  db.run(
    `UPDATE products SET product_code = ?, category = ?, name = ?, supplier = ?, cost_price = ?, margin_percent = ?, margin_rs = ?, selling_price = ?, qr_code = ? WHERE id = ?`,
    [productCode, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price, productCode, id],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error updating product');
      }
      // Remove old variants and insert new ones
      db.run('DELETE FROM product_variants WHERE product_id = ?', [id], function(err2) {
        if (err2) {
          console.error('Error deleting old variants:', err2);
          return res.status(500).send('Error updating variants');
        }
        const sizeEntries = Array.isArray(sizes) ? sizes : Object.values(sizes);
        let completed = 0;
        if (sizeEntries.length === 0) return res.redirect('/products/' + id);
        sizeEntries.forEach(variant => {
          if (!variant.size || variant.stock === undefined) {
            completed++;
            if (completed === sizeEntries.length) res.redirect('/products/' + id);
            return;
          }
          db.run(
            `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`,
            [id, variant.size, variant.stock],
            function(err3) {
              if (err3) console.error('Error saving variant:', err3);
              completed++;
              if (completed === sizeEntries.length) res.redirect('/products/' + id);
            }
          );
        });
      });
    }
  );
});

module.exports = router;