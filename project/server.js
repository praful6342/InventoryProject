const express = require('express');
const session = require('express-session');
const path = require('path');
const https = require('https');
const fs = require('fs');

// Import route modules
const scanRoutes = require('./routes/scan');
const productRoutes = require('./routes/products');
const apiRoutes = require('./routes/api');
const billRoutes = require('./routes/bill');
const dashboardRoutes = require('./routes/dashboard');
const saleRoutes = require('./routes/sale');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());                          // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));  // Parse form data
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
app.set('views', path.resolve(__dirname, 'views'));

// Use routes
app.use('/products', productRoutes);
app.use('/scan', scanRoutes);
app.use('/api', apiRoutes);
app.use('/bill', billRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/sale', saleRoutes);


// Home route – landing page
app.get('/', (req, res) => {
  res.redirect('/dashboard');
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