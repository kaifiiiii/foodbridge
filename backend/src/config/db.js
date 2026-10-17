// backend/src/config/db.js
// One shared connection pool. Every query in the app goes through this.

const mysql = require('mysql2/promise');
const { db } = require('./env');

const pool = mysql.createPool({
  host: db.host,
  user: db.user,
  password: db.password,
  database: db.database,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true   // return DATETIME as plain strings, avoiding time-zone surprises
});

module.exports = pool;