const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // Single query to get today's quantities, profit, and total sales amount
  db.get(
    `SELECT
    (SELECT COALESCE(SUM(si.quantity), 0)
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    WHERE DATE(s.created_at, 'localtime') = ?) AS qtySold,
         (SELECT COALESCE(SUM(s.profit), 0)
         FROM sales s
         WHERE DATE(s.created_at, 'localtime') = ?) AS profit,
         (SELECT COALESCE(SUM(s.total_amount), 0)
         FROM sales s
         WHERE DATE(s.created_at, 'localtime') = ?) AS totalSales
         `,
         [todayStr, todayStr, todayStr],
         (err, salesRow) => {
           if (err) {
             console.error(err);
             return res.status(500).send('Error fetching sales data');
           }

           // Current total stock (sum of all variant stocks)
           db.get(
             `SELECT COALESCE(SUM(stock), 0) AS stock FROM product_variants`,
                  [],
                  (err2, stockRow) => {
                    if (err2) {
                      console.error(err2);
                      return res.status(500).send('Error fetching stock data');
                    }

                    // Total inventory value at cost and selling price
                    db.all(
                      `SELECT p.cost_price, p.selling_price, pv.stock
                      FROM products p
                      JOIN product_variants pv ON p.id = pv.product_id`,
                      [],
                      (err3, rows) => {
                        if (err3) {
                          console.error(err3);
                          return res.status(500).send('Error fetching product data');
                        }

                        let totalCost = 0,
                        totalSelling = 0;
                        rows.forEach((row) => {
                          totalCost += row.cost_price * row.stock;
                          totalSelling += row.selling_price * row.stock;
                        });

                        res.render('dashboard', {
                          qtySold: salesRow.qtySold,
                          profit: salesRow.profit.toFixed(2),
                                   totalSales: salesRow.totalSales.toFixed(2), // new
                                   stock: stockRow.stock,
                                   totalCost: totalCost.toFixed(2),
                                   totalSelling: totalSelling.toFixed(2),
                        });
                      }
                    );
                  }
           );
         }
  );
});

module.exports = router;
