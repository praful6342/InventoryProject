const express = require('express');
const router = express.Router();

// GET /scan - show the scanner page
router.get('/', (req, res) => {
  res.render('scan', { title: 'Scan QR Code' });
});

// POST /scan/scan-product - handle QR scan
router.post('/scan-product', (req, res) => {
  let product_code = req.body && req.body.product_code;
  // Fallback: try to parse body if not already parsed
  if (!product_code && typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      product_code = parsed.product_code;
    } catch (e) {}
  }
  console.log('Received scan-product POST:', req.body, 'Parsed product_code:', product_code);
  if (!product_code) {
    return res.status(400).json({ error: 'Missing product_code', body: req.body });
  }

  const db = require('../database');

  // Check if the scanned code is a permanent QR (starts with "pid:")
  if (product_code.startsWith('pid:')) {
    const id = product_code.substring(4); // remove "pid:"
    db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
      if (err) {
        console.error('Database error in scan-product (pid):', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      db.all('SELECT size, stock FROM product_variants WHERE product_id = ?', [product.id], (err2, variants) => {
        if (err2) {
          console.error('Error fetching variants:', err2);
          return res.status(500).json({ error: 'Database error' });
        }
        product.variants = variants;
        res.json({ product });
      });
    });
  } else {
    // Legacy: lookup by product_code
    db.get('SELECT * FROM products WHERE product_code = ?', [product_code], (err, product) => {
      if (err) {
        console.error('Database error in scan-product (legacy):', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      db.all('SELECT size, stock FROM product_variants WHERE product_id = ?', [product.id], (err2, variants) => {
        if (err2) {
          console.error('Error fetching variants:', err2);
          return res.status(500).json({ error: 'Database error' });
        }
        product.variants = variants;
        res.json({ product });
      });
    });
  }
});

module.exports = router;