import Fastify from 'fastify';
import { env } from './config/env.js';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import healthRoutes from './routes/health.js';

const app = Fastify({ logger: true });

await app.register(dbPlugin);
await app.register(redisPlugin);
await app.register(healthRoutes);

try {
  await app.listen({ port: env.port, host: env.host });
} catch (err) {
  app.log.fatal(err);
  process.exit(1);
}
