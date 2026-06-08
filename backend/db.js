// db.js — Conexión a PostgreSQL (Neon) usando pool
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // Neon requiere SSL
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('connect', () => console.log('✓ Conectado a Neon PostgreSQL'));
pool.on('error', (err) => console.error('Error inesperado en PostgreSQL', err));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};