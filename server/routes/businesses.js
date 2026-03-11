const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'partner') {
      const businesses = await db.all(`
        SELECT b.*, bp.share_percentage
        FROM businesses b
        JOIN business_partners bp ON b.id = bp.business_id
        WHERE bp.user_id = $1
      `, [req.user.id]);
      return res.json(businesses);
    }

    if (req.user.role === 'employee') {
      const business = await db.get('SELECT * FROM businesses WHERE id = $1', [req.user.business_id]);
      return res.json(business ? [business] : []);
    }

    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const business = await db.get('SELECT * FROM businesses WHERE id = $1', [req.params.id]);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    if (req.user.role === 'partner') {
      const access = await db.get('SELECT share_percentage FROM business_partners WHERE business_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]);
      if (!access) return res.status(403).json({ error: 'No access' });
      business.share_percentage = access.share_percentage;
    }

    const partners = await db.all(`
      SELECT u.id, u.name, bp.share_percentage
      FROM business_partners bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.business_id = $1
    `, [req.params.id]);

    business.partners = partners;
    res.json(business);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
