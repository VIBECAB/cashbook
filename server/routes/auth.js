const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Check partners first
    let user = await db.get('SELECT * FROM users WHERE username = $1', [username]);
    let role = 'partner';

    if (!user) {
      // Check employees
      user = await db.get('SELECT * FROM employees WHERE username = $1 AND active = 1', [username]);
      role = 'employee';
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokenPayload = {
      id: user.id,
      name: user.name,
      username: user.username,
      role
    };

    if (role === 'employee') {
      tokenPayload.business_id = user.business_id;
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'partner') {
      const businesses = await db.all(`
        SELECT b.*, bp.share_percentage
        FROM businesses b
        JOIN business_partners bp ON b.id = bp.business_id
        WHERE bp.user_id = $1
      `, [req.user.id]);

      return res.json({ ...req.user, businesses });
    }

    if (req.user.role === 'employee') {
      const employee = await db.get(`
        SELECT e.*, b.name as business_name
        FROM employees e
        JOIN businesses b ON e.business_id = b.id
        WHERE e.id = $1 AND e.active = 1
      `, [req.user.id]);

      if (!employee) return res.status(404).json({ error: 'Employee not found' });

      return res.json({
        ...req.user,
        business_id: employee.business_id,
        business_name: employee.business_name
      });
    }

    res.json(req.user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const table = req.user.role === 'partner' ? 'users' : 'employees';
    const user = await db.get(`SELECT * FROM ${table} WHERE id = $1`, [req.user.id]);

    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = bcrypt.hashSync(new_password, 10);
    await db.query(`UPDATE ${table} SET password = $1 WHERE id = $2`, [hashed, req.user.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
