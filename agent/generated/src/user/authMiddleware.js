const userService = require('./userService');

/**
 * Middleware: require a valid JWT token.
 * Sets req.user on success.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Authorization header required' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ success: false, error: 'Authorization format: Bearer <token>' });
  }

  const token = parts[1];
  try {
    const decoded = userService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: require admin role.
 * Must be used after requireAuth.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
