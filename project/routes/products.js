const express = require('express');
const router = express.Router();
const db = require('../database');
const QRCode = require('qrcode');

// List products (server‑side rendered page)
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
  res.render('add');
});

// Add product (with variants)
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

      // Handle sizes (may be array or object)
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
      const total = sizeEntries.filter(v => v && v.size && v.stock !== undefined).length;
      if (total === 0) return res.redirect('/products');

      sizeEntries.forEach(variant => {
        if (!variant || !variant.size || variant.stock === undefined) {
          completed++;
          if (completed === total) res.redirect('/products');
          return;
        }
        db.run(
          `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`,
          [productId, variant.size, variant.stock],
          (err) => {
            if (err) console.error('Error saving variant:', err);
            completed++;
            if (completed === total) res.redirect('/products');
          }
        );
      });
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
    QRCode.toDataURL(product.qr_code, (err, url) => {
      if (err) {
        console.error(err);
        return res.status(500).send('QR generation error');
      }
      res.render('show', { product, qrCodeUrl: url });
    });
  });
});

// Show edit product form
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
      const product = { ...productRow, variants: variants || [] };
      res.render('edit', { product });
    });
  });
});

// Update product
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

  const productCode = `${category}_${name}_${supplier}`.replace(/\s+/g, '').toUpperCase();

  db.run(
    `UPDATE products SET product_code = ?, category = ?, name = ?, supplier = ?, cost_price = ?, margin_percent = ?, margin_rs = ?, selling_price = ?, qr_code = ? WHERE id = ?`,
    [productCode, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price, productCode, id],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error updating product');
      }

      // Delete old variants
      db.run('DELETE FROM product_variants WHERE product_id = ?', [id], function(err2) {
        if (err2) {
          console.error('Error deleting old variants:', err2);
          return res.status(500).send('Error updating variants');
        }

        // Insert new variants
        let sizeEntries = [];
        if (Array.isArray(sizes)) {
          sizeEntries = sizes;
        } else if (sizes && typeof sizes === 'object') {
          sizeEntries = Object.values(sizes);
        }

        if (!sizeEntries || sizeEntries.length === 0) {
          return res.redirect('/products/' + id);
        }

        let completed = 0;
        const total = sizeEntries.filter(v => v && v.size && v.stock !== undefined).length;
        if (total === 0) return res.redirect('/products/' + id);

        sizeEntries.forEach(variant => {
          if (!variant || !variant.size || variant.stock === undefined) {
            completed++;
            if (completed === total) res.redirect('/products/' + id);
            return;
          }
          db.run(
            `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`,
            [id, variant.size, variant.stock],
            function(err3) {
              if (err3) console.error('Error saving variant:', err3);
              completed++;
              if (completed === total) res.redirect('/products/' + id);
            }
          );
        });
      });
    }
  );
});

// Delete product (with cleanup of related records)
router.post('/delete/:id', (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM sale_items WHERE product_id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting sale_items:', err);
      return res.status(500).send('Error deleting sale items');
    }

    // Delete orphaned sales (no sale_items left)
    db.run('DELETE FROM sales WHERE id IN (SELECT s.id FROM sales s LEFT JOIN sale_items si ON s.id = si.sale_id WHERE si.id IS NULL)', [], function(err) {
      if (err) {
        console.error('Error cleaning up sales:', err);
        return res.status(500).send('Error cleaning up sales');
      }

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

// Bulk delete products (with real‑time update)
router.post('/bulk-delete', (req, res) => {
  let ids = req.body.productIds;
  if (!ids) return res.redirect('/products');
  if (!Array.isArray(ids)) ids = [ids];

  const placeholders = ids.map(() => '?').join(',');

  db.serialize(() => {
    db.run(`DELETE FROM sale_items WHERE product_id IN (${placeholders})`, ids, function(err) {
      if (err) {
        console.error('Error deleting sale_items:', err);
        return res.status(500).send('Error deleting sale items');
      }
    });

    db.run(`DELETE FROM product_variants WHERE product_id IN (${placeholders})`, ids, function(err2) {
      if (err2) {
        console.error('Error deleting variants:', err2);
        return res.status(500).send('Error deleting variants');
      }
    });

    db.run(`DELETE FROM products WHERE id IN (${placeholders})`, ids, function(err3) {
      if (err3) {
        console.error('Error deleting products:', err3);
        return res.status(500).send('Error deleting products');
      }

      // Emit real‑time update
      if (req.app.locals.socketApi) {
        req.app.locals.socketApi.emitProductUpdate();
      }

      res.redirect('/products');
    });
  });
});

module.exports = router;