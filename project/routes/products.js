// Delete product (and related sale_items, sales if needed)
const db = require('../database');
const QRCode = require('qrcode');
const express = require('express');
const router = express.Router();
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
  if (!category || !name || !supplier || !cost_price || !margin_percent || !margin_rs || !selling_price || !sizes) {
    return res.status(400).send('Missing required fields');
  }

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
      // sizes is an object: { 0: {size: 'S', stock: 10}, 1: {size: 'M', stock: 5}, ... }
      const sizeEntries = Array.isArray(sizes) ? sizes : Object.values(sizes);
      const insertVariant = (variant, cb) => {
        db.run(
          `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`,
          [productId, variant.size, variant.stock],
          cb
        );
      };
      let completed = 0;
      for (let i = 0; i < sizeEntries.length; i++) {
        const variant = sizeEntries[i];
        if (!variant.size || variant.stock === undefined) continue;
        insertVariant(variant, (err) => {
          if (err) console.error('Error saving variant:', err);
          completed++;
          if (completed === sizeEntries.length) {
            res.redirect('/products');
          }
        });
      }
      if (sizeEntries.length === 0) res.redirect('/products');
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
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.render('products/edit', { product });
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

  if (!category || !name || !supplier || !cost_price || !margin_percent || !margin_rs || !selling_price || !sizes) {
    return res.status(400).send('Missing required fields');
  }

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