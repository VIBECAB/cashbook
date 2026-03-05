const express = require('express');
const db = require('../db');
const { authMiddleware, partnerOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get transactions for a business
router.get('/', async (req, res) => {
  try {
    const { business_id, month, year, type, currency } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id required' });

    // Verify access
    if (req.user.role === 'partner') {
      const access = await db.get(
        'SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
        [business_id, req.user.id]
      );
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
      WHERE t.business_id = $1
    `;
    const params = [business_id];
    let paramIndex = 2;

    if (month && year) {
      query += ` AND TO_CHAR(t.date, 'MM') = $${paramIndex} AND TO_CHAR(t.date, 'YYYY') = $${paramIndex + 1}`;
      params.push(month.padStart(2, '0'), year);
      paramIndex += 2;
    }

    if (type) {
      query += ` AND t.type = $${paramIndex}`;
      params.push(type);
      paramIndex += 1;
    }

    if (currency) {
      query += ` AND t.currency = $${paramIndex}`;
      params.push(currency);
      paramIndex += 1;
    }

    query += ` ORDER BY t.date DESC, t.created_at DESC`;

    const transactions = await db.all(query, params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add transaction
router.post('/', partnerOnly, async (req, res) => {
  try {
    const { business_id, type, source, currency, amount, description, category, date } = req.body;

    if (!business_id || !type || !amount || !date) {
      return res.status(400).json({ error: 'business_id, type, amount, and date are required' });
    }

    const access = await db.get(
      'SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
      [business_id, req.user.id]
    );
    if (!access) return res.status(403).json({ error: 'No access to this business' });

    // Only businesses with combined account can have combined source or withdrawals
    const txSource = source || 'personal';
    if (txSource === 'combined' || type === 'withdrawal') {
      const biz = await db.get(
        'SELECT has_combined_account FROM businesses WHERE id = $1',
        [business_id]
      );
      if (!biz || !biz.has_combined_account) {
        return res.status(400).json({ error: 'This business does not have a combined account' });
      }
    }

    // Withdrawals are always from combined, attributed to a partner
    const finalSource = type === 'withdrawal' ? 'combined' : txSource;
    const userId = (txSource === 'combined' && type !== 'withdrawal') ? null : req.user.id;

    const txCurrency = currency || 'PKR';

    const result = await db.get(`
      INSERT INTO transactions (business_id, user_id, type, source, currency, amount, description, category, date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [business_id, userId, type, finalSource, txCurrency, amount, description || '', category || '', date]);

    const transaction = await db.get(
      'SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = $1',
      [result.id]
    );

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update transaction (only by the partner who created it)
router.put('/:id', partnerOnly, async (req, res) => {
  try {
    const tx = await db.get('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    if (tx.user_id !== req.user.id && tx.source !== 'combined') {
      return res.status(403).json({ error: 'Only the creator can edit this entry' });
    }

    // Combined income (user_id is null) can be edited by any partner with access
    const access = await db.get(
      'SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
      [tx.business_id, req.user.id]
    );
    if (!access) return res.status(403).json({ error: 'No access' });

    const { amount, description, category, date } = req.body;
    await db.query(`
      UPDATE transactions SET amount = $1, description = $2, category = $3, date = $4 WHERE id = $5
    `, [
      amount || tx.amount,
      description ?? tx.description,
      category ?? tx.category,
      date || tx.date,
      tx.id
    ]);

    const updated = await db.get(
      'SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = $1',
      [tx.id]
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete transaction (only by the partner who created it)
router.delete('/:id', partnerOnly, async (req, res) => {
  try {
    const tx = await db.get('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    if (tx.user_id !== req.user.id && tx.source !== 'combined') {
      return res.status(403).json({ error: 'Only the creator can delete this entry' });
    }

    const access = await db.get(
      'SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
      [tx.business_id, req.user.id]
    );
    if (!access) return res.status(403).json({ error: 'No access' });

    const linkedBudget = await db.get(
      'SELECT id FROM employee_budgets WHERE transaction_id = $1',
      [tx.id]
    );
    if (linkedBudget) {
      return res.status(400).json({ error: 'Cannot delete: this transaction is linked to an employee budget' });
    }

    await db.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
