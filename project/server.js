const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const https = require('https');   // for HTTPS
const fs = require('fs');         // to read certificate files

// Import route modules
const scanRoutes = require('./routes/scan');
const productRoutes = require('./routes/products');
const apiRoutes = require('./routes/api');
const sellRoutes = require('./routes/sell');
const billRoutes = require('./routes/bill');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());                     // Parse JSON bodies (for fetch requests)
app.use(bodyParser.urlencoded({ extended: true })); // Parse form data
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Use routes
app.use('/scan', scanRoutes);
app.use('/products', productRoutes);
app.use('/api', apiRoutes);
app.use('/sell', sellRoutes);
app.use('/bill', billRoutes);

// Home route - dashboard
app.get('/', (req, res) => {
  res.render('index');
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