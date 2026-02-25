import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async (fastify) => {
  const redis = new Redis(env.redisUrl);

  await redis.ping();
  fastify.log.info('Redis connected');

  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    redis.disconnect();
  });
});
