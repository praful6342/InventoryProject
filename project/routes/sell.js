const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper function to generate a unique bill number
function generateBillNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BILL-${yyyy}${mm}${dd}-${random}`;
}

// GET /sell - show sell form (optional product ID pre-filled)
router.get('/', (req, res) => {
  res.render('sell', { product: null, products: [], customer: null, error: 'Sales can only be completed by scanning the product QR code. Manual selection is disabled.' });
});

// POST /sell - process the sale
router.post('/', (req, res) => {
  res.status(403).send('Manual sales are disabled. Please use QR code scanning to sell items.');
});

module.exports = router;