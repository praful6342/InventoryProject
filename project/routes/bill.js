const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /bill/:id - display bill with split payment details
router.get('/:id', (req, res) => {
  const saleId = req.params.id;

  // Fetch sale details with customer info
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

      // Fetch all payments for this sale from sale_payments table
      db.all(`
      SELECT payment_method, amount, created_at
      FROM sale_payments
      WHERE sale_id = ?
      ORDER BY created_at ASC
      `, [saleId], (err, payments) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }

        // Compute total paid and change (if any)
        let totalPaid = 0;
        if (payments && payments.length) {
          totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        }
        const changeAmount = totalPaid - sale.total_amount;
        const isOverpaid = changeAmount > 0 && sale.total_amount >= 0; // only for positive sales

        // For return bills (total_amount negative), change doesn't apply
        const showChange = isOverpaid && sale.total_amount > 0;

        // Pass seller name if needed
        db.get('SELECT username FROM users WHERE id = ?', [sale.seller_id], (err, seller) => {
          if (err) console.error(err);
          const sellerName = seller ? seller.username : 'Unknown';

          // Also fetch original sale ID if this is a return (optional)
          let originalSaleId = null;
          if (sale.returned === 1 && sale.total_amount < 0) {
            // Try to find the original sale by looking for positive sale with same customer and similar amount? Not reliable.
            // We could store original_sale_id in sales table, but not implemented. Skip.
          }

          res.render('bill', {
            sale: {
              ...sale,
              seller_name: sellerName
            },
            items,
            payments: payments || [],
            totalPaid: totalPaid.toFixed(2),
                     changeAmount: showChange ? changeAmount.toFixed(2) : 0,
                     showChange
          });
        });
      });
    });
  });
});

module.exports = router;
