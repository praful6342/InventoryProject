const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /bill/:id - display bill
router.get('/:id', (req, res) => {
  const saleId = req.params.id;

  // Fetch sale details with customer and items
  db.get(`
  SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  WHERE s.id = ?
  `, [saleId], (err, sale) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!sale) {
      return res.status(404).send('Bill not found');
    }

    // Fetch items for this sale with product details
    db.all(`
    SELECT si.*, p.name as product_name
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
    `, [saleId], (err, items) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }

      res.render('bill', { sale, items });
    });
  });
});

module.exports = router;
