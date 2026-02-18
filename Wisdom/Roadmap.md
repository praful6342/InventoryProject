## Revised A-Z Roadmap for a Local Prototype (v1.0)

**Goal:** Build a minimal, locally-run web application for your clothing business that handles QR code‑based inventory, sales tracking, profit calculation, and billing. You (a solo beginner with moderate web development skills) will develop and test it on your laptop and optionally your Android phone – all without spending money.

---

### Phase 1: Requirements & Scope (v1.0)

**Core features for version 1.0:**

- **Product management** – Add, edit, and view products (with cost price, selling price, stock quantity).
- **QR code generation** – For each product, generate a scannable QR code (encoding the product ID).
- **QR code scanning** – On a mobile browser, scan a product’s QR code to quickly start a sale.
- **Sales processing** – After scanning, enter quantity and customer details; the system deducts stock, calculates profit, and creates a bill.
- **Bill view & save** – Display a printable bill and store it in the database.
- **Basic reports** – View total sales, items sold, and profit for a selected period (day, week, month, quarter, year).
- **Inventory overview** – See current stock levels, low‑stock alerts (optional).

**Non‑goals for v1.0:**

- User authentication (we’ll assume a single user for now).
- Multi‑store or multi‑user support.
- Email/SMS bills.
- Cloud deployment or external hosting.
- Native mobile app – we’ll use a responsive web app with camera access.

---

### Phase 2: Technology Stack (Simple & Free)

| Component | Choice | Reason |
| --- | --- | --- |
| Backend | Node.js + Express | JavaScript throughout, huge ecosystem, easy to start. |
| Database | SQLite3 | File‑based, no separate server, perfect for local prototyping. |
| Frontend | EJS templates + Bootstrap 5 | Server‑rendered pages, minimal JavaScript, responsive out‑of‑the‑box. |
| QR Scanning | Instascan (or `jsQR` + getUserMedia) | Lightweight library that works in the browser via webcam. |
| QR Generation | `qrcode` npm package | Generate QR codes as PNG or data URLs. |
| Charts (optional) | Chart.js | Simple, free, and easy to integrate. |
| Environment | Laptop (Windows/Mac/Linux) + Android phone (for testing) | All tools are free and run locally. |

---

### Phase 3: Development Steps (A‑Z)

### Step 1: Project Setup (1 day)

- Install Node.js and npm.
- Create a project folder, run `npm init -y`.
- Install dependencies:
    
    ```
    npm install express sqlite3 ejs body-parser --save
    ```
    
- Create folder structure:
    
    ```
    /project
      /views          (EJS templates)
      /public         (CSS, client‑side JS, images)
      /routes         (Express route files)
      database.js     (SQLite connection & schema)
      server.js       (entry point)
    ```
    

### Step 2: Database Schema (1 day)

- Design tables in SQLite:
    
    ```sql
    -- products
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      qr_code TEXT UNIQUE   -- we'll store the product ID as the QR code text
    );
    
    -- customers
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT
    );
    
    -- sales
    CREATE TABLE sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      total_amount REAL NOT NULL,
      profit REAL NOT NULL,
      bill_number TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    
    -- sale_items
    CREATE TABLE sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_sale REAL NOT NULL,      -- selling price at time of sale
      profit_on_item REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    ```
    
- Write a `database.js` module that opens the SQLite file and runs the schema creation if the file doesn’t exist.

### Step 3: Basic Express Server & Views (2 days)

- Set up `server.js` to:
    - Serve static files from `/public`.
    - Use `body-parser` to handle form data.
    - Set EJS as the view engine.
    - Include route files.
- Create a simple layout (`views/layout.ejs`) with Bootstrap CDN and a navigation bar (Home, Products, Sales, Reports).
- Implement placeholder routes and render basic pages.

### Step 4: Product Management (2 days)

- Create routes:
    - `GET /products` – list all products with stock.
    - `GET /products/add` – form to add a new product.
    - `POST /products` – save product and generate QR code.
    - `GET /products/edit/:id` – edit form.
    - `POST /products/update/:id` – update product details (including stock adjustment).
- QR code generation:
When a product is added, generate a QR code that contains the product’s ID (as plain text). Use the `qrcode` library to create a PNG data URL and display it on the product detail page. Also provide a download link.
- For testing, you can add a few sample products manually.

### Step 5: QR Scanning & Sales Interface (3 days)

- Create a page `GET /scan` that loads the Instascan library and shows the camera feed.
- Write client‑side JavaScript that:
    - Initialises the scanner.
    - On successful scan, extracts the product ID (the QR code text).
    - Redirects to a sales page with that product pre‑selected, e.g., `/sell?product=123`.
- Create a route `GET /sell` (with optional product ID query) that renders a form:
    - If product ID is provided, auto‑fill product name and current price (from DB).
    - Allow the user to enter quantity and customer details (name, phone).
    - Show a preview of total.
- On form submission (`POST /sell`):
    - Validate stock availability.
    - Deduct stock from the product.
    - Insert/retrieve customer (if new customer, create record).
    - Create sale record and sale items, calculate profit.
    - Generate a unique bill number (e.g., `BILL-{timestamp}`).
    - Redirect to a bill page (`/bill/:id`).

### Step 6: Bill View & Printing (1 day)

- Create route `GET /bill/:id` that displays a nicely formatted bill (using EJS) with customer details, items, totals, and profit.
- Add a “Print” button that triggers the browser’s print dialog (good for saving as PDF).

### Step 7: Reports & Inventory Overview (2 days)

- Create route `GET /reports` with a form to select date range and period (day, week, month, quarter, year).
- For the selected period, query the database:
    - Total sales amount (SUM of `total_amount`).
    - Total profit (SUM of `profit`).
    - Total items sold (SUM of `sale_items.quantity`).
    - Optionally, group by product to see best‑sellers.
- Use Chart.js to display a simple bar chart of daily sales (optional).
- On the same page, show current inventory with stock levels.

### Step 8: Testing & Polishing (2 days)

- Test all flows on your laptop:
    - Add a product → generate QR code → scan using your laptop’s webcam (or mock scan) → complete a sale → verify stock deduction and bill.
    - Try selling multiple quantities.
    - Check reports with sample data.
- Test on your Android phone:
    - Ensure your laptop and phone are on the same Wi‑Fi.
    - Find your laptop’s local IP address (e.g., `192.168.x.x`).
    - Run the Node server and access `http://<laptop-ip>:3000` from the phone’s browser.
    - Use the phone’s camera to scan QR codes displayed on the laptop screen (or printed on paper). Confirm scanning works.
- Fix any layout issues (Bootstrap helps with responsiveness).

### Step 9: Documentation & Handover (1 day)

- Write a simple `README.md` with:
    - How to install and run the project.
    - Default credentials (none) and how to add products.
    - How to access from a phone.
    - Known limitations (v1.0).
- Create a few sample QR codes (print them) for demonstration.

---

### Phase 4: Future Enhancements (Beyond v1.0)

Once the prototype is stable and you’ve tested it with real operations, you can plan v2.0 features:

- User authentication (login for staff).
- Export reports to CSV/PDF.
- Email/SMS bills to customers.
- Cloud deployment (e.g., on a cheap VPS) for remote access.
- Native mobile app with offline support.
- Integration with barcode scanners.
- Advanced analytics (profit margins by product, trends).

---

### Estimated Timeline

| Step | Activity | Duration |
| --- | --- | --- |
| 1 | Project setup | 1 day |
| 2 | Database schema | 1 day |
| 3 | Basic server & views | 2 days |
| 4 | Product management | 2 days |
| 5 | QR scanning & sales | 3 days |
| 6 | Bill view & printing | 1 day |
| 7 | Reports & inventory | 2 days |
| 8 | Testing & polishing | 2 days |
| 9 | Documentation | 1 day |
| **Total** |  | **~14 days (3 weeks)** |

*Note: These are optimistic estimates for a beginner working part‑time. Adjust according to your pace.*

---

### Final Tips for Success

- **Start small**: Implement one feature at a time and test thoroughly.
- **Use the browser’s developer tools** to debug JavaScript and network requests.
- **Keep a notebook** to jot down ideas, issues, and solutions.
- **Print QR codes on paper** and stick them on sample items for realistic testing.
- **Backup your database file** regularly (just copy it).
- **Don’t worry about perfection** – v1.0 is about proving the concept.

With this roadmap, you’ll have a fully functional local prototype that you can evolve later. Good luck with your clothing business!