require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('../server/db');

const authRoutes = require('../server/routes/auth');
const transactionRoutes = require('../server/routes/transactions');
const employeeRoutes = require('../server/routes/employees');
const analyticsRoutes = require('../server/routes/analytics');
const businessRoutes = require('../server/routes/businesses');
const ledgerRoutes = require('../server/routes/ledger');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/ledger', ledgerRoutes);

let dbInitialized = false;

module.exports = async (req, res) => {
  try {
    if (!dbInitialized) {
      await db.initDb();
      dbInitialized = true;
    }
    app(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
