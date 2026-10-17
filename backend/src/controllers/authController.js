// backend/src/controllers/authController.js
// Register, login, logout, current user.

const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { validateRegister, validateLogin } = require('../validators/authValidator');

const BCRYPT_COST = 12;
// Used when the email doesn't exist, so a wrong email takes as long as a wrong
// password. That stops attackers from discovering which emails are registered by timing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

// Express-session uses callbacks, so wrap them in promises for async/await.
const regenerateSession = (req) =>
  new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
const destroySession = (req) =>
  new Promise((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())));

async function register(req, res) {
  const { errors, value } = validateRegister(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Please fix the highlighted fields', fields: errors });
  }

  const passwordHash = await bcrypt.hash(value.password, BCRYPT_COST);

  try {
    // "?" placeholders = parameterized query. Values are never pasted into the SQL text.
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [value.name, value.email, passwordHash, value.role]
    );
    res.status(201).json({
      user: { id: result.insertId, name: value.name, email: value.email, role: value.role }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    throw err;   // Express 5 forwards this to the error handler
  }
}

async function login(req, res) {
  const { errors, value } = validateLogin(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Email and password are required', fields: errors });
  }

  const [rows] = await pool.execute(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = ?',
    [value.email]
  );
  const user = rows[0];

  const passwordOk = await bcrypt.compare(value.password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) {
    // Same message for "no such email" and "wrong password" on purpose.
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // New session ID on login prevents "session fixation" attacks.
  await regenerateSession(req);
  req.session.user = { id: user.id, role: user.role };

  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

async function logout(req, res) {
  await destroySession(req);
  res.clearCookie('foodbridge.sid');
  res.json({ message: 'Logged out' });
}

async function me(req, res) {
  // Re-read from the database so we never trust stale session data.
  const [rows] = await pool.execute(
    'SELECT id, name, email, role FROM users WHERE id = ?',
    [req.session.user.id]
  );
  if (rows.length === 0) {
    await destroySession(req);
    return res.status(401).json({ error: 'Please log in to continue' });
  }
  res.json({ user: rows[0] });
}

module.exports = { register, login, logout, me };