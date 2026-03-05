const db = require('./db');

console.log('Running migration: add currency column to transactions...');

const migrate = db.transaction(() => {
  // Check if currency column already exists
  const cols = db.prepare("PRAGMA table_info(transactions)").all();
  if (cols.some(c => c.name === 'currency')) {
    console.log('Migration not needed - currency column already exists.');
    return;
  }

  console.log('Adding currency column...');

  // Backup data
  db.exec(`CREATE TABLE transactions_backup AS SELECT * FROM transactions`);

  // Drop old table
  db.exec(`DROP TABLE transactions`);

  // Create new table with currency column
  db.exec(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      user_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'withdrawal')),
      source TEXT NOT NULL DEFAULT 'personal' CHECK(source IN ('personal', 'combined')),
      currency TEXT NOT NULL DEFAULT 'PKR' CHECK(currency IN ('PKR', 'GBP')),
      amount REAL NOT NULL CHECK(amount > 0),
      description TEXT,
      category TEXT,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Restore data - all existing transactions are PKR
  db.exec(`
    INSERT INTO transactions (id, business_id, user_id, type, source, currency, amount, description, category, date, created_at)
    SELECT id, business_id, user_id, type, source, 'PKR', amount, description, category, date, created_at
    FROM transactions_backup
  `);

  db.exec(`DROP TABLE transactions_backup`);

  console.log('Migration completed successfully! All existing transactions set to PKR.');
});

migrate();
