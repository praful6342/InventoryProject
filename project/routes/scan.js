const express = require('express');
const router = express.Router();


// GET /scan - show the scanner page
router.get('/', (req, res) => {
  res.render('scan', { title: 'Scan QR Code' });
});

// POST /scan/scan-product - handle QR scan and update session cart
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

  // Initialize cart in session if not present
  if (!req.session.scannedCart) {
    req.session.scannedCart = {};
  }

  // If product already in cart, increment quantity, else add with quantity 1
  if (req.session.scannedCart[product_code]) {
    req.session.scannedCart[product_code].quantity += 1;
  } else {
    req.session.scannedCart[product_code] = { quantity: 1 };
  }

  // Return the updated cart
  res.json({ cart: req.session.scannedCart });
});

module.exports = router;