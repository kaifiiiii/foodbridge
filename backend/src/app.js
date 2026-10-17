// backend/src/app.js
// Builds the Express app (no listening here, so tests can import it).

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');
const { sessionSecret } = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const donationRoutes = require('./routes/donationRoutes');

const app = express();

// Security headers. We drop "upgrade-insecure-requests" so plain http://localhost works.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'upgrade-insecure-requests': null
    }
  }
}));

app.use(express.json({ limit: '10kb' }));

// Sessions live in MySQL, so they survive server restarts.
// Tests set SESSION_STORE=memory so they don't need the sessions table.
function buildSessionStore() {
  if (process.env.SESSION_STORE === 'memory') return undefined;
  const MySQLStore = require('express-mysql-session')(session);
  return new MySQLStore({
    createDatabaseTable: false,              // the app user cannot CREATE tables; we made it by hand
    expiration: 1000 * 60 * 60 * 8,
    checkExpirationInterval: 1000 * 60 * 15
  }, pool);
}

app.use(session({
  name: 'foodbridge.sid',
  secret: sessionSecret,
  store: buildSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// Brute-force protection: only FAILED attempts (status 400+) count.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FoodBridge server is running' });
});

app.get('/api/db-health', async (req, res) => {
  const [rows] = await pool.query('SELECT DATABASE() AS db, COUNT(*) AS users FROM users');
  res.json({ status: 'ok', database: rows[0].db, users: rows[0].users });
});

app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  res.status(500).json({ error: 'Something went wrong on the server' });
});

module.exports = app;