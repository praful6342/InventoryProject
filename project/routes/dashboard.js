const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /dashboard - show today's sales, profit, and current stock
router.get('/', (req, res) => {
  // Get today's date in YYYY-MM-DD
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // Query for today's total quantity sold and profit
  db.get(
    `SELECT COALESCE(SUM(si.quantity), 0) AS qtySold, COALESCE(SUM(s.profit), 0) AS profit
     FROM sales s
     JOIN sale_items si ON s.id = si.sale_id
     WHERE DATE(s.created_at) = ?`,
    [todayStr],
    (err, salesRow) => {
      if (err) return res.status(500).send('Error fetching sales data');
      // Query for current stock (sum of all variants)
      db.get(
        `SELECT COALESCE(SUM(stock), 0) AS stock FROM product_variants`,
        [],
        (err2, stockRow) => {
          if (err2) return res.status(500).send('Error fetching stock data');
          res.render('dashboard', {
            qtySold: salesRow.qtySold,
            profit: salesRow.profit.toFixed(2),
            stock: stockRow.stock
          });
        }
      );
    }
  );
});

module.exports = router;
