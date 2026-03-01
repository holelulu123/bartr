import fp from 'fastify-plugin';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, type JwtPayload } from '../lib/jwt.js';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireEmailVerified: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify) => {
  // Throttle last_active updates: at most once per 2 minutes per user
  const lastActiveCache = new Map<string, number>();
  const THROTTLE_MS = 2 * 60_000;

  function touchLastActive(userId: string) {
    const now = Date.now();
    const last = lastActiveCache.get(userId);
    if (last && now - last < THROTTLE_MS) return;
    lastActiveCache.set(userId, now);
    // Fire-and-forget — don't block the request
    fastify.pg.query('UPDATE users SET last_active = now() WHERE id = $1', [userId]).catch(() => {});
  }

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

    touchLastActive(request.user!.sub);
  });

  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
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

    if (request.user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }
  });

  fastify.decorate('requireEmailVerified', async (request: FastifyRequest, reply: FastifyReply) => {
    // No email service configured — skip verification check entirely
    if (!env.resendApiKey) return;

    // Must run after authenticate (request.user is set)
    if (!request.user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const result = await fastify.pg.query(
      'SELECT email_verified FROM users WHERE id = $1',
      [request.user.sub],
    );

    if (!result.rows[0]?.email_verified) {
      return reply.status(403).send({ error: 'Email verification required' });
    }
  });
});
