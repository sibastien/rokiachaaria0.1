// src/server.js
// Application entry point — boots the Express server.

const createApp = require('./app');
const { port, nodeEnv } = require('./config/env');
const prisma = require('./config/prisma');

async function main() {
  // Try connecting to database
  try {
    await prisma.$connect();
    console.log('✅  Database connected successfully');
  } catch (err) {
    console.warn('⚠️  Database connection failed:', err.message);
    console.warn('    The server will start, but database operations require a working PostgreSQL instance.');
    console.warn('    Provide a valid DATABASE_URL in server/.env (e.g. Supabase or local Postgres).');
  }

  const app = createApp();

  const server = app.listen(port, () => {
    console.log('\n══════════════════════════════════════════════════════');
    console.log(`🕌  الرقية الشرعية أونلاين — Backend API`);
    console.log(`══════════════════════════════════════════════════════`);
    console.log(`🚀  Server running on http://localhost:${port}`);
    console.log(`🔍  Health check: http://localhost:${port}/api/health`);
    console.log(`🌍  Environment: ${nodeEnv}`);
    console.log('══════════════════════════════════════════════════════\n');
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────
  async function shutdown(signal) {
    console.log(`\n⚠️  ${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('🔌  Database disconnected. Goodbye!');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Unhandled rejections — log and exit so the process manager can restart
  process.on('unhandledRejection', (reason) => {
    console.error('🔥  Unhandled Rejection:', reason);
    shutdown('unhandledRejection');
  });
}

main();
