// src/config/env.js
// Centralised, validated environment configuration.
// Throws early if required variables are missing — fail fast in production.

require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `\n❌  Missing required environment variables: ${missing.join(', ')}\n` +
    `    Copy .env.example to .env and fill in the values.\n`
  );
  process.exit(1);
}

module.exports = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // CORS — supports comma-separated list of origins
  corsOrigins: (
    process.env.CORS_ORIGIN ||
    'https://www.ruqyah-al-shariah.online,https://ruqyah-al-shariah.online,http://localhost:5500,http://127.0.0.1:5500'
  )
    .split(',')
    .map((o) => o.trim()),
};
