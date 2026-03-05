const db = require('./db');

async function importData() {
  // Get user IDs
  const akram = await db.get("SELECT id FROM users WHERE username = 'akram'");
  const sajid = await db.get("SELECT id FROM users WHERE username = 'sajid'");
  const hammad = await db.get("SELECT id FROM users WHERE username = 'hammad'");
  const inparlor = await db.get("SELECT id FROM businesses WHERE name = 'InParlor'");
  const tpt = await db.get("SELECT id FROM businesses WHERE name = 'TPT'");

  console.log('User IDs:', { akram: akram.id, sajid: sajid.id, hammad: hammad.id });
  console.log('InParlor ID:', inparlor.id);
  console.log('TPT ID:', tpt.id);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM partner_ledger');
    await client.query('DELETE FROM employee_expenses');
    await client.query('DELETE FROM employee_budgets');
    await client.query('DELETE FROM transactions');

    let count = 0;

    // ============================================================
    // Sajid Credit Card Visa (Sajid owes Akram)
    // ============================================================
    const sajidEntries = [
      { date: '2025-03-01', desc: 'Paid to usaf', type: 'debit', amount: 60000 },
      { date: '2025-03-05', desc: 'Sajid ne transfer kie', type: 'debit', amount: 140000 },
      { date: '2025-03-13', desc: 'Sajid ko transfer kie', type: 'credit', amount: 150000 },
      { date: '2025-03-18', desc: 'Credit card bill', type: 'credit', amount: 329534 },
      { date: '2025-03-22', desc: 'Sajid ko transfer kie', type: 'credit', amount: 50000 },
      { date: '2025-03-25', desc: 'Sajid has to pay for march payment', type: 'credit', amount: 13439 },
      { date: '2025-03-28', desc: 'Sajid ne die', type: 'debit', amount: 450000 },
      { date: '2025-03-28', desc: 'Adnan transfer', type: 'debit', amount: 20000 },
      { date: '2025-04-05', desc: 'Credit card', type: 'credit', amount: 292297 },
      { date: '2025-04-14', desc: 'Sajid se cash lia', type: 'debit', amount: 10000 },
      { date: '2025-04-14', desc: 'Hammad loss adjustment', type: 'debit', amount: 109505 },
      { date: '2025-04-21', desc: 'Alto installment', type: 'credit', amount: 62000 },
      { date: '2025-04-21', desc: 'Rana return money', type: 'credit', amount: 75000 },
      { date: '2025-04-25', desc: 'Sajid ko dene hain. April income', type: 'debit', amount: 1105030 },
      { date: '2025-05-09', desc: 'Sajid credit card bill', type: 'credit', amount: 151595 },
      { date: '2025-05-14', desc: 'Rani donation', type: 'credit', amount: 5000 },
      { date: '2025-05-14', desc: 'Suleman food and travel', type: 'credit', amount: 5000 },
      { date: '2025-05-15', desc: 'Milk rana', type: 'credit', amount: 62000 },
      { date: '2025-05-17', desc: 'Transfer', type: 'credit', amount: 50000 },
      { date: '2025-05-21', desc: 'Mama advance', type: 'credit', amount: 25000 },
      { date: '2025-05-27', desc: 'Sajid ko dene income may', type: 'debit', amount: 200756 },
      { date: '2025-05-27', desc: 'Rent DHA upto April 2025', type: 'credit', amount: 1200000 },
      { date: '2025-05-27', desc: '503 office advance return', type: 'debit', amount: 37500 },
      { date: '2025-06-04', desc: 'Sajid qurbani', type: 'credit', amount: 546750 },
      { date: '2025-06-05', desc: 'Sajid ko cash dia', type: 'credit', amount: 100000 },
      { date: '2025-06-21', desc: 'Credit card bill may', type: 'credit', amount: 79592 },
      { date: '2025-06-26', desc: 'Patreon share', type: 'debit', amount: 637584 },
      { date: '2025-06-26', desc: 'Sajid has to pay for june tpt', type: 'credit', amount: 311586 },
      { date: '2025-06-26', desc: 'Loss june 2025', type: 'credit', amount: 83785 },
      { date: '2025-07-07', desc: 'Rent dha', type: 'credit', amount: 60000 },
      { date: '2025-07-07', desc: 'Credit card bill', type: 'credit', amount: 150756 },
      { date: '2025-07-14', desc: 'Sajid card use', type: 'debit', amount: 15950 },
      { date: '2025-07-29', desc: 'Remaining balance july', type: 'credit', amount: 400000 },
      { date: '2025-07-31', desc: 'Cash', type: 'debit', amount: 200000 },
      { date: '2025-07-31', desc: 'Cash', type: 'debit', amount: 100000 },
      { date: '2025-08-04', desc: 'Cash', type: 'debit', amount: 100000 },
      { date: '2025-08-06', desc: 'Sajid card use', type: 'credit', amount: 203816 },
      { date: '2025-08-06', desc: 'Rent home', type: 'credit', amount: 60000 },
      { date: '2025-08-16', desc: 'Patreon', type: 'debit', amount: 1040600 },
      { date: '2025-08-21', desc: '5 5 kr k lia', type: 'debit', amount: 10000 },
      { date: '2025-08-27', desc: 'August tpt income', type: 'credit', amount: 550418 },
      { date: '2025-09-06', desc: 'September rent', type: 'credit', amount: 60000 },
      { date: '2025-09-08', desc: 'Credit card', type: 'credit', amount: 227615 },
      { date: '2025-09-23', desc: 'Sajid cash lia', type: 'debit', amount: 500000 },
      { date: '2025-09-30', desc: 'September income TPT', type: 'credit', amount: 725371 },
      { date: '2025-09-30', desc: 'Income TT', type: 'debit', amount: 171218 },
      { date: '2025-10-05', desc: 'Credit card bill hammad', type: 'debit', amount: 31000 },
      { date: '2025-10-10', desc: 'Rent october', type: 'credit', amount: 60000 },
      { date: '2025-11-01', desc: 'Cash plus hammad 50', type: 'debit', amount: 450000 },
      { date: '2025-11-01', desc: 'Rent november', type: 'credit', amount: 60000 },
      { date: '2025-11-03', desc: 'October income', type: 'credit', amount: 754907 },
      { date: '2025-11-03', desc: 'Loss TT october', type: 'credit', amount: 25351 },
      { date: '2025-11-10', desc: 'Hammad card bill', type: 'debit', amount: 57492 },
      { date: '2025-11-14', desc: 'Transfer', type: 'credit', amount: 100000 },
      { date: '2025-11-18', desc: 'Patreon', type: 'debit', amount: 625486 },
      { date: '2025-12-01', desc: 'November earning', type: 'credit', amount: 468823 },
      { date: '2025-12-01', desc: 'Cash', type: 'debit', amount: 200000 },
      { date: '2025-12-01', desc: 'Tt loss', type: 'credit', amount: 3076 },
      { date: '2025-12-01', desc: 'Rent december', type: 'credit', amount: 60000 },
      { date: '2025-12-07', desc: 'Hammad credit cards bill', type: 'debit', amount: 73938 },
      { date: '2025-12-31', desc: 'TT income december', type: 'debit', amount: 117959 },
      { date: '2025-12-31', desc: 'Tpt income', type: 'credit', amount: 57099 },
      { date: '2026-01-02', desc: 'Rent sajid', type: 'credit', amount: 60000 },
      { date: '2026-01-05', desc: 'Credit card bill', type: 'credit', amount: 230217 },
      { date: '2026-01-05', desc: 'Patreon', type: 'debit', amount: 380535 },
      { date: '2026-01-26', desc: 'Tt income', type: 'debit', amount: 97176 },
      { date: '2026-01-26', desc: 'Adjust', type: 'credit', amount: 8026 },
      { date: '2026-02-17', desc: 'Rent', type: 'credit', amount: 60000 },
      { date: '2026-02-17', desc: 'CC adjustment', type: 'debit', amount: 69111 },
      { date: '2026-03-02', desc: 'Loss feb', type: 'credit', amount: 252921 },
      { date: '2026-03-05', desc: 'Rent', type: 'credit', amount: 60000 },
    ];

    console.log(`\nInserting ${sajidEntries.length} Sajid ledger entries...`);
    for (const e of sajidEntries) {
      await client.query(
        'INSERT INTO partner_ledger (created_by, partner_id, type, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6)',
        [akram.id, sajid.id, e.type, e.amount, e.desc, e.date]
      );
      count++;
    }

    const sajidCredits = sajidEntries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
    const sajidDebits = sajidEntries.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0);
    console.log(`  Credits (Sajid owes): ${sajidCredits} | Debits (paid back): ${sajidDebits}`);
    console.log(`  Net: ${sajidCredits - sajidDebits} (should be 1280134)`);

    // ============================================================
    // Hammad Credit Cards (Hammad owes Akram)
    // ============================================================
    const hammadEntries = [
      { date: '2025-03-07', desc: 'Perfumes', type: 'credit', amount: 6700 },
      { date: '2025-03-18', desc: 'American Express', type: 'credit', amount: 8187 },
      { date: '2025-03-25', desc: 'Loss Automation upto March', type: 'credit', amount: 219011 },
      { date: '2025-03-25', desc: 'Cash given Hammad', type: 'credit', amount: 500000 },
      { date: '2025-04-05', desc: 'Credit card upto 3 april', type: 'credit', amount: 137026 },
      { date: '2025-04-25', desc: 'April income', type: 'debit', amount: 1156477 },
      { date: '2025-04-25', desc: 'Hammad', type: 'credit', amount: 300000 },
      { date: '2025-05-09', desc: 'Credit card bill', type: 'credit', amount: 166918 },
      { date: '2025-05-27', desc: 'Income', type: 'debit', amount: 512342 },
      { date: '2025-05-27', desc: 'Hammad pay akram give', type: 'credit', amount: 500000 },
      { date: '2025-06-06', desc: 'Hammad se lie. Card k through tv', type: 'debit', amount: 38000 },
      { date: '2025-06-21', desc: 'Credit card bill May', type: 'credit', amount: 105434 },
      { date: '2025-06-25', desc: 'Hammad se lie', type: 'debit', amount: 30000 },
      { date: '2025-06-26', desc: 'Loss june', type: 'credit', amount: 83785 },
      { date: '2025-06-26', desc: 'Hammad june advance payment', type: 'credit', amount: 300000 },
      { date: '2025-07-07', desc: 'Credit card bill', type: 'credit', amount: 13049 },
      { date: '2025-08-06', desc: 'Hammad card payment', type: 'credit', amount: 6650 },
      { date: '2025-09-08', desc: 'Credit card', type: 'credit', amount: 5118 },
      { date: '2025-09-10', desc: 'Hammad ko die', type: 'credit', amount: 200000 },
      { date: '2025-09-22', desc: 'Transfer', type: 'credit', amount: 30000 },
      { date: '2025-09-22', desc: 'Hammad cash', type: 'credit', amount: 10000 },
      { date: '2025-09-22', desc: 'Hammad tax', type: 'credit', amount: 19913 },
      { date: '2025-09-30', desc: 'Income september TT', type: 'debit', amount: 171218 },
      { date: '2025-10-05', desc: 'Credit card bill', type: 'credit', amount: 24722 },
      { date: '2025-10-17', desc: 'Hammad', type: 'credit', amount: 100000 },
      { date: '2025-11-01', desc: 'Sajid transfer', type: 'credit', amount: 50000 },
      { date: '2025-11-03', desc: 'Loss october TT', type: 'credit', amount: 25351 },
      { date: '2025-11-10', desc: 'Credit card bill', type: 'credit', amount: 51217 },
      { date: '2025-12-01', desc: 'TT loss', type: 'credit', amount: 3076 },
      { date: '2025-12-03', desc: 'Cash december', type: 'credit', amount: 200000 },
      { date: '2025-12-07', desc: 'Credit card', type: 'credit', amount: 73938 },
      { date: '2025-12-31', desc: 'TT income december', type: 'debit', amount: 117959 },
      { date: '2025-12-31', desc: 'Hammad personal', type: 'credit', amount: 100000 },
      { date: '2026-01-05', desc: 'Credit card', type: 'credit', amount: 74772 },
      { date: '2026-01-07', desc: 'Hammad', type: 'credit', amount: 100000 },
      { date: '2026-01-26', desc: 'Income jan upto 26 jan', type: 'debit', amount: 97176 },
      { date: '2026-01-28', desc: 'Sajid transfer', type: 'credit', amount: 150000 },
      { date: '2026-02-13', desc: 'Hammad', type: 'credit', amount: 25000 },
      { date: '2026-02-17', desc: 'Credit card', type: 'credit', amount: 69111 },
      { date: '2026-03-02', desc: 'Loss feb', type: 'credit', amount: 252921 },
    ];

    console.log(`\nInserting ${hammadEntries.length} Hammad ledger entries...`);
    for (const e of hammadEntries) {
      await client.query(
        'INSERT INTO partner_ledger (created_by, partner_id, type, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6)',
        [akram.id, hammad.id, e.type, e.amount, e.desc, e.date]
      );
      count++;
    }

    const hammadCredits = hammadEntries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
    const hammadDebits = hammadEntries.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0);
    console.log(`  Credits (Hammad owes): ${hammadCredits} | Debits (paid back): ${hammadDebits}`);
    console.log(`  Net: ${hammadCredits - hammadDebits} (should be 1788727)`);

    // ============================================================
    // Office Register - Expenses
    // ============================================================
    console.log('\nInserting InParlor + TPT expense entries by Akram...');

    // Net bill stays in InParlor
    await client.query(
      'INSERT INTO transactions (business_id, user_id, type, source, amount, description, category, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [inparlor.id, akram.id, 'expense', 'personal', 6272, 'Net bill', 'Utilities', '2026-03-05']
    );
    count++;

    // Sajid TPT expenses (11 entries, Rs 250,400)
    const sajidTPT = [
      { date: '2026-03-02', desc: 'Adv Junaid milk bill', amount: 16000, cat: 'Supplies' },
      { date: '2026-03-02', desc: 'Rana nadeem salary', amount: 31000, cat: 'Salary' },
      { date: '2026-03-02', desc: 'Raffique salary', amount: 43000, cat: 'Salary' },
      { date: '2026-03-02', desc: 'Gull sher salary', amount: 30000, cat: 'Salary' },
      { date: '2026-03-02', desc: 'Tahir salary', amount: 30000, cat: 'Salary' },
      { date: '2026-03-02', desc: 'Ofc milk bill 3kg', amount: 14000, cat: 'Supplies' },
      { date: '2026-03-02', desc: 'Irfan salary', amount: 45000, cat: 'Salary' },
      { date: '2026-03-02', desc: 'Gl', amount: 600, cat: 'Miscellaneous' },
      { date: '2026-03-03', desc: 'Junaid salary', amount: 30000, cat: 'Salary' },
      { date: '2026-03-04', desc: 'Ofc net', amount: 9300, cat: 'Utilities' },
      { date: '2026-03-04', desc: 'Ofc kharcha', amount: 1500, cat: 'Miscellaneous' },
    ];
    console.log('\nInserting 11 Sajid TPT expense entries...');
    for (const e of sajidTPT) {
      await client.query(
        'INSERT INTO transactions (business_id, user_id, type, source, currency, amount, description, category, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [tpt.id, sajid.id, 'expense', 'personal', 'PKR', e.amount, e.desc, e.cat, e.date]
      );
      count++;
    }

    // Junaid entries go to TPT
    await client.query(
      'INSERT INTO transactions (business_id, user_id, type, source, amount, description, category, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [tpt.id, akram.id, 'expense', 'personal', 5000, 'Junaid kharcha', 'Miscellaneous', '2026-03-02']
    );
    count++;

    await client.query(
      'INSERT INTO transactions (business_id, user_id, type, source, amount, description, category, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [tpt.id, akram.id, 'expense', 'personal', 2000, 'Junaid advance', 'Miscellaneous', '2026-03-03']
    );
    count++;

    await client.query('COMMIT');

    console.log(`\nTotal entries inserted: ${count}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Verify
  const sajidNet = await db.get(`
    SELECT
      COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END), 0) as credits,
      COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END), 0) as debits
    FROM partner_ledger WHERE created_by = $1 AND partner_id = $2
  `, [akram.id, sajid.id]);
  console.log(`\nSajid owes Akram: Rs ${parseFloat(sajidNet.credits) - parseFloat(sajidNet.debits)} (expected: 1280134)`);

  const hammadNet = await db.get(`
    SELECT
      COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END), 0) as credits,
      COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END), 0) as debits
    FROM partner_ledger WHERE created_by = $1 AND partner_id = $2
  `, [akram.id, hammad.id]);
  console.log(`Hammad owes Akram: Rs ${parseFloat(hammadNet.credits) - parseFloat(hammadNet.debits)} (expected: 1788727)`);

  console.log('\nData import completed successfully!');
}

if (require.main === module) {
  importData().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  module.exports = importData;
}
