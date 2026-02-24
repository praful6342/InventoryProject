const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all products (JSON) – with cache prevention
router.get('/products', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  db.all('SELECT id, name, selling_price, cost_price, stock FROM products', [], (err, rows) => {
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
  const id = req.params.id;
  db.get('SELECT id, name, selling_price, cost_price, stock FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      console.error('Database error in /api/products/:id:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  });
});

module.exports = router;