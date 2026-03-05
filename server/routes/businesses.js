const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', (req, res) => {
  if (req.user.role === 'partner') {
    const businesses = db.prepare(`
      SELECT b.*, bp.share_percentage
      FROM businesses b
      JOIN business_partners bp ON b.id = bp.business_id
      WHERE bp.user_id = ?
    `).all(req.user.id);
    return res.json(businesses);
  }

  if (req.user.role === 'employee') {
    const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.business_id);
    return res.json(business ? [business] : []);
  }

  res.json([]);
});

router.get('/:id', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });

  if (req.user.role === 'partner') {
    const access = db.prepare('SELECT share_percentage FROM business_partners WHERE business_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access' });
    business.share_percentage = access.share_percentage;
  }

  const partners = db.prepare(`
    SELECT u.id, u.name, bp.share_percentage
    FROM business_partners bp
    JOIN users u ON bp.user_id = u.id
    WHERE bp.business_id = ?
  `).all(req.params.id);

  business.partners = partners;
  res.json(business);
});

module.exports = router;
