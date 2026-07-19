const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('POSTGRES_URL (veya DATABASE_URL) env değişkeni tanımlı olmalı.');
}

// Vercel Postgres / Neon require SSL; a local dev Postgres does not offer it.
const useSsl = /sslmode=require|neon\.tech|vercel-storage/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

// Idempotent — safe to run on every cold start, only actually creates
// anything the first time a given database is used.
let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    schemaReady = pool.query(schema);
  }
  return schemaReady;
}

async function query(text, params) {
  await ensureSchema();
  return pool.query(text, params);
}

// Runs fn(client) inside a BEGIN/COMMIT transaction, rolling back on any
// thrown error. fn must use the passed client for every query so it sees
// its own uncommitted writes and participates in the same transaction.
async function withTransaction(fn) {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction, ensureSchema };
