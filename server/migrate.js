const db = require('./db');

console.log('Running migration: add withdrawal type to transactions...');

// SQLite doesn't support ALTER CHECK, so we recreate the table
const migrate = db.transaction(() => {
  // Check if migration is needed
  try {
    db.prepare("INSERT INTO transactions (business_id, user_id, type, source, amount, description, category, date) VALUES (1, 1, 'withdrawal', 'combined', 1, 'test', '', '2026-01-01')").run();
    // If it worked, delete the test row and we're good
    db.prepare("DELETE FROM transactions WHERE description = 'test' AND type = 'withdrawal' AND amount = 1").run();
    console.log('Migration not needed - withdrawal type already supported.');
    return;
  } catch (e) {
    console.log('Migrating transactions table...');
  }

  // Backup data
  db.exec(`CREATE TABLE transactions_backup AS SELECT * FROM transactions`);

  // Drop old table
  db.exec(`DROP TABLE transactions`);

  // Create new table with updated CHECK
  db.exec(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      user_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'withdrawal')),
      source TEXT NOT NULL DEFAULT 'personal' CHECK(source IN ('personal', 'combined')),
      amount REAL NOT NULL CHECK(amount > 0),
      description TEXT,
      category TEXT,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Restore data
  db.exec(`
    INSERT INTO transactions (id, business_id, user_id, type, source, amount, description, category, date, created_at)
    SELECT id, business_id, user_id, type, source, amount, description, category, date, created_at
    FROM transactions_backup
  `);

  db.exec(`DROP TABLE transactions_backup`);

  console.log('Migration completed successfully!');
});

migrate();
