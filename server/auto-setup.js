const db = require('./db');

async function autoSetup() {
  await db.initDb();

  const result = await db.get('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(result.count);

  if (userCount === 0) {
    console.log('Empty database detected. Running seed...');
    const seed = require('./seed');
    await seed();

    console.log('Running import-data...');
    const importData = require('./import-data');
    await importData();

    console.log('Auto-setup complete!');
  } else {
    console.log('Database already has data, skipping auto-setup.');
  }
}

autoSetup().catch(err => { console.error('Auto-setup failed:', err); process.exit(1); });
