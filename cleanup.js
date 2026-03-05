const db = require('./project/database');

db.run(`
  DELETE FROM product_variants
  WHERE product_id NOT IN (SELECT id FROM products)
`, function(err) {
  if (err) {
    console.error('Cleanup error:', err);
  } else {
    console.log(`Removed ${this.changes} orphaned variant records.`);
  }
  db.close();
});