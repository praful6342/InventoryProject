# Clothing Store Inventory & Sales Management System

A complete web‑based solution for small clothing stores to manage products, track stock, process sales via QR scanning, handle returns, and view real‑time analytics.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Express](https://img.shields.io/badge/Express-5.x-blue)
![SQLite](https://img.shields.io/badge/SQLite-3-blue)
![License](https://img.shields.io/badge/License-ISC-lightgrey)

## ✨ Features

- **Role‑based authentication** – Admin and seller roles with different permissions.
- **Product management** – Add/edit/delete products; support for sizes (XS–5XL) and single‑size items.
- **QR code generation** – Each product gets a permanent QR code (`pid:ID`) and a printable label.
- **QR scanning** – Scan product QR codes using device camera (HTML5 QR scanner) or enter product code manually.
- **Shopping cart** – Session‑based cart, update quantities, remove items.
- **Checkout** – Customer info (optional), discount (percentage or fixed), sale date selection, payment method (Cash/UPI/Card).
- **Sales history** – View all sales with accordion details, search by bill number, product code, customer name/phone.
- **Return sales** – Process returns, restock items, create negative bill, capture return reason.
- **Edit & delete sales** – Admin only: edit sale items, prices, discount, or delete a sale (restores stock).
- **Sold products report** – Detailed per‑item view with allocated discount and net total; filter by date range, seller, and search.
- **Dashboard** – Sales metrics (quantity sold, profit, total sales), daily sales chart, payment method breakdown, inventory valuation (cost & selling).
- **User management** – Admin can add/delete sellers or other admins.
- **Real‑time updates** – Socket.IO notifies clients when product stock changes.

## 🛠️ Technologies

- **Backend**: Node.js, Express 5, SQLite3, bcrypt, express‑session, Socket.IO
- **Frontend**: EJS templates, Bootstrap 5, Chart.js, HTML5 QR scanner, Font Awesome
- **Development**: Self‑signed HTTPS (for local network testing)

## 📦 Installation

### Prerequisites
- Node.js (v18 or later)
- npm

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/inventoryproject.git
   cd inventoryproject
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate self‑signed SSL certificates** (required for HTTPS camera access)
   ```bash
   cd project
   openssl req -nodes -new -x509 -keyout server.key -out server.crt -days 365
   ```
   Follow the prompts (you can leave most fields blank).

4. **Database setup**  
   The database (`data/database.db`) is created automatically on first run.  
   A default admin user is created with:
   - Username: `admin`
   - Password: `admin123`  
   **⚠️ Change this password immediately after first login!**

5. **Start the server**
   ```bash
   npm start
   ```
   The server runs at `https://localhost:3000` (or `https://<your-laptop-ip>:3000`).

6. **Access the application**  
   Open your browser and accept the self‑signed certificate warning.  
   Log in with the default admin credentials.

## 🔧 Configuration

All configuration is currently hardcoded. For production, consider using environment variables:

| Variable        | Location                  | Purpose                               |
|----------------|---------------------------|---------------------------------------|
| Session secret | `server.js`               | Change `'inventory-secret-key'`       |
| Default admin  | `database.js`             | Password `admin123` – update after setup |
| Port            | `server.js` (PORT=3000)   | Change as needed                      |
| HTTPS options   | `server.js`               | Paths to `server.key` and `server.crt`|

## 🚀 Usage Guide

### Roles
- **Admin** – Full access: add/edit/delete products, manage users, edit/delete any sale.
- **Seller** – Can scan, add to cart, checkout, view sales history, print bills, process returns.

### Workflow

1. **Add products** (Admin only)  
   - Go to `Products` → `Add Product`.  
   - Enter category, name, supplier, cost price, margin %, optional sizes with stock.  
   - The selling price is automatically calculated (rounded up).

2. **Scan products**  
   - Navigate to `Scan`.  
   - Allow camera access and scan a product QR code (or enter product code manually).  
   - Select size (if applicable) and quantity, then click `Add to Cart`.

3. **Manage cart**  
   - View cart from the scanner page (right column) or go to `Cart`.  
   - Update quantities or remove items.

4. **Checkout**  
   - Click `Proceed to Checkout`.  
   - Fill optional customer details, select sale date (required), apply discount if needed, choose payment method.  
   - Complete sale – you will be redirected to the bill page.

5. **Print bill**  
   - From the bill page, click `Print Bill`.  
   - Admins can also edit or delete the sale from the bill page.

6. **Process return**  
   - Go to `Sales` → find the sale → click `Return Sale`.  
   - Enter return reason and optional return date.  
   - A negative bill is created, stock is restored, and the original sale is marked as returned.

7. **View reports**  
   - `Dashboard` – filter by date ranges, view metrics and chart.  
   - `Sold Items` – detailed per‑item report with discount allocation.

## 📁 Database Schema

Main tables:

- `users` – id, username, password (bcrypt), role (admin/seller)
- `products` – id, product_code, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price, has_sizes, qr_code, created_at
- `product_variants` – id, product_id, size, stock
- `customers` – id, name, phone, email
- `sales` – id, customer_id, total_amount, profit, bill_number, created_at, discount_type, discount_value, discount_amount, sale_date, payment_method, returned, return_reason, seller_id
- `sale_items` – id, sale_id, product_id, quantity, price_at_sale, profit_on_item, size

## 📡 API Endpoints (used by frontend)

| Endpoint                   | Method | Description                         |
|----------------------------|--------|-------------------------------------|
| `/api/products`            | GET    | Get all products with variants      |
| `/api/products/:id`        | GET    | Get a single product (by ID or code)|
| `/api/product-names`       | GET    | List of product names (autocomplete)|
| `/api/product-codes`       | GET    | List of product codes (autocomplete)|
| `/api/categories`          | GET    | List of categories                  |
| `/api/suppliers`           | GET    | List of suppliers                   |
| `/api/sellers`             | GET    | List of users with role seller/admin|
| `/scan/scan-product`       | POST   | Lookup product by code/pid          |
| `/sale/add`                | POST   | Add item to cart                    |
| `/sale/update`             | POST   | Update cart quantity                |
| `/sale/return/:saleId`     | POST   | Process a return                    |
| `/sale/delete/:id`         | POST   | Delete a sale (admin)               |

## 🔒 Security Notes

- **Default admin password** – Change immediately after first login.
- **Session secret** – Replace hardcoded value with a strong secret (e.g., `crypto.randomBytes(64).toString('hex')`).
- **HTTPS** – Required for camera access on modern browsers; self‑signed is fine for local networks.
- **SQL injection** – All queries use parameterised statements (`db.get`, `db.run` with `?` placeholders).
- **Password hashing** – bcrypt with strength 10.

## 🐛 Troubleshooting

| Issue                                      | Solution                                                                 |
|--------------------------------------------|--------------------------------------------------------------------------|
| Camera not working on mobile               | Ensure you are using **HTTPS** (self‑signed is accepted).                |
| QR scanner doesn't start                   | Check browser console; grant camera permissions; restart the scanner by clicking `Scan`. |
| Product not found when scanning `pid:123`  | Make sure the product exists and the QR code was generated correctly.    |
| Can’t edit a returned sale                 | Returned sales cannot be edited (design).                                |
| Database locked error                      | Stop the server, delete `data/database.db-journal` (if exists), restart. |
| Self‑signed certificate warning            | Proceed anyway; for production, use a real certificate.                  |

## 🧪 Testing

No automated tests are currently included. Manual testing is recommended.

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

Developed as a complete inventory & POS system for clothing stores.

---

**Enjoy managing your store with QR scanning!**  
For questions or improvements, please open an issue or contact the maintainer.
