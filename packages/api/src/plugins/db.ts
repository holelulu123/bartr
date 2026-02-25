import fp from 'fastify-plugin';
import pg from 'pg';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
  }
}

export default fp(async (fastify) => {
  const pool = new pg.Pool({ connectionString: env.databaseUrl });

  await pool.query('SELECT 1');
  fastify.log.info('PostgreSQL connected');

  fastify.decorate('pg', pool);
  fastify.addHook('onClose', async () => {
    await pool.end();
  });
});
