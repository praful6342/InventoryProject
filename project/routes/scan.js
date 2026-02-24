const express = require('express');
const router = express.Router();

// GET /scan - show the scanner page
router.get('/', (req, res) => {
  res.render('scan', { title: 'Scan QR Code' });
});

module.exports = router;