const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.PGUSER || 'spacefractions'}:${process.env.PGPASSWORD || 'spacefractions'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'spacefractions'}`,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a query with optional parameters.
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'test') {
    console.log('Executed query', { text: text.substring(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Get a client from the pool for transactions.
 * @returns {Promise<object>} Pool client
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

module.exports = {
  query,
  getClient,
  pool,
};
