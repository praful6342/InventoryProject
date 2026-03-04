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

// GET /sell - show sell form for a scanned product, or show cart if no product
router.get('/', (req, res) => {
  const productId = req.query.product;
  if (productId) {
    db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
      if (err || !product) {
        return res.render('sell', { product: null, variants: [], error: 'Product not found.', cart: req.session.cart || [] });
      }
      db.all('SELECT size, stock FROM product_variants WHERE product_id = ?', [productId], (err2, variants) => {
        if (err2) {
          return res.render('sell', { product, variants: [], error: 'Error loading variants.', cart: req.session.cart || [] });
        }
        res.render('sell', { product, variants, error: null, cart: req.session.cart || [] });
      });
    });
  } else {
    // Show cart and customer form if cart has items
    const cart = req.session.cart || [];
    res.render('sell', { product: null, variants: [], error: null, cart });
  }
});


// POST /sell/add - add a product to the session cart
router.post('/add', (req, res) => {
  const { product_id, size, quantity } = req.body;
  if (!product_id || !size || !quantity) {
    return res.status(400).send('Missing product, size, or quantity');
  }
  db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err || !product) {
      return res.status(404).send('Product not found');
    }
    db.get('SELECT * FROM product_variants WHERE product_id = ? AND size = ?', [product_id, size], (err2, variant) => {
      if (err2 || !variant) {
        return res.status(404).send('Product variant not found');
      }
      const qty = parseInt(quantity);
      if (qty > variant.stock) {
        return res.status(400).send('Not enough stock');
      }
      // Add to session cart
      if (!req.session.cart) req.session.cart = [];
      req.session.cart.push({
        product_id: product.id,
        name: product.name,
        category: product.category,
        size,
        quantity: qty,
        selling_price: product.selling_price,
        cost_price: product.cost_price
      });
      res.redirect('/sell');
    });
  });
});

// POST /sell/complete - complete the sale for all products in cart
router.post('/complete', (req, res) => {
  const { customer_name, customer_phone } = req.body;
  const cart = req.session.cart || [];
  if (!cart.length) {
    return res.status(400).send('Cart is empty');
  }
  // Check stock for all items first
  let stockError = null;
  let checked = 0;
  cart.forEach((item, idx) => {
    db.get('SELECT * FROM product_variants WHERE product_id = ? AND size = ?', [item.product_id, item.size], (err, variant) => {
      checked++;
      if (err || !variant || item.quantity > variant.stock) {
        stockError = `Not enough stock for ${item.name} (${item.size})`;
      }
      if (checked === cart.length) {
        if (stockError) return res.status(400).send(stockError);
        // Handle customer
        let customerId = null;
        if (customer_name) {
          db.get('SELECT id FROM customers WHERE name = ? AND phone = ?', [customer_name, customer_phone || null], (err4, customer) => {
            if (err4) return res.status(500).send('Error finding customer');
            if (customer) {
              customerId = customer.id;
              createSale();
            } else {
              db.run('INSERT INTO customers (name, phone) VALUES (?, ?)', [customer_name, customer_phone || null], function(err5) {
                if (err5) return res.status(500).send('Error creating customer');
                customerId = this.lastID;
                createSale();
              });
            }
          });
        } else {
          createSale();
        }
        function createSale() {
          const billNumber = generateBillNumber();
          const totalAmount = cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
          const profit = cart.reduce((sum, item) => sum + (item.selling_price - item.cost_price) * item.quantity, 0);
          db.run('INSERT INTO sales (customer_id, total_amount, profit, bill_number) VALUES (?, ?, ?, ?)', [customerId, totalAmount, profit, billNumber], function(err6) {
            if (err6) return res.status(500).send('Error creating sale');
            const saleId = this.lastID;
            // Insert all sale items and update stock
            let inserted = 0;
            cart.forEach(item => {
              db.run('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, profit_on_item) VALUES (?, ?, ?, ?, ?)', [saleId, item.product_id, item.quantity, item.selling_price, item.selling_price - item.cost_price], function(err7) {
                if (err7) return res.status(500).send('Error creating sale item');
                db.run('UPDATE product_variants SET stock = stock - ? WHERE product_id = ? AND size = ?', [item.quantity, item.product_id, item.size], function(err8) {
                  if (err8) return res.status(500).send('Error updating stock');
                  inserted++;
                  if (inserted === cart.length) {
                    // Clear cart and redirect to bill
                    req.session.cart = [];
                    res.redirect('/bill/' + saleId);
                  }
                });
              });
            });
          });
        }
      }
    });
  });
});

module.exports = router;