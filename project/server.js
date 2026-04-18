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
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');   // <-- NEW: user management
const { isAuthenticated, isAdmin } = require('./middleware/auth');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: 'inventory-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true if using HTTPS in production
}));

// Make user available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

// Public routes (no authentication required)
app.use(authRoutes); // /login and /logout

// Apply authentication middleware to all protected routes
app.use('/products', isAuthenticated);
app.use('/scan', isAuthenticated);
app.use('/dashboard', isAuthenticated);
app.use('/sale', isAuthenticated);
app.use('/bill', isAuthenticated);
app.use('/api', isAuthenticated);
app.use('/users', isAuthenticated);   // <-- NEW: protect /users

// Route registrations (after middleware, so they are protected)
app.use('/products', productRoutes);
app.use('/scan', scanRoutes);
app.use('/api', apiRoutes);
app.use('/bill', billRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/sale', saleRoutes);
app.use('/users', userRoutes);        // <-- NEW: register users route

// Home route – redirect to dashboard (protected)
app.get('/', isAuthenticated, (req, res) => {
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
