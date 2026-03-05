const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const https = require('https');   // for HTTPS
const fs = require('fs');         // to read certificate files

// Import route modules
const scanRoutes = require('./routes/scan');
const productRoutes = require('./routes/products');
const apiRoutes = require('./routes/api');
const billRoutes = require('./routes/bill');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = 3000;


// Middleware
app.use(express.json());                     // Parse JSON bodies (for fetch requests)
app.use(bodyParser.urlencoded({ extended: true })); // Parse form data
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware (for cart/session storage)
app.use(session({
  secret: 'inventory-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS in production
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Use routes
app.use('/products', productRoutes);
app.use('/scan', scanRoutes);
app.use('/api', apiRoutes);
app.use('/bill', billRoutes);
app.use('/dashboard', dashboardRoutes);

// Home route - show dashboard
const db = require('./database');
app.get('/', (req, res) => {
  // Get today's date in YYYY-MM-DD
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  db.get(
    `SELECT COALESCE(SUM(si.quantity), 0) AS qtySold, COALESCE(SUM(s.profit), 0) AS profit
     FROM sales s
     JOIN sale_items si ON s.id = si.sale_id
     WHERE DATE(s.created_at) = ?`,
    [todayStr],
    (err, salesRow) => {
      if (err) return res.status(500).send('Error fetching sales data');
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

// HTTPS options (self-signed certificate)
const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
};

// Create HTTPS server and integrate Socket.IO
const server = https.createServer(options, app);
const setupSocket = require('./socket');
const socketApi = setupSocket(server);
app.locals.socketApi = socketApi;
server.listen(PORT, () => {
  console.log(`HTTPS Server running at https://localhost:${PORT}`);
  console.log(`On your phone, use https://<your-laptop-ip>:${PORT}`);
});