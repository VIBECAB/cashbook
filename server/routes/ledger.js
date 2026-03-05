const express = require('express');
const db = require('../db');
const { authMiddleware, partnerOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(partnerOnly);

// Get all ledger entries involving the current user (created by me or about me)
router.get('/', (req, res) => {
  const { partner_id } = req.query;

  let entries;
  if (partner_id) {
    // Get entries between current user and a specific partner
    entries = db.prepare(`
      SELECT l.*,
        creator.name as created_by_name,
        partner.name as partner_name
      FROM partner_ledger l
      JOIN users creator ON l.created_by = creator.id
      JOIN users partner ON l.partner_id = partner.id
      WHERE (l.created_by = ? AND l.partner_id = ?)
         OR (l.created_by = ? AND l.partner_id = ?)
      ORDER BY l.date DESC, l.created_at DESC
    `).all(req.user.id, partner_id, partner_id, req.user.id);
  } else {
    // Get all entries involving current user
    entries = db.prepare(`
      SELECT l.*,
        creator.name as created_by_name,
        partner.name as partner_name
      FROM partner_ledger l
      JOIN users creator ON l.created_by = creator.id
      JOIN users partner ON l.partner_id = partner.id
      WHERE l.created_by = ? OR l.partner_id = ?
      ORDER BY l.date DESC, l.created_at DESC
    `).all(req.user.id, req.user.id);
  }

  res.json(entries);
});

// Get summary of balances with all partners
router.get('/summary', (req, res) => {
  // Get all partners
  const partners = db.prepare('SELECT id, name FROM users WHERE role = ? AND id != ?')
    .all('partner', req.user.id);

  const summaries = partners.map(p => {
    // Entries I created about this partner
    // credit = they owe me, debit = I owe them
    const myEntries = db.prepare(`
      SELECT type, COALESCE(SUM(amount), 0) as total
      FROM partner_ledger
      WHERE created_by = ? AND partner_id = ?
      GROUP BY type
    `).all(req.user.id, p.id);

    // Entries they created about me
    // their credit = I owe them, their debit = they owe me
    const theirEntries = db.prepare(`
      SELECT type, COALESCE(SUM(amount), 0) as total
      FROM partner_ledger
      WHERE created_by = ? AND partner_id = ?
      GROUP BY type
    `).all(p.id, req.user.id);

    let theyOweMe = 0;  // total they owe me
    let iOweThem = 0;    // total I owe them

    // From my entries
    for (const e of myEntries) {
      if (e.type === 'credit') theyOweMe += e.total;  // they owe me
      if (e.type === 'debit') iOweThem += e.total;     // I owe them
    }

    // From their entries
    for (const e of theirEntries) {
      if (e.type === 'credit') iOweThem += e.total;    // I owe them (they say I owe)
      if (e.type === 'debit') theyOweMe += e.total;    // they owe me (they say they owe)
    }

    return {
      partner_id: p.id,
      partner_name: p.name,
      they_owe_me: theyOweMe,
      i_owe_them: iOweThem,
      net: theyOweMe - iOweThem  // positive = they owe me net, negative = I owe them net
    };
  });

  res.json(summaries);
});

// Add ledger entry
router.post('/', (req, res) => {
  const { partner_id, type, amount, description, date } = req.body;
  if (!partner_id || !type || !amount || !date) {
    return res.status(400).json({ error: 'partner_id, type, amount, date required' });
  }

  if (partner_id == req.user.id) {
    return res.status(400).json({ error: 'Cannot create entry for yourself' });
  }

  // Verify partner exists
  const partner = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(partner_id, 'partner');
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  const result = db.prepare(`
    INSERT INTO partner_ledger (created_by, partner_id, type, amount, description, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, partner_id, type, amount, description || '', date);

  const entry = db.prepare(`
    SELECT l.*, creator.name as created_by_name, partner.name as partner_name
    FROM partner_ledger l
    JOIN users creator ON l.created_by = creator.id
    JOIN users partner ON l.partner_id = partner.id
    WHERE l.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(entry);
});

// Update ledger entry (only by creator)
router.put('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM partner_ledger WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  if (entry.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Only the creator can edit this entry' });
  }

  const { type, amount, description, date } = req.body;
  db.prepare(`
    UPDATE partner_ledger SET type = ?, amount = ?, description = ?, date = ? WHERE id = ?
  `).run(type || entry.type, amount || entry.amount, description ?? entry.description, date || entry.date, entry.id);

  const updated = db.prepare(`
    SELECT l.*, creator.name as created_by_name, partner.name as partner_name
    FROM partner_ledger l
    JOIN users creator ON l.created_by = creator.id
    JOIN users partner ON l.partner_id = partner.id
    WHERE l.id = ?
  `).get(entry.id);

  res.json(updated);
});

// Delete ledger entry (only by creator)
router.delete('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM partner_ledger WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  if (entry.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Only the creator can delete this entry' });
  }

  db.prepare('DELETE FROM partner_ledger WHERE id = ?').run(entry.id);
  res.json({ success: true });
});

module.exports = router;
