const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL Connection Pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,  // Maximum 20 connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✓ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL error:', err);
  process.exit(-1);
});

/**
 * Execute a query (returns all rows)
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  
  return res.rows;
}

/**
 * Execute a query (returns single row or null)
 */
async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a command (INSERT, UPDATE, DELETE)
 */
async function run(text, params) {
  const res = await pool.query(text, params);
  return res;
}

/**
 * Transaction wrapper
 */
async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  queryOne,
  run,
  transaction
};
