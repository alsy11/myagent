const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Register a new user.
 */
async function register({ username, password, displayName }) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }

  // Check existing
  const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    throw new Error('Username already taken');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const res = await db.query(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, role, created_at',
    [username, hashedPassword, displayName || username, 'student']
  );

  const user = res.rows[0];
  const token = generateToken(user);

  return { user, token };
}

/**
 * Login with username and password.
 */
async function login({ username, password }) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const res = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  if (res.rows.length === 0) {
    throw new Error('Invalid username or password');
  }

  const user = res.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid username or password');
  }

  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      created_at: user.created_at,
    },
    token,
  };
}

/**
 * Get user profile by id.
 */
async function getUserById(id) {
  const res = await db.query(
    'SELECT id, username, display_name, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return res.rows[0] || null;
}

/**
 * Generate JWT token.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT token.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  register,
  login,
  getUserById,
  verifyToken,
};
