// src/config/prisma.js
// Singleton Prisma client — reuses one connection across all modules.

const { PrismaClient } = require('@prisma/client');
const { isDev } = require('./env');

const prisma = new PrismaClient({
  log: isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

module.exports = prisma;
