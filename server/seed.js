const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('Seeding database...');

const seed = db.transaction(() => {
  // Clear existing data
  db.exec(`
    DELETE FROM employee_expenses;
    DELETE FROM employee_budgets;
    DELETE FROM employees;
    DELETE FROM transactions;
    DELETE FROM business_partners;
    DELETE FROM businesses;
    DELETE FROM users;
  `);

  // Create partners
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const akram = db.prepare('INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)')
    .run('Akram', 'akram', hash('akram123'), 'partner');
  const sajid = db.prepare('INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)')
    .run('Sajid', 'sajid', hash('sajid123'), 'partner');
  const hammad = db.prepare('INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)')
    .run('Hammad', 'hammad', hash('hammad123'), 'partner');

  // Create businesses
  const inparlor = db.prepare('INSERT INTO businesses (name, has_combined_account, default_currency) VALUES (?, ?, ?)')
    .run('InParlor', 1, 'PKR');
  const tpt = db.prepare('INSERT INTO businesses (name, has_combined_account, default_currency) VALUES (?, ?, ?)')
    .run('TPT', 0, 'PKR');
  const gbpAccount = db.prepare('INSERT INTO businesses (name, has_combined_account, default_currency) VALUES (?, ?, ?)')
    .run('GBP Account', 0, 'GBP');

  // Business partners
  // InParlor: Akram, Sajid, Hammad - 33.33% each
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)')
    .run(inparlor.lastInsertRowid, akram.lastInsertRowid, 33.33);
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)')
    .run(inparlor.lastInsertRowid, sajid.lastInsertRowid, 33.33);
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)')
    .run(inparlor.lastInsertRowid, hammad.lastInsertRowid, 33.34);

  // TPT: Akram, Sajid - 50% each
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)')
    .run(tpt.lastInsertRowid, akram.lastInsertRowid, 50);
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)')
    .run(tpt.lastInsertRowid, sajid.lastInsertRowid, 50);

  // GBP Account: All 3 partners - 33.33% each
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)')
    .run(gbpAccount.lastInsertRowid, akram.lastInsertRowid, 33.33);
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)')
    .run(gbpAccount.lastInsertRowid, sajid.lastInsertRowid, 33.33);
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)')
    .run(gbpAccount.lastInsertRowid, hammad.lastInsertRowid, 33.34);

  console.log('Partners created:');
  console.log('  Akram  - username: akram, password: akram123');
  console.log('  Sajid  - username: sajid, password: sajid123');
  console.log('  Hammad - username: hammad, password: hammad123');
  console.log('');
  console.log('Businesses:');
  console.log('  InParlor (Akram, Sajid, Hammad) - with combined account (Kiddie Tube)');
  console.log('  TPT (Akram, Sajid)');
  console.log('  GBP Account (Akram, Sajid, Hammad) - GBP currency');
});

seed();
console.log('Database seeded successfully!');
