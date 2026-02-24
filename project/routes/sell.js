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


// Only allow access via QR scan, not manual selection
router.get('/', (req, res) => {
  // If a product is passed as a query param, show info and allow sale
  const productId = req.query.product;
  if (productId) {
    db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
      if (err || !product) {
        return res.render('sell', { product: null, variants: [], error: 'Product not found.' });
      }
      db.all('SELECT size, stock FROM product_variants WHERE product_id = ?', [productId], (err2, variants) => {
        if (err2) {
          return res.render('sell', { product, variants: [], error: 'Error loading variants.' });
        }
        res.render('sell', { product, variants, error: null });
      });
    });
  } else {
    res.render('sell', { product: null, variants: [], error: 'Sales can only be completed by scanning the product QR code.' });
  }
});

// POST /sell - process the sale
router.post('/', (req, res) => {
  const { product_id, size, quantity, customer_name, customer_phone } = req.body;
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
      // Deduct stock
      db.run('UPDATE product_variants SET stock = stock - ? WHERE product_id = ? AND size = ?', [qty, product_id, size], function(err3) {
        if (err3) {
          return res.status(500).send('Error updating stock');
        }
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
          const totalAmount = product.selling_price * qty;
          const profit = (product.selling_price - product.cost_price) * qty;
          db.run('INSERT INTO sales (customer_id, total_amount, profit, bill_number) VALUES (?, ?, ?, ?)', [customerId, totalAmount, profit, billNumber], function(err6) {
            if (err6) return res.status(500).send('Error creating sale');
            const saleId = this.lastID;
            db.run('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, profit_on_item) VALUES (?, ?, ?, ?, ?)', [saleId, product_id, qty, product.selling_price, product.selling_price - product.cost_price], function(err7) {
              if (err7) return res.status(500).send('Error creating sale item');
              // Redirect to bill page
              res.redirect('/bill/' + saleId);
            });
          });
        }
      });
    });
  });
});

module.exports = router;