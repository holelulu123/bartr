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
        html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Verify your email</h2>
  <p style="margin: 0 0 24px; color: #555; font-size: 14px;">Enter this code on the verification page to confirm your email address.</p>
  <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
    <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111;">${code}</span>
  </div>
  <p style="margin: 0; color: #888; font-size: 13px;">This code expires in <strong>5 minutes</strong>. If you didn't create a bartr account, you can ignore this email.</p>
</div>`.trim(),
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
