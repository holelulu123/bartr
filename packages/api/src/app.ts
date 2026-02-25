import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(dbPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);

  return app;
}
