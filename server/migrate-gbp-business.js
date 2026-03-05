const db = require('./db');

console.log('Adding GBP Account as separate business...');

const migrate = db.transaction(() => {
  // Check if already exists
  const existing = db.prepare("SELECT id FROM businesses WHERE name = 'GBP Account'").get();
  if (existing) {
    console.log('GBP Account business already exists (id:', existing.id, ')');
    return;
  }

  // Get all 3 partners
  const akram = db.prepare("SELECT id FROM users WHERE username = 'akram'").get();
  const sajid = db.prepare("SELECT id FROM users WHERE username = 'sajid'").get();
  const hammad = db.prepare("SELECT id FROM users WHERE username = 'hammad'").get();

  if (!akram || !sajid || !hammad) {
    console.error('Could not find all partners. Run seed first.');
    return;
  }

  // Create GBP Account business (no combined account - it IS the account)
  const result = db.prepare("INSERT INTO businesses (name, has_combined_account) VALUES (?, ?)").run('GBP Account', 0);
  const bizId = result.lastInsertRowid;

  // Add all 3 partners at 33.33% each
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)').run(bizId, akram.id, 33.33);
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)').run(bizId, sajid.id, 33.33);
  db.prepare('INSERT INTO business_partners (business_id, user_id, share_percentage) VALUES (?, ?, ?)').run(bizId, hammad.id, 33.34);

  console.log('GBP Account created (id:', bizId, ') with partners: Akram, Sajid, Hammad');
});

migrate();
