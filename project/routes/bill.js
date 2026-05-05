const express = require('express');
const router = express.Router();
const db = require('../database');
const pdfService = require('../services/pdf.service');
const whatsappService = require('../services/whatsapp.service');

// GET /bill/:id - display bill with split payment details
router.get('/:id', (req, res) => {
  const saleId = req.params.id;

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

        let totalPaid = 0;
        if (payments && payments.length) {
          totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        }
        const changeAmount = totalPaid - sale.total_amount;
        const isOverpaid = changeAmount > 0 && sale.total_amount >= 0;
        const showChange = isOverpaid && sale.total_amount > 0;

        db.get('SELECT username FROM users WHERE id = ?', [sale.seller_id], (err, seller) => {
          if (err) console.error(err);
          const sellerName = seller ? seller.username : 'Unknown';

          res.render('bill', {
            sale: {
              ...sale,
              seller_name: sellerName,
              payments: payments,
              totalPaid: totalPaid.toFixed(2)
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

// POST /bill/resend-whatsapp/:id - resend bill PDF to customer's WhatsApp
router.post('/resend-whatsapp/:id', async (req, res) => {
  const saleId = req.params.id;

  try {
    // Fetch sale with customer details
    const sale = await new Promise((resolve, reject) => {
      db.get(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
      `, [saleId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Get customer phone (use sale's customer_phone or fallback to customer table phone)
    let phoneNumber = sale.customer_phone;
    if (!phoneNumber) {
      if (sale.customer_id) {
        const customer = await new Promise((resolve, reject) => {
          db.get('SELECT phone FROM customers WHERE id = ?', [sale.customer_id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        phoneNumber = customer?.phone;
      }
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'No phone number found for this sale. Cannot send WhatsApp.' });
    }

    // Fetch items
    const items = await new Promise((resolve, reject) => {
      db.all(`
      SELECT si.*, p.name as product_name
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
      `, [saleId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Fetch payments
    const payments = await new Promise((resolve, reject) => {
      db.all(`
      SELECT payment_method, amount
      FROM sale_payments
      WHERE sale_id = ?
      `, [saleId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Attach payments and totalPaid to sale object for PDF generation
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    sale.payments = payments;
    sale.totalPaid = totalPaid;

    // Generate PDF
    const pdfBuffer = await pdfService.generateBillPDF(sale, items, req.session.user);

    // Send via WhatsApp
    const response = await whatsappService.sendDocument(
      phoneNumber,
      pdfBuffer,
      `Bill_${sale.bill_number}.pdf`,
      `Dear ${sale.customer_name || 'Customer'}, here is your bill for reference.`
    );

    res.json({ success: true, message: `Bill sent to ${phoneNumber}`, response });
  } catch (error) {
    console.error('WhatsApp resend error:', error);
    res.status(500).json({ error: error.message || 'Failed to send WhatsApp message' });
  }
});

module.exports = router;
