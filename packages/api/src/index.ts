import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
// multipart is registered per-route in listings.ts and users.ts
import { env } from './config/env.js';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import minioPlugin from './plugins/minio.js';
import resendPlugin from './plugins/resend.js';
import authPlugin from './plugins/auth.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import listingRoutes from './routes/listings.js';
import tradeRoutes from './routes/trades.js';
import messageRoutes from './routes/messages.js';
import moderationRoutes from './routes/moderation.js';
import ratingRoutes from './routes/ratings.js';
import exchangeRoutes from './routes/exchange.js';
import priceRoutes from './routes/prices.js';
import { recordRequest } from './lib/api-metrics-buffer.js';
import { startMetricsCollector } from './lib/metrics-collector.js';
import { startUnverifiedCleanup } from './lib/unverified-cleanup.js';

const app = Fastify({ logger: true });

// CORS: allow only the configured client origin
await app.register(cors, { origin: env.clientUrl, credentials: true });
await app.register(cookie);

// Global rate limit: 100 req/min per IP
await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (_req, ctx) => ({
    statusCode: 429,
    error: 'Too many requests — please slow down',
    expiresIn: ctx.ttl,
  }),
});

// Security headers on every response
app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('X-Permitted-Cross-Domain-Policies', 'none');
});

// Record response times for API performance metrics (exclude /health to avoid noise)
app.addHook('onResponse', async (request, reply) => {
  if (!request.url.startsWith('/health')) {
    recordRequest(reply.elapsedTime, reply.statusCode);
  }
});
await app.register(dbPlugin);
await app.register(redisPlugin);
await app.register(minioPlugin);
await app.register(resendPlugin);
await app.register(authPlugin);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(userRoutes);
await app.register(listingRoutes);
await app.register(tradeRoutes);
await app.register(messageRoutes);
await app.register(moderationRoutes);
await app.register(ratingRoutes);
await app.register(exchangeRoutes);
await app.register(priceRoutes);

try {
  await app.listen({ port: env.port, host: env.host });
  startMetricsCollector(app.redis, app.pg);
  startUnverifiedCleanup(app);
} catch (err) {
  app.log.fatal(err);
  process.exit(1);
}
