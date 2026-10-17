// backend/server.js
// Entry point: checks the database, then starts listening.

const { port } = require('./src/config/env');
const pool = require('./src/config/db');
const app = require('./src/app');

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection OK');
  } catch (err) {
    console.error('Database connection FAILED:', err.code || err.message);
    process.exit(1);
  }
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

start();