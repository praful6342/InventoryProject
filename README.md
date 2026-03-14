# InventoryProject - Clothing Store Management System

A full-featured inventory and sales management system for clothing stores, with QR code product tracking, real‑time updates, and a responsive web interface.

## Features

- **Product Management**  
  - Add, edit, delete, and view products with variant support (sizes: S, M, L, XL, XXL) and stock per size.  
  - Automatic product code generation based on category and name.  
  - Permanent QR codes generated per product (using product ID) for easy scanning.  
  - Label printing with product code, selling price, and QR code.

- **QR Code Scanning**  
  - Scan product QR codes using the device camera (via `html5-qrcode` library).  
  - Instant lookup of product details and stock availability.  
  - Add scanned items directly to cart with size and quantity selection.

- **Sales & Cart**  
  - Session‑based shopping cart (persists across requests).  
  - Add/update/remove items before checkout.  
  - Real‑time stock validation during cart operations.  
  - Checkout with optional customer information (name, phone, email).  
  - Generates unique bill numbers and records sales with profit calculation.

- **Billing**  
  - Printable bill page with customer details, itemised list, and total amount.  
  - Stores sale transactions in database with profit tracking.

- **Dashboard**  
  - Daily summary: quantity sold, profit, current stock.  
  - Inventory valuation at cost and selling price.  
  - Sales trend chart (placeholder – can be connected to real data).

- **Real‑time Updates**  
  - Socket.IO integration broadcasts product changes (add/update/delete) to all connected clients.  
  - Product lists and detail pages update automatically.

- **Data Import / Export**  
  - `import-from-csv.js` script to bulk import products from a CSV file.  
  - `cleanup.js` removes orphaned variant records.

- **HTTPS Support**  
  - Runs with a self‑signed certificate for secure local network access (ideal for mobile scanning).

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or newer)
- [npm](https://www.npmjs.com/)
- SQLite3 (usually included with the `sqlite3` npm package)

## Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/yourusername/InventoryProject.git
   cd InventoryProject
   ```

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **Generate SSL certificate for HTTPS (self‑signed)**  
   The app requires `server.key` and `server.crt` files in the `project/` folder.  
   Run the following command (openssl must be installed) and place the generated files in `project/`:
   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout project/server.key -out project/server.crt -days 365 -nodes
   ```
   When prompted for information, you can leave fields blank or fill as needed.

4. **Database setup**  
   The SQLite database will be created automatically in the `data/` folder when the server first runs.  
   No additional setup is required. If you need to initialise with sample data, you can use the CSV import script (see below).

5. **Environment configuration (optional)**  
   You can change the session secret in `project/server.js` (line with `secret: 'inventory-secret-key'`).  
   For production, consider using environment variables.

## Usage

1. **Start the server**  
   ```bash
   npm start
   ```
   The server will start on `https://localhost:3000` (or your machine's IP).

2. **Access the application**  
   Open your browser and go to `https://localhost:3000`.  
   If you are on another device on the same network, use `https://<your-laptop-ip>:3000`.  
   You may see a security warning because of the self‑signed certificate – proceed anyway.

3. **Using the app**  
   - **Products**: View all products, add new ones, edit or delete existing ones.  
   - **Scan**: Use your camera to scan product QR codes and add items to cart.  
   - **Cart**: Review selected items, adjust quantities, proceed to checkout.  
   - **Dashboard**: See daily sales metrics and inventory value.  
   - **Bill**: After checkout, a printable bill is displayed.

4. **Import products from CSV**  
   Place your CSV file (e.g., `products.csv`) in the project root.  
   Run the import script:
   ```bash
   node import-from-csv.js
   ```
   The script expects columns: `category, name, supplier, cost_price, margin_percent, margin_rs, selling_price, size, stock`.  
   See `products.csv` for an example format.

5. **Clean up orphaned variants**  
   If you delete products directly from the database, you can run:
   ```bash
   node cleanup.js
   ```
   This removes variant records that no longer have a corresponding product.

## Project Structure

```
InventoryProject/
├── data/                       # SQLite database and generated label images
├── project/                    # Main application folder
│   ├── public/                 # Static assets (CSS, JS)
│   ├── routes/                 # Express route handlers
│   ├── views/                  # EJS templates
│   ├── server.js               # Entry point
│   ├── database.js             # Database connection and schema
│   └── socket.js               # Socket.IO setup
├── cleanup.js                  # Orphaned variant removal
├── import-from-csv.js          # Bulk product import
├── products.csv                # Example CSV for import
├── HowToEditDatabase.md        # Database editing guide
├── HowToUpdateWithoutLosingData.md  # Update guide
└── Wisdom/                     # Development roadmap
```

## API Endpoints

The following JSON API endpoints are available (useful for integrations):

| Method | Endpoint                 | Description                                    |
|--------|--------------------------|------------------------------------------------|
| GET    | `/api/products`          | List all products (with variants)              |
| GET    | `/api/products/:id`      | Get a single product by ID or product code     |
| GET    | `/api/qr/:code`          | Serve QR code image for the given code         |
| POST   | `/scan/scan-product`     | Lookup product by scanned QR code              |
| POST   | `/sale/add`              | Add item to cart (AJAX)                        |
| POST   | `/sale/update`           | Update cart item quantity (AJAX)               |
| POST   | `/products/delete/:id`   | Delete a product (supports JSON response)      |

## Technologies Used

- **Backend**: Node.js, Express.js, SQLite3, Socket.IO
- **Frontend**: Bootstrap 5, EJS, custom CSS, JavaScript
- **QR**: `qrcode` (generation), `html5-qrcode` (scanning)
- **Session**: `express-session`
- **CSV parsing**: `csv-parser`
- **HTTPS**: Built‑in `https` module with self‑signed certificates

## Contributing

Contributions are welcome! If you'd like to improve the project, please fork the repository and submit a pull request. For major changes, open an issue first to discuss what you'd like to change.

## License

This project is open source and available under the [MIT License](LICENSE).