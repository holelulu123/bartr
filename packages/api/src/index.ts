import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import minioPlugin from './plugins/minio.js';
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

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
await app.register(dbPlugin);
await app.register(redisPlugin);
await app.register(minioPlugin);
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
} catch (err) {
  app.log.fatal(err);
  process.exit(1);
}
