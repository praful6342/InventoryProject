const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

// Connect to your database
const dbPath = path.join(__dirname, 'data', 'database.db');
const db = new sqlite3.Database(dbPath);

// Function to generate product code (without selling price)
function generateProductCode(category, name, supplier) {
  // Remove any special characters and convert to uppercase
  const cleanCategory = (category || '').replace(/[^a-zA-Z0-9]/g, '');
  const cleanName = (name || '').replace(/[^a-zA-Z0-9]/g, '');
  const cleanSupplier = (supplier || '').replace(/[^a-zA-Z0-9]/g, '');
  
  return `${cleanCategory}_${cleanName}_${cleanSupplier}`.toUpperCase();
}

// Function to clean percentage value (remove % sign if present)
function cleanPercentage(value) {
  if (!value) return 0;
  if (typeof value === 'string') {
    return parseFloat(value.replace('%', '')) || 0;
  }
  return parseFloat(value) || 0;
}

// Read and import CSV
const results = [];
console.log('Reading CSV file...');

fs.createReadStream('products.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    console.log(`Found ${results.length} products to import`);
    
    if (results.length === 0) {
      console.log('No products found in CSV file.');
      db.close();
      return;
    }
    
    db.serialize(() => {
      // Begin transaction for faster import
      db.run('BEGIN TRANSACTION');
      
      let completed = 0;
      let successCount = 0;
      let errorCount = 0;
      const total = results.length;
      
      results.forEach((row, index) => {
        // Extract data from CSV columns
        const category = row.category || '';
        const name = row.name || '';
        const supplier = row.supplier || '';
        
        // Parse numeric values
        const cost_price = parseFloat(row.cost_price) || 0;
        const margin_percent = cleanPercentage(row.margin_percent);
        const margin_rs = parseFloat(row.margin_rs) || 0;
        const selling_price = parseFloat(row.selling_price) || 0;
        
        // Skip if essential fields are missing
        if (!category || !name || !supplier) {
          console.error(`Row ${index + 1}: Missing required fields (category, name, or supplier)`);
          errorCount++;
          completed++;
          if (completed === total) finalize();
          return;
        }
        
        const productCode = generateProductCode(category, name, supplier);
        
        // Insert product
        db.run(
          `INSERT INTO products 
           (product_code, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [productCode, category, name, supplier, cost_price, margin_percent, margin_rs, selling_price],
          function(err) {
            if (err) {
              console.error(`Error inserting product ${name}:`, err.message);
              errorCount++;
            } else {
              const productId = this.lastID;
              
              // Set QR code based on product ID
              db.run('UPDATE products SET qr_code = ? WHERE id = ?', 
                [`pid:${productId}`, productId], 
                (err) => {
                  if (err) console.error('Error setting qr_code:', err);
                }
              );
              
              console.log(`✓ Imported: ${name} (ID: ${productId})`);
              successCount++;
            }
            
            completed++;
            if (completed === total) {
              finalize();
            }
          }
        );
      });
      
      function finalize() {
        db.run('COMMIT', () => {
          console.log('\n=== Import Summary ===');
          console.log(`Total products: ${total}`);
          console.log(`Successfully imported: ${successCount}`);
          console.log(`Errors: ${errorCount}`);
          console.log('=====================');
          
          // Verify the import
          db.get('SELECT COUNT(*) as count FROM products', [], (err, result) => {
            if (!err) {
              console.log(`Total products in database now: ${result.count}`);
            }
            db.close();
          });
        });
      }
    });
  });

// Handle errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  db.close();
  process.exit(1);
});