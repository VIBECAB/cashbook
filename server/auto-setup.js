// Auto-setup: runs seed + migrations if database is empty
const db = require('./db');

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

if (userCount === 0) {
  console.log('Empty database detected. Running seed...');
  require('./seed');

  console.log('Running import-data...');
  require('./import-data');

  console.log('Running currency migration...');
  require('./migrate-currency');

  console.log('Running GBP business migration...');
  require('./migrate-gbp-business');

  console.log('Auto-setup complete!');
} else {
  console.log('Database already has data, skipping auto-setup.');
}
