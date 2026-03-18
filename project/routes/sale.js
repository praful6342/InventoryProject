const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper to generate unique bill number
function generateBillNumber() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BILL-${yyyy}${mm}${dd}-${random}`;
}

// GET /sale/cart – display cart
router.get('/cart', (req, res) => {
  if (!req.session.cart) req.session.cart = [];
  res.render('cart', { cart: req.session.cart });
});

// POST /sale/add – add item to cart (AJAX)
router.post('/add', (req, res) => {
  const { productId, size, quantity } = req.body;
  if (!productId || !size || !quantity || quantity < 1) {
    return res.status(400).json({ error: 'Invalid product, size, or quantity' });
  }

  // Get product info and check stock for that size
  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    db.get('SELECT stock FROM product_variants WHERE product_id = ? AND size = ?', [productId, size], (err2, variant) => {
      if (err2 || !variant) {
        return res.status(404).json({ error: 'Size not available' });
      }
      const availableStock = variant.stock;
      if (availableStock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock for this size' });
      }

      // Initialize cart if needed
      if (!req.session.cart) req.session.cart = [];

      // Check if same product and size already in cart
      const existingIndex = req.session.cart.findIndex(item => item.productId === productId && item.size === size);
      if (existingIndex !== -1) {
        const newQty = req.session.cart[existingIndex].quantity + quantity;
        if (newQty > availableStock) {
          return res.status(400).json({ error: 'Total quantity exceeds available stock' });
        }
        req.session.cart[existingIndex].quantity = newQty;
      } else {
        req.session.cart.push({
          productId: product.id,
          size: size,
          quantity: quantity,
          name: product.name,
          product_code: product.product_code,
          selling_price: product.selling_price,
          maxStock: availableStock
        });
      }

      res.json({ success: true, cart: req.session.cart });
    });
  });
});

// POST /sale/update – update quantity in cart (AJAX)
router.post('/update', (req, res) => {
  const { productId, size, quantity } = req.body;
  if (!productId || !size || quantity < 0) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (!req.session.cart) req.session.cart = [];

  const itemIndex = req.session.cart.findIndex(item => item.productId === productId && item.size === size);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not in cart' });
  }

  if (quantity === 0) {
    // Remove item
    req.session.cart.splice(itemIndex, 1);
    return res.json({ success: true, cart: req.session.cart });
  }

  // Verify stock
  db.get('SELECT stock FROM product_variants WHERE product_id = ? AND size = ?', [productId, size], (err, variant) => {
    if (err || !variant) {
      return res.status(500).json({ error: 'Stock check failed' });
    }
    if (variant.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    req.session.cart[itemIndex].quantity = quantity;
    res.json({ success: true, cart: req.session.cart });
  });
});

// GET /sale/checkout – show checkout page
router.get('/checkout', (req, res) => {
  if (!req.session.cart || req.session.cart.length === 0) {
    return res.redirect('/sale/cart');
  }
  // Calculate total from cart
  const total = req.session.cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  res.render('checkout', { cart: req.session.cart, total });
});

// POST /sale/checkout – process sale
router.post('/checkout', (req, res) => {
  const { customerName, customerPhone, customerEmail, discount_type, discount_value, sale_date } = req.body;
  const cart = req.session.cart;
  if (!cart || cart.length === 0) {
    return res.redirect('/sale/cart');
  }

  const preDiscountTotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);

  // Start transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    let customerId = null;
    if (customerName) {
      db.run(
        'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
             [customerName, customerPhone || null, customerEmail || null],
             function(err) {
               if (err) {
                 console.error('Customer insert error:', err);
                 db.run('ROLLBACK');
                 return res.status(500).send('Error creating customer');
               }
               customerId = this.lastID;
               proceedWithSale(customerId, preDiscountTotal, discount_type, discount_value, sale_date);
             }
      );
    } else {
      proceedWithSale(null, preDiscountTotal, discount_type, discount_value, sale_date);
    }

    function proceedWithSale(customerId, preDiscountTotal, discount_type, discount_value, sale_date) {
      const billNumber = generateBillNumber();
      let profitTotal = 0;
      let itemsProcessed = 0;
      const items = [];

      cart.forEach((item, index) => {
        db.get('SELECT cost_price FROM products WHERE id = ?', [item.productId], (err, product) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).send('Error fetching product cost');
          }
          const cost = product.cost_price;
          const profitOnItem = (item.selling_price - cost) * item.quantity;
          profitTotal += profitOnItem;
          items.push({
            product_id: item.productId,
            size: item.size,
            quantity: item.quantity,
            price_at_sale: item.selling_price,
            profit_on_item: profitOnItem
          });

          itemsProcessed++;
          if (itemsProcessed === cart.length) {
            // Apply discount
            let discountAmount = 0;
            let finalTotal = preDiscountTotal;
            if (discount_type && discount_value && parseFloat(discount_value) > 0) {
              const discVal = parseFloat(discount_value);
              if (discount_type === 'percentage' && discVal <= 100) {
                discountAmount = preDiscountTotal * (discVal / 100);
              } else if (discount_type === 'fixed' && discVal <= preDiscountTotal) {
                discountAmount = discVal;
              } else {
                // Invalid discount – rollback and return error
                db.run('ROLLBACK');
                return res.status(400).send('Invalid discount value');
              }
              finalTotal -= discountAmount;
              profitTotal -= discountAmount;
            }

            // Create sale (including sale_date)
            db.run(
              `INSERT INTO sales (customer_id, total_amount, profit, bill_number, discount_type, discount_value, discount_amount, sale_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                   [customerId, finalTotal, profitTotal, billNumber, discount_type || null, discount_value || null, discountAmount, sale_date || null],
                   function(err) {
                     if (err) {
                       console.error('Sale insert error:', err);
                       db.run('ROLLBACK');
                       return res.status(500).send('Error creating sale');
                     }
                     const saleId = this.lastID;

                     // Insert sale items
                     let itemsInserted = 0;
                     items.forEach(item => {
                       db.run(
                         `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, profit_on_item)
                         VALUES (?, ?, ?, ?, ?)`,
                              [saleId, item.product_id, item.quantity, item.price_at_sale, item.profit_on_item],
                              function(err) {
                                if (err) {
                                  console.error('Sale item insert error:', err);
                                  db.run('ROLLBACK');
                                  return res.status(500).send('Error creating sale items');
                                }
                                itemsInserted++;
                                if (itemsInserted === items.length) {
                                  // Update stock
                                  updateStock(saleId);
                                }
                              }
                       );
                     });
                   }
            );
          }
        });
      });

      function updateStock(saleId) {
        let stockUpdated = 0;
        cart.forEach(item => {
          db.get('SELECT id, stock FROM product_variants WHERE product_id = ? AND size = ?', [item.productId, item.size], (err, variant) => {
            if (err || !variant) {
              console.error('Variant not found for product', item.productId, 'size', item.size);
              db.run('ROLLBACK');
              return res.status(500).send('Variant not found');
            }
            const newStock = variant.stock - item.quantity;
            if (newStock < 0) {
              db.run('ROLLBACK');
              return res.status(500).send('Stock insufficient');
            }
            db.run('UPDATE product_variants SET stock = ? WHERE id = ?', [newStock, variant.id], (err) => {
              if (err) {
                console.error('Stock update error:', err);
                db.run('ROLLBACK');
                return res.status(500).send('Error updating stock');
              }
              stockUpdated++;
              if (stockUpdated === cart.length) {
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('Commit error:', err);
                    return res.status(500).send('Error finalizing sale');
                  }
                  // Clear cart
                  req.session.cart = [];
                  // Emit real-time update
                  if (req.app.locals.socketApi) {
                    req.app.locals.socketApi.emitProductUpdate();
                  }
                  // Redirect to bill
                  res.redirect(`/bill/${saleId}`);
                });
              }
            });
          });
        });
      }
    }
  });
});

// ==================== NEW ROUTE: Sales History ====================
// GET /sale/sales – display all past sales with items
router.get('/sales', (req, res) => {
  // Fetch all sales with customer names
  db.all(`
  SELECT s.*, c.name as customer_name
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  ORDER BY s.created_at DESC
  `, [], (err, sales) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    if (sales.length === 0) {
      return res.render('sales', { sales: [] });
    }

    // Collect sale IDs to fetch items in bulk
    const saleIds = sales.map(s => s.id);
    const placeholders = saleIds.map(() => '?').join(',');

    db.all(`
    SELECT si.*, p.name as product_name
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id IN (${placeholders})
    `, saleIds, (err, items) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }

      // Group items by sale_id
      const itemsBySale = {};
      items.forEach(item => {
        if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
        itemsBySale[item.sale_id].push(item);
      });

      // Attach items to each sale
      sales.forEach(sale => {
        sale.items = itemsBySale[sale.id] || [];
      });

      res.render('sales', { sales });
    });
  });
});

module.exports = router;
