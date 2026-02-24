const express = require('express');
const router = express.Router();
const db = require('../database');
const QRCode = require('qrcode');

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
  const { name, cost_price, selling_price, stock } = req.body;
  if (!name || !cost_price || !selling_price || stock === undefined) {
    return res.status(400).send('Missing required fields');
  }

  db.run(
    `INSERT INTO products (name, cost_price, selling_price, stock) VALUES (?, ?, ?, ?)`,
    [name, cost_price, selling_price, stock],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error saving product');
      }
      const productId = this.lastID;
      // Store product ID as QR code text
      db.run('UPDATE products SET qr_code = ? WHERE id = ?', [productId.toString(), productId], (err) => {
        if (err) console.error('Error updating QR code:', err);
      });
      res.redirect('/products');
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
    // Generate QR code image as data URL
    QRCode.toDataURL(product.id.toString(), (err, url) => {
      if (err) {
        console.error(err);
    router.get('/dashboard', (req, res) => {
      const search = req.query.search || '';
      let sql = 'SELECT * FROM products';
      let params = [];
      if (search) {
        sql += ' WHERE name LIKE ? OR category LIKE ?';
        params = [`%${search}%`, `%${search}%`];
      }
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }
        res.render('products/dashboard', { products: rows });
      });
    });
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
  const { name, cost_price, selling_price, stock } = req.body;

  if (!name || !cost_price || !selling_price || stock === undefined) {
    return res.status(400).send('Missing required fields');
  }

  db.run(
    `UPDATE products SET name = ?, cost_price = ?, selling_price = ?, stock = ? WHERE id = ?`,
    [name, cost_price, selling_price, stock, id],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error updating product');
      }
      res.redirect('/products/' + id); // redirect to product detail page
    }
  );
});

module.exports = router;