import Fastify from 'fastify';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import healthRoutes from './routes/health.js';

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(dbPlugin);
  await app.register(redisPlugin);
  await app.register(healthRoutes);

  return app;
}
