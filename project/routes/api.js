const express = require('express');
const router = express.Router();
const db = require('../database');
const QRCode = require('qrcode');

// Get all products (JSON) – with cache prevention
router.get('/products', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  db.all('SELECT * FROM products', [], (err, products) => {
    if (err) {
      console.error('Database error in /api/products:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (products.length === 0) return res.json([]);

    const productIds = products.map(p => p.id);
    db.all(`SELECT * FROM product_variants WHERE product_id IN (${productIds.map(() => '?').join(',')})`, productIds, (err2, variants) => {
      if (err2) {
        console.error('Error fetching variants:', err2);
        return res.status(500).json({ error: 'Database error' });
      }

      const variantsByProduct = {};
      variants.forEach(v => {
        if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
        variantsByProduct[v.product_id].push({ size: v.size, stock: v.stock });
      });

      const result = products.map(p => ({
        ...p,
        has_sizes: p.has_sizes,
        variants: variantsByProduct[p.id] || []
      }));
      res.json(result);
    });
  });
});

// Get product by ID (JSON) – lookup by id or product_code
router.get('/products/:id', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const idOrCode = req.params.id;

  db.get('SELECT * FROM products WHERE id = ?', [idOrCode], (err, product) => {
    if (err) {
      console.error('Database error in /api/products/:id:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (product) {
      db.all('SELECT size, stock FROM product_variants WHERE product_id = ?', [product.id], (err2, variants) => {
        if (err2) {
          console.error('Error fetching variants:', err2);
          return res.status(500).json({ error: 'Database error' });
        }
        product.variants = variants;
        product.has_sizes = product.has_sizes;
        res.json(product);
      });
      return;
    }

    // Not found by id, try product_code
    db.get('SELECT * FROM products WHERE product_code = ?', [idOrCode], (err2, product2) => {
      if (err2) {
        console.error('Database error in /api/products/:product_code:', err2);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!product2) {
        return res.status(404).json({ error: 'Product not found' });
      }
      db.all('SELECT size, stock FROM product_variants WHERE product_id = ?', [product2.id], (err3, variants2) => {
        if (err3) {
          console.error('Error fetching variants:', err3);
          return res.status(500).json({ error: 'Database error' });
        }
        product2.variants = variants2;
        res.json(product2);
      });
    });
  });
});

// Serve QR code image
router.get('/qr/:code', (req, res) => {
  const code = req.params.code;
  QRCode.toDataURL(code, (err, url) => {
    if (err) {
      console.error('QR generation error:', err);
      return res.status(500).send('QR error');
    }
    const base64Data = url.replace(/^data:image\/png;base64,/, '');
    const img = Buffer.from(base64Data, 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length
    });
    res.end(img);
  });
});

module.exports = router;