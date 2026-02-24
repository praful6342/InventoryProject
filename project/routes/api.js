const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all products (JSON) – with cache prevention
router.get('/products', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  db.all('SELECT id, product_code, category, name, supplier, size, stock, cost_price, margin_percent, margin_rs, selling_price, qr_code FROM products', [], (err, rows) => {
    if (err) {
      console.error('Database error in /api/products:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get product by ID (JSON) – with cache prevention
router.get('/products/:id', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const idOrCode = req.params.id;
  // Try numeric ID lookup first
  db.get('SELECT id, product_code, category, name, supplier, size, stock, cost_price, margin_percent, margin_rs, selling_price, qr_code FROM products WHERE id = ?', [idOrCode], (err, product) => {
    if (err) {
      console.error('Database error in /api/products/:id:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (product) {
      return res.json(product);
    }
    // If not found by ID, try product_code
    db.get('SELECT id, product_code, category, name, supplier, size, stock, cost_price, margin_percent, margin_rs, selling_price, qr_code FROM products WHERE product_code = ?', [idOrCode], (err2, product2) => {
      if (err2) {
        console.error('Database error in /api/products/:product_code:', err2);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!product2) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(product2);
    });
  });
});

module.exports = router;