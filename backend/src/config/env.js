// backend/src/config/env.js
// Loads .env once and refuses to start if a required variable is missing.

require('dotenv').config();

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'SESSION_SECRET'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error('Missing environment variables: ' + missing.join(', '));
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  },
  sessionSecret: process.env.SESSION_SECRET
};