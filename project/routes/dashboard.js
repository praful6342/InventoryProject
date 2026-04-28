const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper to generate SQL date condition based on range or custom dates/month
function getDateCondition(req) {
  const { start_date, end_date, month_year, range } = req.query;
  const effectiveDate = "COALESCE(s.sale_date, DATE(s.created_at, 'localtime'))";

  if (start_date && end_date) {
    return `${effectiveDate} BETWEEN DATE('${start_date}') AND DATE('${end_date}')`;
  }

  if (month_year && /^\d{4}-\d{2}$/.test(month_year)) {
    const [year, month] = month_year.split('-');
    return `strftime('%Y', ${effectiveDate}) = '${year}' AND strftime('%m', ${effectiveDate}) = '${month}'`;
  }

  switch (range) {
    case 'today':
      return `${effectiveDate} = DATE('now', 'localtime')`;
    case 'week':
      return `strftime('%W', ${effectiveDate}) = strftime('%W', 'now', 'localtime') AND strftime('%Y', ${effectiveDate}) = strftime('%Y', 'now', 'localtime')`;
    case 'month':
      return `strftime('%Y-%m', ${effectiveDate}) = strftime('%Y-%m', 'now', 'localtime')`;
    case 'all':
      return "1=1";
    default:
      return `${effectiveDate} = DATE('now', 'localtime')`;
  }
}

// Helper to get chart data (daily totals) for the given date condition
async function getChartData(dateCondition) {
  const effectiveDate = "COALESCE(s.sale_date, DATE(s.created_at, 'localtime'))";
  const query = `
  SELECT ${effectiveDate} as date,
  COALESCE(SUM(s.total_amount), 0) as total
  FROM sales s
  WHERE ${dateCondition}
  GROUP BY ${effectiveDate}
  ORDER BY date ASC
  `;
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const labels = rows.map(row => row.date);
        const values = rows.map(row => row.total);
        resolve({ labels, values });
      }
    });
  });
}

// Helper to get payment method breakdown from sale_payments table
async function getPaymentBreakdown(dateCondition) {
  // Join sale_payments with sales, apply date condition, group by payment_method
  const query = `
  SELECT sp.payment_method, COALESCE(SUM(sp.amount), 0) as total
  FROM sale_payments sp
  JOIN sales s ON sp.sale_id = s.id
  WHERE ${dateCondition}
  GROUP BY sp.payment_method
  ORDER BY total DESC
  `;
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

router.get('/', async (req, res) => {
  const dateCondition = getDateCondition(req);

  try {
    // Sales metrics (total quantities, profit, total sales) – include all sales (positive and negative)
    const salesMetrics = await new Promise((resolve, reject) => {
      db.get(
        `SELECT
        (SELECT COALESCE(SUM(si.quantity), 0)
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        WHERE ${dateCondition}) AS qtySold,
        (SELECT COALESCE(SUM(s.profit), 0)
        FROM sales s
        WHERE ${dateCondition}) AS profit,
        (SELECT COALESCE(SUM(s.total_amount), 0)
        FROM sales s
        WHERE ${dateCondition}) AS totalSales`,
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    // Payment method breakdown (from sale_payments)
    const paymentBreakdown = await getPaymentBreakdown(dateCondition);

    // Stock & inventory values (global, independent of date)
    const stockRow = await new Promise((resolve, reject) => {
      db.get('SELECT COALESCE(SUM(stock), 0) AS stock FROM product_variants', (err, row) => err ? reject(err) : resolve(row));
    });
    const productRows = await new Promise((resolve, reject) => {
      db.all('SELECT p.cost_price, p.selling_price, pv.stock FROM products p JOIN product_variants pv ON p.id = pv.product_id', (err, rows) => err ? reject(err) : resolve(rows));
    });

    let totalCost = 0, totalSelling = 0;
    productRows.forEach(row => {
      totalCost += row.cost_price * row.stock;
      totalSelling += row.selling_price * row.stock;
    });

    // Chart data
    const chartData = await getChartData(dateCondition);

    const data = {
      qtySold: salesMetrics.qtySold,
      profit: salesMetrics.profit.toFixed(2),
           totalSales: salesMetrics.totalSales.toFixed(2),
           stock: stockRow.stock,
           totalCost: totalCost.toFixed(2),
           totalSelling: totalSelling.toFixed(2),
           chartLabels: chartData.labels,
           chartValues: chartData.values,
           paymentBreakdown: paymentBreakdown
    };

    // If AJAX request, return JSON; otherwise render the page
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      res.json(data);
    } else {
      res.render('dashboard', {
        ...data,
        start_date: req.query.start_date || '',
        end_date: req.query.end_date || '',
        month_year: req.query.month_year || '',
        range: req.query.range || 'today'
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching dashboard data');
  }
});

module.exports = router;
