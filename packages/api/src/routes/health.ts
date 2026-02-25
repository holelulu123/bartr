import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@bartr/shared';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    let dbOk = false;
    let redisOk = false;

    try {
      await fastify.pg.query('SELECT 1');
      dbOk = true;
    } catch {
      fastify.log.error('Health check: DB unreachable');
    }

    try {
      await fastify.redis.ping();
      redisOk = true;
    } catch {
      fastify.log.error('Health check: Redis unreachable');
    }

    const response: HealthResponse = {
      status: dbOk && redisOk ? 'ok' : 'error',
      db: dbOk,
      redis: redisOk,
    };

    const statusCode = response.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(response);
  });
}
