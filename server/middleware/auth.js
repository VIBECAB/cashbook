const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '***REDACTED_JWT_SECRET***';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function partnerOnly(req, res, next) {
  if (req.user.role !== 'partner') {
    return res.status(403).json({ error: 'Partners only' });
  }
  next();
}

module.exports = { authMiddleware, partnerOnly, JWT_SECRET };
