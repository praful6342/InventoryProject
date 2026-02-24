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
router.get('/', (req, res) => {
  const productId = req.query.product;

  if (!productId) {
    // No product pre-selected: show a product search/selection page? For v1, we'll just show a form with product dropdown.
    db.all('SELECT id, name, selling_price, stock FROM products', [], (err, products) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.render('sell', { product: null, products, customer: null, error: null });
    });
  } else {
    // Pre-select product by ID
    db.get('SELECT id, name, selling_price, cost_price, stock FROM products WHERE id = ?', [productId], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      if (!product) {
        return res.status(404).send('Product not found');
      }
      // Also fetch all products for dropdown if needed (optional)
      db.all('SELECT id, name, selling_price, stock FROM products', [], (err, products) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }
        res.render('sell', { product, products, customer: null, error: null });
      });
    });
  }
});

// POST /sell - process the sale
router.post('/', (req, res) => {
  const { product_id, quantity, customer_name, customer_phone, customer_email } = req.body;

  // Basic validation
  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).send('Invalid product or quantity');
  }

  // Start a transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 1. Get product details and check stock
    db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
      if (err) {
        console.error(err);
        db.run('ROLLBACK');
        return res.status(500).send('Database error');
      }
      if (!product) {
        db.run('ROLLBACK');
        return res.status(404).send('Product not found');
      }
      if (product.stock < quantity) {
        db.run('ROLLBACK');
        return res.status(400).send(`Insufficient stock. Available: ${product.stock}`);
      }

      // 2. Create or retrieve customer
      let customerId = null;
      const insertCustomer = (callback) => {
        if (customer_name) {
          // Check if customer exists with same name/phone (simplistic)
          db.get('SELECT id FROM customers WHERE name = ? AND phone = ?', [customer_name, customer_phone || ''], (err, row) => {
            if (err) {
              callback(err);
            } else if (row) {
              customerId = row.id;
              callback(null);
            } else {
              // Insert new customer
              db.run('INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
                [customer_name, customer_phone || null, customer_email || null],
                function(err) {
                  if (err) {
                    callback(err);
                  } else {
                    customerId = this.lastID;
                    callback(null);
                  }
                }
              );
            }
          });
        } else {
          // No customer name provided – proceed with customerId = null
          callback(null);
        }
      };

      insertCustomer((err) => {
        if (err) {
          console.error(err);
          db.run('ROLLBACK');
          return res.status(500).send('Error saving customer');
        }

        // 3. Calculate totals
        const totalAmount = product.selling_price * quantity;
        const profitOnItem = (product.selling_price - product.cost_price) * quantity;

        // 4. Generate bill number
        const billNumber = generateBillNumber();

        // 5. Insert sale record
        db.run('INSERT INTO sales (customer_id, total_amount, profit, bill_number) VALUES (?, ?, ?, ?)',
          [customerId, totalAmount, profitOnItem, billNumber],
          function(err) {
            if (err) {
              console.error(err);
              db.run('ROLLBACK');
              return res.status(500).send('Error creating sale');
            }
            const saleId = this.lastID;

            // 6. Insert sale item
            db.run('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, profit_on_item) VALUES (?, ?, ?, ?, ?)',
              [saleId, product_id, quantity, product.selling_price, profitOnItem],
              (err) => {
                if (err) {
                  console.error(err);
                  db.run('ROLLBACK');
                  return res.status(500).send('Error recording sale item');
                }

                // 7. Update product stock
                db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, product_id], (err) => {
                  if (err) {
                    console.error(err);
                    db.run('ROLLBACK');
                    return res.status(500).send('Error updating stock');
                  }

                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error(err);
                      return res.status(500).send('Error committing transaction');
                    }
                    // Redirect to bill page
                    res.redirect(`/bill/${saleId}`);
                  });
                });
              }
            );
          }
        );
      });
    });
  });
});

module.exports = router;