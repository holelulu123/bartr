import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
// multipart is registered per-route in listings.ts and users.ts
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { recordRequest } from './lib/api-metrics-buffer.js';
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
import ratingRoutes from './routes/ratings.js';
import messageRoutes from './routes/messages.js';
import moderationRoutes from './routes/moderation.js';
import exchangeRoutes from './routes/exchange.js';
import priceRoutes from './routes/prices.js';

export interface BuildAppOptions {
  skipMinio?: boolean;
  skipRateLimit?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  // CORS: allow only the configured client origin (not a wildcard)
  await app.register(cors, {
    origin: env.clientUrl,
    credentials: true,
  });

  // Security headers on every response
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
  });

  // Catch PostgreSQL invalid UUID errors and return clean 400 instead of leaky 500
  app.setErrorHandler((error, _request, reply) => {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '22P02') {
      return reply.status(400).send({ error: 'Invalid ID format' });
    }
    // Preserve status code from other errors (rate limit 429s, validation, etc.)
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      statusCode,
      error: error.message || 'Internal Server Error',
      ...(typeof (error as Record<string, unknown>).expiresIn === 'number' && { expiresIn: (error as Record<string, unknown>).expiresIn }),
    });
  });

  // Record response times for API performance metrics (exclude /health to avoid noise)
  app.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/health')) {
      recordRequest(reply.elapsedTime, reply.statusCode);
    }
  });

  await app.register(cookie);

  if (!opts.skipRateLimit) {
    // Global default: 100 req/min
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
  }

  await app.register(dbPlugin);
  await app.register(redisPlugin);
  if (!opts.skipMinio) {
    await app.register(minioPlugin);
  }
  await app.register(resendPlugin);
  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/' });
  if (!opts.skipMinio) {
    await app.register(userRoutes);
    await app.register(listingRoutes);
    await app.register(tradeRoutes);
    await app.register(ratingRoutes);
    await app.register(messageRoutes);
    await app.register(moderationRoutes);
    await app.register(exchangeRoutes);
    await app.register(priceRoutes);
  }

  return app;
}
