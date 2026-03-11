require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('../server/db');

const authRoutes = require('../server/routes/auth');
const transactionRoutes = require('../server/routes/transactions');
const employeeRoutes = require('../server/routes/employees');
const analyticsRoutes = require('../server/routes/analytics');
const businessRoutes = require('../server/routes/businesses');
const ledgerRoutes = require('../server/routes/ledger');

const app = express();

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);

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
    res.status(500).json({ error: 'Internal server error' });
  }
};
