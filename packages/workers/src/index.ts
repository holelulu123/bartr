import { APP_NAME } from '@bartr/shared';
import { redis } from './lib/redis.js';
import { startPriceFeed } from './jobs/price-feed.js';

console.log(`[${APP_NAME}] Workers starting...`);

startPriceFeed();

console.log(`[${APP_NAME}] Workers ready — all jobs running`);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[${APP_NAME}] Received ${signal}, shutting down...`);
  redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
