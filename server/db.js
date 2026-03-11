require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const { Pool, types } = require('pg');

// Return DATE columns as 'YYYY-MM-DD' strings, not Date objects
types.setTypeParser(1082, val => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false }
});

const db = {
  query: (sql, params) => pool.query(sql, params),
  get: async (sql, params = []) => {
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  },
  all: async (sql, params = []) => {
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  exec: (sql) => pool.query(sql),
  pool
};

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'partner',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      has_combined_account INTEGER DEFAULT 0,
      default_currency TEXT NOT NULL DEFAULT 'PKR',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS business_partners (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      share_percentage NUMERIC NOT NULL,
      UNIQUE(business_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'withdrawal')),
      source TEXT NOT NULL DEFAULT 'personal' CHECK(source IN ('personal', 'combined')),
      currency TEXT NOT NULL DEFAULT 'PKR' CHECK(currency IN ('PKR', 'GBP')),
      amount NUMERIC NOT NULL CHECK(amount > 0),
      description TEXT,
      category TEXT,
      date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      created_by INTEGER NOT NULL REFERENCES users(id),
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employee_budgets (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      partner_id INTEGER NOT NULL REFERENCES users(id),
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      amount NUMERIC NOT NULL CHECK(amount > 0),
      description TEXT,
      date DATE NOT NULL,
      transaction_id INTEGER REFERENCES transactions(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employee_expenses (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      amount NUMERIC NOT NULL CHECK(amount > 0),
      description TEXT,
      date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employee_advances (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      partner_id INTEGER NOT NULL REFERENCES users(id),
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      amount NUMERIC NOT NULL CHECK(amount > 0),
      description TEXT,
      date DATE NOT NULL,
      settled INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS partner_ledger (
      id SERIAL PRIMARY KEY,
      created_by INTEGER NOT NULL REFERENCES users(id),
      partner_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
      amount NUMERIC NOT NULL CHECK(amount > 0),
      description TEXT,
      date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

db.initDb = initDb;
module.exports = db;
