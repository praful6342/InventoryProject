const express = require('express');
const router = express.Router();
const db = require('../database');
const QRCode = require('qrcode');
const { isAdmin } = require('../middleware/auth');

// Helper: generate product code from category, name
function generateProductCode(category, name) {
  return `${category}_${name}`
  .replace(/\s+/g, '')
  .toUpperCase();
}

// List products – ordered by newest first (accessible to all authenticated users)
router.get('/', (req, res) => {
  db.all('SELECT * FROM products ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.render('products/index', { products: rows });
  });
});

// Add product (with variants) – JSON API for modal (admin only)
router.post('/add', isAdmin, (req, res) => {
  const {
    category,
    name,
    supplier,
    cost_price,
    margin_percent,
    sizes,
    has_sizes,
    stock,
    created_at
  } = req.body;

  // Server-side validation for required fields
  if (!category || !name || !supplier || !cost_price || !margin_percent) {
    return res.status(400).json({ error: 'Missing required fields: category, name, supplier, cost price, margin percent' });
  }

  // Validate created_at is provided and is a valid date
  if (!created_at) {
    return res.status(400).json({ error: 'Added date is required' });
  }
  const createdDate = new Date(created_at);
  if (isNaN(createdDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format for Added On' });
  }

  const productCode = generateProductCode(category, name);
  const hasSizes = has_sizes === "on" ? 1 : 0;

  // Recalculate margin_rs and selling_price on server (rounded up)
  const cost = parseFloat(cost_price);
  const marginPercent = parseFloat(margin_percent);
  const marginRs = cost * (marginPercent / 100);
  const rawSelling = cost + marginRs;
  const selling_price = Math.ceil(rawSelling);

  // Insert product with the provided created_at
  db.run(
    `INSERT INTO products
    (product_code, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price, has_sizes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [productCode, category, name, supplier, cost, marginPercent, marginRs, selling_price, hasSizes, created_at],
         function(err) {
           if (err) {
             console.error(err);
             return res.status(500).json({ error: 'Error saving product' });
           }
           const productId = this.lastID;

           // Set permanent QR code based on product ID
           db.run('UPDATE products SET qr_code = ? WHERE id = ?', [`pid:${productId}`, productId], (err) => {
             if (err) console.error('Error setting qr_code:', err);
           });

             if (hasSizes) {
               // Handle variants (sizes array)
               let sizeEntries = [];
               if (Array.isArray(sizes)) {
                 sizeEntries = sizes;
               } else if (sizes && typeof sizes === 'object') {
                 sizeEntries = Object.values(sizes);
               }
               const validVariants = sizeEntries.filter(v => v && v.size && v.size.trim() !== '' && v.stock !== undefined && v.stock !== '');
               if (validVariants.length === 0) {
                 // Clean up the inserted product if validation fails
                 db.run('DELETE FROM products WHERE id = ?', [productId]);
                 return res.status(400).json({ error: 'At least one size with stock is required.' });
               }

               let completed = 0;
               const total = validVariants.length;
               validVariants.forEach(variant => {
                 db.run(
                   `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`,
                        [productId, variant.size, variant.stock],
                        (err) => {
                          if (err) console.error('Error saving variant:', err);
                          completed++;
                          if (completed === total) {
                            res.json({ success: true, redirect: '/products' });
                          }
                        }
                 );
               });
             } else {
               // Single stock, no sizes – validate stock
               if (stock === undefined || stock === '') {
                 db.run('DELETE FROM products WHERE id = ?', [productId]);
                 return res.status(400).json({ error: 'Stock quantity is required.' });
               }
               const singleStock = parseInt(stock) || 0;
               db.run('INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)',
                      [productId, 'ONESIZE', singleStock], (err) => {
                        if (err) console.error('Error saving ONESIZE variant:', err);
                        res.json({ success: true, redirect: '/products' });
                      });
             }
         }
  );
});

// View single product (with QR code) – accessible to all authenticated users
router.get('/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!product) {
      return res.status(404).send('Product not found');
    }
    QRCode.toDataURL(product.qr_code, (err, url) => {
      if (err) {
        console.error(err);
        return res.status(500).send('QR generation error');
      }
      res.render('show', { product, qrCodeUrl: url });
    });
  });
});

// Show edit product form (admin only)
router.get('/edit/:id', isAdmin, (req, res) => {
  const id = req.params.id;
  const error = req.query.error || null;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, productRow) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!productRow) {
      return res.status(404).send('Product not found');
    }
    db.all('SELECT size, stock FROM product_variants WHERE product_id = ?', [id], (err2, variants) => {
      if (err2) {
        console.error(err2);
        return res.status(500).send('Database error');
      }
      const product = { ...productRow, variants: variants || [], has_sizes: productRow.has_sizes };
      res.render('edit', { product, error });
    });
  });
});

// Update product (price, margin, stock, etc.) – QR code remains unchanged (admin only)
router.post('/update/:id', isAdmin, (req, res) => {
  const id = req.params.id;
  const {
    category,
    name,
    supplier,
    cost_price,
    margin_percent,
    sizes,
    has_sizes,
    stock,
    created_at
  } = req.body;

  // Server-side validation for required fields
  if (!category || !name || !supplier || !cost_price || !margin_percent) {
    return res.redirect('/products/edit/' + id + '?error=Missing required fields');
  }

  // Validate created_at is provided and is a valid date
  if (!created_at) {
    return res.redirect('/products/edit/' + id + '?error=Added date is required');
  }
  const createdDate = new Date(created_at);
  if (isNaN(createdDate.getTime())) {
    return res.redirect('/products/edit/' + id + '?error=Invalid date format for Added On');
  }

  const productCode = generateProductCode(category, name);
  const hasSizes = has_sizes === "on" ? 1 : 0;

  // Recalculate margin_rs and selling_price on server (rounded up)
  const cost = parseFloat(cost_price);
  const marginPercent = parseFloat(margin_percent);
  const marginRs = cost * (marginPercent / 100);
  const rawSelling = cost + marginRs;
  const selling_price = Math.ceil(rawSelling);

  // Conditional validation for sizes/stock
  if (hasSizes) {
    let sizeEntries = [];
    if (Array.isArray(sizes)) {
      sizeEntries = sizes;
    } else if (sizes && typeof sizes === 'object') {
      sizeEntries = Object.values(sizes);
    }
    const validVariants = sizeEntries.filter(v => v && v.size && v.size.trim() !== '' && v.stock !== undefined && v.stock !== '');
    if (validVariants.length === 0) {
      return res.redirect('/products/edit/' + id + '?error=At least one size with stock is required.');
    }
  } else {
    if (stock === undefined || stock === '') {
      return res.redirect('/products/edit/' + id + '?error=Stock quantity is required.');
    }
  }

  // Update product including recalculated margin_rs and selling_price
  db.run(
    `UPDATE products SET
    product_code = ?,
    category = ?,
    name = ?,
    supplier = ?,
    cost_price = ?,
    margin_percent = ?,
    margin_rs = ?,
    selling_price = ?,
    has_sizes = ?,
    created_at = ?
    WHERE id = ?`,
    [productCode, category, name, supplier, cost, marginPercent, marginRs, selling_price, hasSizes, created_at, id],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error updating product');
      }

      // Delete old variants
      db.run('DELETE FROM product_variants WHERE product_id = ?', [id], function(err2) {
        if (err2) {
          console.error('Error deleting old variants:', err2);
          return res.status(500).send('Error updating variants');
        }

        if (hasSizes) {
          let sizeEntries = [];
          if (Array.isArray(sizes)) {
            sizeEntries = sizes;
          } else if (sizes && typeof sizes === 'object') {
            sizeEntries = Object.values(sizes);
          }
          const validVariants = sizeEntries.filter(v => v && v.size && v.size.trim() !== '' && v.stock !== undefined && v.stock !== '');
          let completed = 0;
          const total = validVariants.length;
          if (total === 0) {
            return res.redirect('/products/' + id);
          }
          validVariants.forEach(variant => {
            db.run(
              `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`,
                   [id, variant.size, variant.stock],
                   function(err3) {
                     if (err3) console.error('Error saving variant:', err3);
                     completed++;
                     if (completed === total) {
                       res.redirect('/products/' + id);
                     }
                   }
            );
          });
        } else {
          const singleStock = parseInt(stock) || 0;
          db.run('INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)',
                 [id, 'ONESIZE', singleStock], function(err3) {
                   if (err3) console.error('Error saving ONESIZE variant:', err3);
                   res.redirect('/products/' + id);
                 });
        }
      });
    });
});

// Print label for a product – accessible to all authenticated users
router.get('/label/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!product) {
      return res.status(404).send('Product not found');
    }
    QRCode.toDataURL(product.qr_code, (err, url) => {
      if (err) {
        console.error(err);
        return res.status(500).send('QR generation error');
      }
      res.render('label', { product, qrCodeUrl: url });
    });
  });
});

// Delete product (with cleanup) – supports both form POST and JSON fetch (admin only)
router.post('/delete/:id', isAdmin, (req, res) => {
  const id = req.params.id;
  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('json'));

  db.run('DELETE FROM sale_items WHERE product_id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting sale_items:', err);
      return isJson ? res.status(500).json({ error: 'Error deleting sale items' }) : res.status(500).send('Error deleting sale items');
    }

    db.run('DELETE FROM sales WHERE id IN (SELECT s.id FROM sales s LEFT JOIN sale_items si ON s.id = si.sale_id WHERE si.id IS NULL)', [], function(err) {
      if (err) {
        console.error('Error cleaning up sales:', err);
        return isJson ? res.status(500).json({ error: 'Error cleaning up sales' }) : res.status(500).send('Error cleaning up sales');
      }

      db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting product:', err);
          return isJson ? res.status(500).json({ error: 'Error deleting product' }) : res.status(500).send('Error deleting product');
        }

        // Emit real‑time update
        if (req.app.locals.socketApi) {
          req.app.locals.socketApi.emitProductUpdate();
        }

        if (isJson) {
          res.json({ success: true });
        } else {
          res.redirect('/products');
        }
      });
    });
  });
});

module.exports = router;
