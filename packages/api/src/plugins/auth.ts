import fp from 'fastify-plugin';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, type JwtPayload } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.slice(7);
    try {
      request.user = await verifyToken(token);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
});
