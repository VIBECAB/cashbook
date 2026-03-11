const express = require('express');
const db = require('../db');
const { authMiddleware, partnerOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(partnerOnly);

// Get all ledger entries involving the current user (created by me or about me)
router.get('/', async (req, res) => {
  try {
    const { partner_id } = req.query;

    let entries;
    if (partner_id) {
      // Get entries between current user and a specific partner
      entries = await db.all(`
        SELECT l.*,
          creator.name as created_by_name,
          partner.name as partner_name
        FROM partner_ledger l
        JOIN users creator ON l.created_by = creator.id
        JOIN users partner ON l.partner_id = partner.id
        WHERE (l.created_by = $1 AND l.partner_id = $2)
           OR (l.created_by = $3 AND l.partner_id = $4)
        ORDER BY l.date DESC, l.created_at DESC
      `, [req.user.id, partner_id, partner_id, req.user.id]);
    } else {
      // Get all entries involving current user
      entries = await db.all(`
        SELECT l.*,
          creator.name as created_by_name,
          partner.name as partner_name
        FROM partner_ledger l
        JOIN users creator ON l.created_by = creator.id
        JOIN users partner ON l.partner_id = partner.id
        WHERE l.created_by = $1 OR l.partner_id = $2
        ORDER BY l.date DESC, l.created_at DESC
      `, [req.user.id, req.user.id]);
    }

    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get summary of balances with all partners
router.get('/summary', async (req, res) => {
  try {
    // Get all partners
    const partners = await db.all('SELECT id, name FROM users WHERE role = $1 AND id != $2',
      ['partner', req.user.id]);

    const summaries = [];
    for (const p of partners) {
      // Entries I created about this partner
      // credit = they owe me, debit = I owe them
      const myEntries = await db.all(`
        SELECT type, COALESCE(SUM(amount), 0) as total
        FROM partner_ledger
        WHERE created_by = $1 AND partner_id = $2
        GROUP BY type
      `, [req.user.id, p.id]);

      // Entries they created about me
      // their credit = I owe them, their debit = they owe me
      const theirEntries = await db.all(`
        SELECT type, COALESCE(SUM(amount), 0) as total
        FROM partner_ledger
        WHERE created_by = $1 AND partner_id = $2
        GROUP BY type
      `, [p.id, req.user.id]);

      let theyOweMe = 0;  // total they owe me
      let iOweThem = 0;    // total I owe them

      // From my entries
      for (const e of myEntries) {
        if (e.type === 'credit') theyOweMe += parseFloat(e.total);  // they owe me
        if (e.type === 'debit') iOweThem += parseFloat(e.total);     // I owe them
      }

      // From their entries
      for (const e of theirEntries) {
        if (e.type === 'credit') iOweThem += parseFloat(e.total);    // I owe them (they say I owe)
        if (e.type === 'debit') theyOweMe += parseFloat(e.total);    // they owe me (they say they owe)
      }

      summaries.push({
        partner_id: p.id,
        partner_name: p.name,
        they_owe_me: theyOweMe,
        i_owe_them: iOweThem,
        net: theyOweMe - iOweThem  // positive = they owe me net, negative = I owe them net
      });
    }

    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add ledger entry
router.post('/', async (req, res) => {
  try {
    const { partner_id, type, amount, description, date } = req.body;
    if (!partner_id || !type || !amount || !date) {
      return res.status(400).json({ error: 'partner_id, type, amount, date required' });
    }

    if (partner_id == req.user.id) {
      return res.status(400).json({ error: 'Cannot create entry for yourself' });
    }

    // Verify partner exists
    const partner = await db.get('SELECT id FROM users WHERE id = $1 AND role = $2', [partner_id, 'partner']);
    if (!partner) return res.status(404).json({ error: 'Partner not found' });

    const result = await db.get(`
      INSERT INTO partner_ledger (created_by, partner_id, type, amount, description, date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [req.user.id, partner_id, type, amount, description || '', date]);

    const entry = await db.get(`
      SELECT l.*, creator.name as created_by_name, partner.name as partner_name
      FROM partner_ledger l
      JOIN users creator ON l.created_by = creator.id
      JOIN users partner ON l.partner_id = partner.id
      WHERE l.id = $1
    `, [result.id]);

    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ledger entry (only by creator)
router.put('/:id', async (req, res) => {
  try {
    const entry = await db.get('SELECT * FROM partner_ledger WHERE id = $1', [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    if (entry.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can edit this entry' });
    }

    const { type, amount, description, date } = req.body;
    await db.query(`
      UPDATE partner_ledger SET type = $1, amount = $2, description = $3, date = $4 WHERE id = $5
    `, [type || entry.type, amount || entry.amount, description ?? entry.description, date || entry.date, entry.id]);

    const updated = await db.get(`
      SELECT l.*, creator.name as created_by_name, partner.name as partner_name
      FROM partner_ledger l
      JOIN users creator ON l.created_by = creator.id
      JOIN users partner ON l.partner_id = partner.id
      WHERE l.id = $1
    `, [entry.id]);

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete ledger entry (only by creator)
router.delete('/:id', async (req, res) => {
  try {
    const entry = await db.get('SELECT * FROM partner_ledger WHERE id = $1', [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    if (entry.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can delete this entry' });
    }

    await db.query('DELETE FROM partner_ledger WHERE id = $1', [entry.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
