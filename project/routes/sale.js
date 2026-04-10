const express = require('express');
const router = express.Router();
const db = require('../database');

function generateBillNumber() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BILL-${yyyy}${mm}${dd}-${random}`;
}

// Cart display
router.get('/cart', (req, res) => {
  if (!req.session.cart) req.session.cart = [];
  res.render('cart', { cart: req.session.cart });
});

// Add item to cart (AJAX)
router.post('/add', (req, res) => {
  const { productId, size, quantity } = req.body;
  if (!productId || !size || !quantity || quantity < 1) {
    return res.status(400).json({ error: 'Invalid product, size, or quantity' });
  }

  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) return res.status(404).json({ error: 'Product not found' });

    db.get('SELECT stock FROM product_variants WHERE product_id = ? AND size = ?', [productId, size], (err2, variant) => {
      if (err2 || !variant) return res.status(404).json({ error: 'Size not available' });
      if (variant.stock < quantity) return res.status(400).json({ error: 'Insufficient stock for this size' });

      if (!req.session.cart) req.session.cart = [];

      const existingIndex = req.session.cart.findIndex(item => item.productId === productId && item.size === size);
      if (existingIndex !== -1) {
        const newQty = req.session.cart[existingIndex].quantity + quantity;
        if (newQty > variant.stock) return res.status(400).json({ error: 'Total quantity exceeds available stock' });
        req.session.cart[existingIndex].quantity = newQty;
      } else {
        req.session.cart.push({
          productId: product.id,
          size,
          quantity,
          name: product.name,
          product_code: product.product_code,
          selling_price: product.selling_price,
          maxStock: variant.stock
        });
      }
      res.json({ success: true, cart: req.session.cart });
    });
  });
});

// Update cart quantity (AJAX)
router.post('/update', (req, res) => {
  let { productId, size, quantity } = req.body;
  if (!productId || !size || quantity < 0) return res.status(400).json({ error: 'Invalid request' });
  productId = parseInt(productId, 10);

  if (!req.session.cart) req.session.cart = [];
  const itemIndex = req.session.cart.findIndex(item => item.productId === productId && item.size === size);
  if (itemIndex === -1) return res.status(404).json({ error: 'Item not in cart' });

  if (quantity === 0) {
    req.session.cart.splice(itemIndex, 1);
    return res.json({ success: true, cart: req.session.cart });
  }

  db.get('SELECT stock FROM product_variants WHERE product_id = ? AND size = ?', [productId, size], (err, variant) => {
    if (err || !variant) return res.status(500).json({ error: 'Stock check failed' });
    if (variant.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });
    req.session.cart[itemIndex].quantity = quantity;
    res.json({ success: true, cart: req.session.cart });
  });
});

// Checkout page
router.get('/checkout', (req, res) => {
  if (!req.session.cart || req.session.cart.length === 0) return res.redirect('/sale/cart');
  const total = req.session.cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  res.render('checkout', { cart: req.session.cart, total });
});

// Process sale
router.post('/checkout', (req, res) => {
  const { customerName, customerPhone, customerEmail, discount_type, discount_value, sale_date, payment_method } = req.body;
  const cart = req.session.cart;
  if (!cart || cart.length === 0) return res.redirect('/sale/cart');

  const preDiscountTotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    let customerId = null;
    const finalize = () => {
      const billNumber = generateBillNumber();
      let profitTotal = 0;
      let itemsProcessed = 0;
      const items = [];

      cart.forEach(item => {
        db.get('SELECT cost_price FROM products WHERE id = ?', [item.productId], (err, product) => {
          if (err) { db.run('ROLLBACK'); return res.status(500).send('Error fetching product cost'); }
          const profitOnItem = (item.selling_price - product.cost_price) * item.quantity;
          profitTotal += profitOnItem;
          items.push({
            product_id: item.productId,
            size: item.size,
            quantity: item.quantity,
            price_at_sale: item.selling_price,
            profit_on_item: profitOnItem
          });

          if (++itemsProcessed === cart.length) {
            let discountAmount = 0;
            let finalTotal = preDiscountTotal;
            if (discount_type && discount_value && parseFloat(discount_value) > 0) {
              const discVal = parseFloat(discount_value);
              if (discount_type === 'percentage' && discVal <= 100) {
                discountAmount = preDiscountTotal * (discVal / 100);
              } else if (discount_type === 'fixed' && discVal <= preDiscountTotal) {
                discountAmount = discVal;
              } else {
                db.run('ROLLBACK');
                return res.status(400).send('Invalid discount value');
              }
              finalTotal -= discountAmount;
              profitTotal -= discountAmount;
            }

            db.run(
              `INSERT INTO sales (customer_id, total_amount, profit, bill_number, discount_type, discount_value, discount_amount, sale_date, payment_method)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                   [customerId, finalTotal, profitTotal, billNumber, discount_type || null, discount_value || null, discountAmount, sale_date || null, payment_method || 'Cash'],
                   function(err) {
                     if (err) { db.run('ROLLBACK'); return res.status(500).send('Error creating sale'); }
                     const saleId = this.lastID;

                     let itemsInserted = 0;
                     items.forEach(item => {
                       db.run(
                         `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, profit_on_item, size)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                              [saleId, item.product_id, item.quantity, item.price_at_sale, item.profit_on_item, item.size],
                              err => {
                                if (err) { db.run('ROLLBACK'); return res.status(500).send('Error creating sale items'); }
                                if (++itemsInserted === items.length) updateStock(saleId);
                              }
                       );
                     });
                   }
            );
          }
        });
      });

      const updateStock = (saleId) => {
        let stockUpdated = 0;
        cart.forEach(item => {
          db.get('SELECT id, stock FROM product_variants WHERE product_id = ? AND size = ?', [item.productId, item.size], (err, variant) => {
            if (err || !variant) { db.run('ROLLBACK'); return res.status(500).send('Variant not found'); }
            const newStock = variant.stock - item.quantity;
            if (newStock < 0) { db.run('ROLLBACK'); return res.status(500).send('Stock insufficient'); }
            db.run('UPDATE product_variants SET stock = ? WHERE id = ?', [newStock, variant.id], err => {
              if (err) { db.run('ROLLBACK'); return res.status(500).send('Error updating stock'); }
              if (++stockUpdated === cart.length) {
                db.run('COMMIT', err => {
                  if (err) return res.status(500).send('Error finalizing sale');
                  req.session.cart = [];
                  if (req.app.locals.socketApi) req.app.locals.socketApi.emitProductUpdate();
                  res.redirect(`/bill/${saleId}`);
                });
              }
            });
          });
        });
      };
    };

    if (customerName) {
      db.run(
        'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
             [customerName, customerPhone || null, customerEmail || null],
             function(err) {
               if (err) { db.run('ROLLBACK'); return res.status(500).send('Error creating customer'); }
               customerId = this.lastID;
               finalize();
             }
      );
    } else {
      finalize();
    }
  });
});

// Return sale
router.post('/return/:saleId', (req, res) => {
  const saleId = req.params.saleId;
  const returnDate = req.body.return_date || null;

  db.get('SELECT total_amount, profit, customer_id, returned FROM sales WHERE id = ?', [saleId], (err, originalSale) => {
    if (err) return res.status(500).send('Database error');
    if (!originalSale) return res.status(404).send('Original sale not found');
    if (originalSale.returned === 1) return res.status(400).send('This sale has already been returned');

    db.all('SELECT * FROM sale_items WHERE sale_id = ?', [saleId], (err, items) => {
      if (err) return res.status(500).send('Database error');
      if (items.length === 0) return res.status(404).send('No items found for this sale');

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const billNumber = 'RET-' + generateBillNumber();
        db.run(
          `INSERT INTO sales (customer_id, total_amount, profit, bill_number, payment_method, returned, sale_date)
          VALUES (?, ?, ?, ?, ?, 1, ?)`,
               [originalSale.customer_id, -originalSale.total_amount, -originalSale.profit, billNumber, 'Return', returnDate],
               function(err) {
                 if (err) { db.run('ROLLBACK'); return res.status(500).send('Error creating return sale'); }
                 const returnSaleId = this.lastID;

                 let itemsInserted = 0;
                 items.forEach(item => {
                   db.run(
                     `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, profit_on_item, size)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                          [returnSaleId, item.product_id, -item.quantity, item.price_at_sale, -item.profit_on_item, item.size],
                          err => {
                            if (err) { db.run('ROLLBACK'); return res.status(500).send('Error inserting return item'); }
                            db.get('SELECT id FROM product_variants WHERE product_id = ? AND size = ?', [item.product_id, item.size], (err, variant) => {
                              if (err || !variant) { db.run('ROLLBACK'); return res.status(500).send('Variant not found'); }
                              db.run('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [item.quantity, variant.id], err => {
                                if (err) { db.run('ROLLBACK'); return res.status(500).send('Error restoring stock'); }
                                if (++itemsInserted === items.length) {
                                  db.run('UPDATE sales SET returned = 1 WHERE id = ?', [saleId], err => {
                                    if (err) { db.run('ROLLBACK'); return res.status(500).send('Error marking original sale as returned'); }
                                    db.run('COMMIT', err => {
                                      if (err) return res.status(500).send('Error finalizing return');
                                      if (req.app.locals.socketApi) req.app.locals.socketApi.emitProductUpdate();
                                      res.redirect(`/bill/${returnSaleId}`);
                                    });
                                  });
                                }
                              });
                            });
                          }
                   );
                 });
               }
        );
      });
    });
  });
});

// Sales history with search
router.get('/sales', (req, res) => {
  const search = req.query.search ? req.query.search.trim() : '';
  let salesQuery = `
  SELECT s.*, c.name as customer_name, c.phone as customer_phone
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  `;
  const params = [];

  if (search) {
    const pattern = `%${search}%`;
    salesQuery += `
    WHERE s.bill_number LIKE ?
    OR c.name LIKE ?
    OR c.phone LIKE ?
    OR EXISTS (
      SELECT 1 FROM sale_items si2
      JOIN products p2 ON si2.product_id = p2.id
      WHERE si2.sale_id = s.id AND p2.product_code LIKE ?
    )
    `;
    params.push(pattern, pattern, pattern, pattern);
  }
  salesQuery += ' ORDER BY s.created_at DESC';

  db.all(salesQuery, params, (err, sales) => {
    if (err) return res.status(500).send('Database error');
    if (sales.length === 0) return res.render('sales', { sales: [], search });

    const saleIds = sales.map(s => s.id);
    const placeholders = saleIds.map(() => '?').join(',');
    db.all(`
    SELECT si.*, p.name as product_name, p.product_code
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id IN (${placeholders})
    `, saleIds, (err, items) => {
      if (err) return res.status(500).send('Database error');
      const itemsBySale = {};
      items.forEach(item => {
        if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
        itemsBySale[item.sale_id].push(item);
      });
      sales.forEach(sale => sale.items = itemsBySale[sale.id] || []);
      res.render('sales', { sales, search });
    });
  });
});

// Sold products list
router.get('/sold-products', async (req, res) => {
  const { start_date, end_date, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const effectiveDate = "COALESCE(s.sale_date, DATE(s.created_at, 'localtime'))";
  const where = [];
  const params = [];

  if (start_date && end_date) {
    where.push(`${effectiveDate} BETWEEN ? AND ?`);
    params.push(start_date, end_date);
  }
  if (search) {
    where.push(`(p.name LIKE ? OR s.bill_number LIKE ? OR p.product_code LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countQuery = `
  SELECT COUNT(*) as total
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  JOIN products p ON si.product_id = p.id
  ${whereClause}
  `;
  const countResult = await new Promise((resolve, reject) => {
    db.get(countQuery, params, (err, row) => err ? reject(err) : resolve(row));
  });
  const totalItems = countResult.total;
  const totalPages = Math.ceil(totalItems / limit);

  const query = `
  SELECT
  si.id,
  ${effectiveDate} as sale_date,
  s.bill_number,
  p.name as product_name,
  p.product_code,
  si.size,
  si.quantity,
  si.price_at_sale,
  (si.quantity * si.price_at_sale) as total_amount
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  JOIN products p ON si.product_id = p.id
  ${whereClause}
  ORDER BY ${effectiveDate} DESC, s.id DESC
  LIMIT ? OFFSET ?
  `;
  params.push(parseInt(limit), offset);

  const items = await new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
  });

  if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
    res.json({ items, totalPages, currentPage: parseInt(page), totalItems });
  } else {
    res.render('sold-products', {
      items,
      start_date: start_date || '',
      end_date: end_date || '',
      search: search || '',
      currentPage: parseInt(page),
               totalPages,
               totalItems
    });
  }
});

module.exports = router;
