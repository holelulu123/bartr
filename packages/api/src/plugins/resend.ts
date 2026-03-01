import fp from 'fastify-plugin';
import { env } from '../config/env.js';

export interface ResendService {
  sendVerificationEmail(to: string, code: string): Promise<void>;
  getQuota(): Promise<{ sent: number; limit: number }>;
}

declare module 'fastify' {
  interface FastifyInstance {
    resend: ResendService;
  }
}

const MONTHLY_LIMIT = 3000;
const REDIS_KEY = 'resend:monthly_count';

export default fp(async (fastify) => {
  if (!env.resendApiKey) {
    // Dev/test: no-op mock that logs instead of sending
    fastify.decorate('resend', {
      async sendVerificationEmail(to: string, code: string) {
        fastify.log.info({ to, code }, 'MOCK: would send verification email');
      },
      async getQuota() {
        let sent = 0;
        try {
          const val = await fastify.redis.get(REDIS_KEY);
          if (val) sent = parseInt(val, 10);
        } catch { /* ignore */ }
        return { sent, limit: MONTHLY_LIMIT };
      },
    } satisfies ResendService);
    return;
  }

  // Real Resend SDK
  const { Resend } = await import('resend');
  const client = new Resend(env.resendApiKey);

  fastify.decorate('resend', {
    async sendVerificationEmail(to: string, code: string) {
      await client.emails.send({
        from: env.resendFromEmail,
        to,
        subject: 'bartr — Verify your email',
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`,
      });

      // Increment monthly counter with auto-expire at month end
      const now = new Date();
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const ttl = Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);

      const pipeline = fastify.redis.pipeline();
      pipeline.incr(REDIS_KEY);
      pipeline.expire(REDIS_KEY, ttl);
      await pipeline.exec();
    },

    async getQuota() {
      let sent = 0;
      try {
        const val = await fastify.redis.get(REDIS_KEY);
        if (val) sent = parseInt(val, 10);
      } catch { /* ignore */ }
      return { sent, limit: MONTHLY_LIMIT };
    },
  } satisfies ResendService);
});
