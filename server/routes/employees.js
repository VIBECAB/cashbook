const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, partnerOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get employees for a business
router.get('/', (req, res) => {
  const { business_id } = req.query;
  if (!business_id) return res.status(400).json({ error: 'business_id required' });

  if (req.user.role === 'partner') {
    const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
      .get(business_id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access' });
  }

  const employees = db.prepare(`
    SELECT e.id, e.name, e.username, e.business_id, e.active, e.created_at,
      u.name as created_by_name,
      COALESCE((SELECT SUM(amount) FROM employee_budgets WHERE employee_id = e.id), 0) as total_budget,
      COALESCE((SELECT SUM(amount) FROM employee_expenses WHERE employee_id = e.id), 0) as total_spent
    FROM employees e
    JOIN users u ON e.created_by = u.id
    WHERE e.business_id = ?
    ORDER BY e.active DESC, e.name
  `).all(business_id);

  res.json(employees);
});

// Create employee
router.post('/', partnerOnly, (req, res) => {
  const { name, username, password, business_id } = req.body;
  if (!name || !username || !password || !business_id) {
    return res.status(400).json({ error: 'name, username, password, business_id required' });
  }

  const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
    .get(business_id, req.user.id);
  if (!access) return res.status(403).json({ error: 'No access' });

  // Check username uniqueness across both tables
  const existingUser = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  const existingEmp = db.prepare('SELECT 1 FROM employees WHERE username = ?').get(username);
  if (existingUser || existingEmp) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO employees (name, username, password, business_id, created_by) VALUES (?, ?, ?, ?, ?)
  `).run(name, username, hashed, business_id, req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, name, username, business_id });
});

// Give budget to employee
router.post('/:id/budget', partnerOnly, (req, res) => {
  const { amount, description, date, business_id } = req.body;
  if (!amount || !date || !business_id) {
    return res.status(400).json({ error: 'amount, date, business_id required' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
    .get(business_id, req.user.id);
  if (!access) return res.status(403).json({ error: 'No access' });

  // Use a transaction to ensure atomicity
  const giveBudget = db.transaction(() => {
    // 1. Log expense for the partner
    const txResult = db.prepare(`
      INSERT INTO transactions (business_id, user_id, type, source, amount, description, category, date)
      VALUES (?, ?, 'expense', 'personal', ?, ?, 'Employee Budget', ?)
    `).run(business_id, req.user.id, amount, `Budget given to ${employee.name}: ${description || ''}`, date);

    // 2. Log budget for the employee
    db.prepare(`
      INSERT INTO employee_budgets (employee_id, partner_id, business_id, amount, description, date, transaction_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(employee.id, req.user.id, business_id, amount, description || '', date, txResult.lastInsertRowid);

    return txResult.lastInsertRowid;
  });

  const txId = giveBudget();
  res.status(201).json({ success: true, transaction_id: txId });
});

// Get employee budgets
router.get('/:id/budgets', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const budgets = db.prepare(`
    SELECT eb.*, u.name as partner_name
    FROM employee_budgets eb
    JOIN users u ON eb.partner_id = u.id
    WHERE eb.employee_id = ?
    ORDER BY eb.date DESC
  `).all(req.params.id);

  res.json(budgets);
});

// Get employee expenses
router.get('/:id/expenses', (req, res) => {
  const expenses = db.prepare(`
    SELECT * FROM employee_expenses WHERE employee_id = ? ORDER BY date DESC
  `).all(req.params.id);

  res.json(expenses);
});

// Post employee expense (can be done by employee themselves or partner)
router.post('/:id/expenses', (req, res) => {
  const { amount, description, date } = req.body;
  if (!amount || !date) {
    return res.status(400).json({ error: 'amount and date required' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // Check if the logged-in user is this employee or a partner with access
  if (req.user.role === 'employee' && req.user.id !== employee.id) {
    return res.status(403).json({ error: 'Cannot post expenses for another employee' });
  }

  if (req.user.role === 'partner') {
    const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
      .get(employee.business_id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access' });
  }

  // Check remaining budget
  const totalBudget = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM employee_budgets WHERE employee_id = ?')
    .get(employee.id).total;
  const totalSpent = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM employee_expenses WHERE employee_id = ?')
    .get(employee.id).total;
  const remaining = totalBudget - totalSpent;

  if (amount > remaining) {
    return res.status(400).json({ error: `Insufficient budget. Remaining: ${remaining.toFixed(2)}` });
  }

  db.prepare(`
    INSERT INTO employee_expenses (employee_id, business_id, amount, description, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(employee.id, employee.business_id, amount, description || '', date);

  res.status(201).json({ success: true });
});

// Toggle employee active status
router.patch('/:id/toggle', partnerOnly, (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
    .get(employee.business_id, req.user.id);
  if (!access) return res.status(403).json({ error: 'No access' });

  db.prepare('UPDATE employees SET active = ? WHERE id = ?').run(employee.active ? 0 : 1, employee.id);
  res.json({ success: true, active: !employee.active });
});

module.exports = router;
