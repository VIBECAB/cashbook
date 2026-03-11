const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('Seeding database...');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM employee_expenses');
    await client.query('DELETE FROM employee_budgets');
    await client.query('DELETE FROM employees');
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM partner_ledger');
    await client.query('DELETE FROM business_partners');
    await client.query('DELETE FROM businesses');
    await client.query('DELETE FROM users');

    // Create partners
    const hash = (pw) => bcrypt.hashSync(pw, 10);

    const { rows: [akram] } = await client.query(
      'INSERT INTO users (name, username, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Akram', 'akram', hash('akram123'), 'partner']
    );
    const { rows: [sajid] } = await client.query(
      'INSERT INTO users (name, username, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Sajid', 'sajid', hash('sajid123'), 'partner']
    );
    const { rows: [hammad] } = await client.query(
      'INSERT INTO users (name, username, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Hammad', 'hammad', hash('hammad123'), 'partner']
    );

    // Create businesses
    const { rows: [inparlor] } = await client.query(
      'INSERT INTO businesses (name, has_combined_account, default_currency) VALUES ($1, $2, $3) RETURNING id',
      ['InParlor', 1, 'PKR']
    );
    const { rows: [tpt] } = await client.query(
      'INSERT INTO businesses (name, has_combined_account, default_currency) VALUES ($1, $2, $3) RETURNING id',
      ['TPT', 0, 'PKR']
    );
    const { rows: [gbpAccount] } = await client.query(
      'INSERT INTO businesses (name, has_combined_account, default_currency) VALUES ($1, $2, $3) RETURNING id',
      ['GBP Account', 0, 'GBP']
    );

    // Business partners
    // InParlor: Akram, Sajid, Hammad - 33.33% each
    await client.query('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES ($1, $2, $3)',
      [inparlor.id, akram.id, 33.33]);
    await client.query('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES ($1, $2, $3)',
      [inparlor.id, sajid.id, 33.33]);
    await client.query('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES ($1, $2, $3)',
      [inparlor.id, hammad.id, 33.34]);

    // TPT: Akram, Sajid - 50% each
    await client.query('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES ($1, $2, $3)',
      [tpt.id, akram.id, 50]);
    await client.query('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES ($1, $2, $3)',
      [tpt.id, sajid.id, 50]);

    // GBP Account: All 3 partners - 33.33% each
    await client.query('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES ($1, $2, $3)',
      [gbpAccount.id, akram.id, 33.33]);
    await client.query('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES ($1, $2, $3)',
      [gbpAccount.id, sajid.id, 33.33]);
    await client.query('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES ($1, $2, $3)',
      [gbpAccount.id, hammad.id, 33.34]);

    await client.query('COMMIT');

    console.log('Partners created: Akram, Sajid, Hammad');
    console.log('Businesses: InParlor, TPT, GBP Account');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('Database seeded successfully!');
}

if (require.main === module) {
  db.initDb().then(() => seed()).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  module.exports = seed;
}
