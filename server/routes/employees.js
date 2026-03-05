const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, partnerOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get employees for a business
router.get('/', async (req, res) => {
  try {
    const { business_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id required' });

    if (req.user.role === 'partner') {
      const access = await db.get('SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
        [business_id, req.user.id]);
      if (!access) return res.status(403).json({ error: 'No access' });
    }

    const employees = await db.all(`
      SELECT e.id, e.name, e.username, e.business_id, e.active, e.created_at,
        u.name as created_by_name,
        COALESCE((SELECT SUM(amount) FROM employee_budgets WHERE employee_id = e.id), 0) as total_budget,
        COALESCE((SELECT SUM(amount) FROM employee_expenses WHERE employee_id = e.id), 0) as total_spent,
        COALESCE((SELECT SUM(amount) FROM employee_advances WHERE employee_id = e.id AND settled = 0), 0) as unsettled_advances
      FROM employees e
      JOIN users u ON e.created_by = u.id
      WHERE e.business_id = $1
      ORDER BY e.active DESC, e.name
    `, [business_id]);

    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create employee
router.post('/', partnerOnly, async (req, res) => {
  try {
    const { name, username, password, business_id } = req.body;
    if (!name || !username || !password || !business_id) {
      return res.status(400).json({ error: 'name, username, password, business_id required' });
    }

    const access = await db.get('SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
      [business_id, req.user.id]);
    if (!access) return res.status(403).json({ error: 'No access' });

    // Check username uniqueness across both tables
    const existingUser = await db.get('SELECT 1 FROM users WHERE username = $1', [username]);
    const existingEmp = await db.get('SELECT 1 FROM employees WHERE username = $1', [username]);
    if (existingUser || existingEmp) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const result = await db.get(`
      INSERT INTO employees (name, username, password, business_id, created_by) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [name, username, hashed, business_id, req.user.id]);

    res.status(201).json({ id: result.id, name, username, business_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Give budget to employee
router.post('/:id/budget', partnerOnly, async (req, res) => {
  try {
    const { amount, description, date, business_id } = req.body;
    if (!amount || !date || !business_id) {
      return res.status(400).json({ error: 'amount, date, business_id required' });
    }

    const employee = await db.get('SELECT * FROM employees WHERE id = $1 AND active = 1', [req.params.id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const access = await db.get('SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
      [business_id, req.user.id]);
    if (!access) return res.status(403).json({ error: 'No access' });

    // Use a transaction to ensure atomicity
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Log expense for the partner
      const txResult = await client.query(`
        INSERT INTO transactions (business_id, user_id, type, source, amount, description, category, date)
        VALUES ($1, $2, 'expense', 'personal', $3, $4, 'Employee Budget', $5)
        RETURNING id
      `, [business_id, req.user.id, amount, `Budget given to ${employee.name}: ${description || ''}`, date]);

      const txId = txResult.rows[0].id;

      // 2. Log budget for the employee
      await client.query(`
        INSERT INTO employee_budgets (employee_id, partner_id, business_id, amount, description, date, transaction_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [employee.id, req.user.id, business_id, amount, description || '', date, txId]);

      await client.query('COMMIT');
      client.release();

      res.status(201).json({ success: true, transaction_id: txId });
    } catch (e) {
      await client.query('ROLLBACK');
      client.release();
      throw e;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get employee budgets
router.get('/:id/budgets', async (req, res) => {
  try {
    const employee = await db.get('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const budgets = await db.all(`
      SELECT eb.*, u.name as partner_name
      FROM employee_budgets eb
      JOIN users u ON eb.partner_id = u.id
      WHERE eb.employee_id = $1
      ORDER BY eb.date DESC
    `, [req.params.id]);

    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get employee expenses
router.get('/:id/expenses', async (req, res) => {
  try {
    const expenses = await db.all(`
      SELECT * FROM employee_expenses WHERE employee_id = $1 ORDER BY date DESC
    `, [req.params.id]);

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post employee expense (can be done by employee themselves or partner)
router.post('/:id/expenses', async (req, res) => {
  try {
    const { amount, description, date } = req.body;
    if (!amount || !date) {
      return res.status(400).json({ error: 'amount and date required' });
    }

    const employee = await db.get('SELECT * FROM employees WHERE id = $1 AND active = 1', [req.params.id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Check if the logged-in user is this employee or a partner with access
    if (req.user.role === 'employee' && req.user.id !== employee.id) {
      return res.status(403).json({ error: 'Cannot post expenses for another employee' });
    }

    if (req.user.role === 'partner') {
      const access = await db.get('SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
        [employee.business_id, req.user.id]);
      if (!access) return res.status(403).json({ error: 'No access' });
    }

    // Check remaining budget
    const budgetRow = await db.get('SELECT COALESCE(SUM(amount), 0) as total FROM employee_budgets WHERE employee_id = $1',
      [employee.id]);
    const spentRow = await db.get('SELECT COALESCE(SUM(amount), 0) as total FROM employee_expenses WHERE employee_id = $1',
      [employee.id]);
    const totalBudget = budgetRow.total;
    const totalSpent = spentRow.total;
    const remaining = totalBudget - totalSpent;

    if (amount > remaining) {
      return res.status(400).json({ error: `Insufficient budget. Remaining: ${remaining.toFixed(2)}` });
    }

    await db.query(`
      INSERT INTO employee_expenses (employee_id, business_id, amount, description, date)
      VALUES ($1, $2, $3, $4, $5)
    `, [employee.id, employee.business_id, amount, description || '', date]);

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Give advance to employee
router.post('/:id/advance', partnerOnly, async (req, res) => {
  try {
    const { amount, description, date, business_id } = req.body;
    if (!amount || !date || !business_id) {
      return res.status(400).json({ error: 'amount, date, business_id required' });
    }

    const employee = await db.get('SELECT * FROM employees WHERE id = $1 AND active = 1', [req.params.id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const access = await db.get('SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
      [business_id, req.user.id]);
    if (!access) return res.status(403).json({ error: 'No access' });

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Log expense for the partner
      const txResult = await client.query(`
        INSERT INTO transactions (business_id, user_id, type, source, amount, description, category, date)
        VALUES ($1, $2, 'expense', 'personal', $3, $4, 'Employee Advance', $5)
        RETURNING id
      `, [business_id, req.user.id, amount, `Advance to ${employee.name}: ${description || ''}`, date]);

      // 2. Log advance for the employee
      await client.query(`
        INSERT INTO employee_advances (employee_id, partner_id, business_id, amount, description, date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [employee.id, req.user.id, business_id, amount, description || '', date]);

      await client.query('COMMIT');
      client.release();

      res.status(201).json({ success: true, transaction_id: txResult.rows[0].id });
    } catch (e) {
      await client.query('ROLLBACK');
      client.release();
      throw e;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get employee advances
router.get('/:id/advances', async (req, res) => {
  try {
    const advances = await db.all(`
      SELECT ea.*, u.name as partner_name
      FROM employee_advances ea
      JOIN users u ON ea.partner_id = u.id
      WHERE ea.employee_id = $1
      ORDER BY ea.date DESC
    `, [req.params.id]);

    res.json(advances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settle advance (deduct from next budget)
router.post('/:id/advance/:advanceId/settle', partnerOnly, async (req, res) => {
  try {
    const advance = await db.get('SELECT * FROM employee_advances WHERE id = $1 AND employee_id = $2 AND settled = 0',
      [req.params.advanceId, req.params.id]);
    if (!advance) return res.status(404).json({ error: 'Advance not found or already settled' });

    await db.query('UPDATE employee_advances SET settled = 1 WHERE id = $1', [advance.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle employee active status
router.patch('/:id/toggle', partnerOnly, async (req, res) => {
  try {
    const employee = await db.get('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const access = await db.get('SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
      [employee.business_id, req.user.id]);
    if (!access) return res.status(403).json({ error: 'No access' });

    await db.query('UPDATE employees SET active = $1 WHERE id = $2', [employee.active ? 0 : 1, employee.id]);
    res.json({ success: true, active: !employee.active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
