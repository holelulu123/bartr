import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import minioPlugin from './plugins/minio.js';
import authPlugin from './plugins/auth.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';

export interface BuildAppOptions {
  skipMinio?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
  await app.register(dbPlugin);
  await app.register(redisPlugin);
  if (!opts.skipMinio) {
    await app.register(minioPlugin);
  }
  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);
  if (!opts.skipMinio) {
    await app.register(userRoutes);
  }

  return app;
}
