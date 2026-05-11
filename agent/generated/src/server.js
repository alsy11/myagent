require('dotenv').config();

const app = require('./app');
const { pool } = require('./db');

const PORT = process.env.PORT || 3000;

let server;

async function start() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('Database connected successfully');

    server = app.listen(PORT, () => {
      console.log(`Space Fractions server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (err) {
    console.error('Error closing database pool:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
