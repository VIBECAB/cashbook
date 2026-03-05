const express = require('express');
const db = require('../db');
const { authMiddleware, partnerOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get transactions for a business
router.get('/', (req, res) => {
  const { business_id, month, year, type, currency } = req.query;
  if (!business_id) return res.status(400).json({ error: 'business_id required' });

  // Verify access
  if (req.user.role === 'partner') {
    const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
      .get(business_id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access to this business' });
  } else if (req.user.role === 'employee') {
    if (req.user.business_id != business_id) {
      return res.status(403).json({ error: 'No access to this business' });
    }
  }

  let query = `
    SELECT t.*, u.name as user_name
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.business_id = ?
  `;
  const params = [business_id];

  if (month && year) {
    query += ` AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?`;
    params.push(month.padStart(2, '0'), year);
  }

  if (type) {
    query += ` AND t.type = ?`;
    params.push(type);
  }

  if (currency) {
    query += ` AND t.currency = ?`;
    params.push(currency);
  }

  query += ` ORDER BY t.date DESC, t.created_at DESC`;

  const transactions = db.prepare(query).all(...params);
  res.json(transactions);
});

// Add transaction
router.post('/', partnerOnly, (req, res) => {
  const { business_id, type, source, currency, amount, description, category, date } = req.body;

  if (!business_id || !type || !amount || !date) {
    return res.status(400).json({ error: 'business_id, type, amount, and date are required' });
  }

  const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
    .get(business_id, req.user.id);
  if (!access) return res.status(403).json({ error: 'No access to this business' });

  // Only businesses with combined account can have combined source or withdrawals
  const txSource = source || 'personal';
  if (txSource === 'combined' || type === 'withdrawal') {
    const biz = db.prepare('SELECT has_combined_account FROM businesses WHERE id = ?').get(business_id);
    if (!biz || !biz.has_combined_account) {
      return res.status(400).json({ error: 'This business does not have a combined account' });
    }
  }

  // Withdrawals are always from combined, attributed to a partner
  const finalSource = type === 'withdrawal' ? 'combined' : txSource;
  const userId = (txSource === 'combined' && type !== 'withdrawal') ? null : req.user.id;

  const txCurrency = currency || 'PKR';

  const result = db.prepare(`
    INSERT INTO transactions (business_id, user_id, type, source, currency, amount, description, category, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(business_id, userId, type, finalSource, txCurrency, amount, description || '', category || '', date);

  const transaction = db.prepare('SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(transaction);
});

// Update transaction (only by the partner who created it)
router.put('/:id', partnerOnly, (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  if (tx.user_id !== req.user.id && tx.source !== 'combined') {
    return res.status(403).json({ error: 'Only the creator can edit this entry' });
  }

  // Combined income (user_id is null) can be edited by any partner with access
  const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
    .get(tx.business_id, req.user.id);
  if (!access) return res.status(403).json({ error: 'No access' });

  const { amount, description, category, date } = req.body;
  db.prepare(`
    UPDATE transactions SET amount = ?, description = ?, category = ?, date = ? WHERE id = ?
  `).run(
    amount || tx.amount,
    description ?? tx.description,
    category ?? tx.category,
    date || tx.date,
    tx.id
  );

  const updated = db.prepare('SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?').get(tx.id);
  res.json(updated);
});

// Delete transaction (only by the partner who created it)
router.delete('/:id', partnerOnly, (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  if (tx.user_id !== req.user.id && tx.source !== 'combined') {
    return res.status(403).json({ error: 'Only the creator can delete this entry' });
  }

  const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
    .get(tx.business_id, req.user.id);
  if (!access) return res.status(403).json({ error: 'No access' });

  const linkedBudget = db.prepare('SELECT id FROM employee_budgets WHERE transaction_id = ?').get(tx.id);
  if (linkedBudget) {
    return res.status(400).json({ error: 'Cannot delete: this transaction is linked to an employee budget' });
  }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
