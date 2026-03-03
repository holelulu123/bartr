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

const MONTHLY_LIMIT = parseInt(process.env.RESEND_MONTHLY_LIMIT || '3000', 10);

export default fp(async (fastify) => {
  if (!env.resendApiKey) {
    // Dev/test: no-op mock that logs instead of sending
    fastify.decorate('resend', {
      async sendVerificationEmail(to: string, code: string) {
        fastify.log.info({ to, code }, 'MOCK: would send verification email');
      },
      async getQuota() {
        return { sent: 0, limit: MONTHLY_LIMIT };
      },
    } satisfies ResendService);
    return;
  }

  // Real Resend SDK
  const { Resend } = await import('resend');
  const client = new Resend(env.resendApiKey);

  fastify.decorate('resend', {
    async sendVerificationEmail(to: string, code: string) {
      const { error } = await client.emails.send({
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

      if (error) throw new Error(error.message);
    },

    async getQuota() {
      // Count emails sent this month via the Resend list endpoint
      try {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        let sent = 0;
        let cursor: string | undefined;
        let hasMore = true;

        while (hasMore) {
          const url = new URL('https://api.resend.com/emails');
          url.searchParams.set('limit', '100');
          if (cursor) url.searchParams.set('after', cursor);

          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${env.resendApiKey}` },
          });
          if (!res.ok) break;

          const body = await res.json() as {
            data: { id: string; created_at: string }[];
            has_more: boolean;
          };

          for (const email of body.data) {
            if (new Date(email.created_at) >= monthStart) {
              sent++;
            } else {
              // Emails are returned newest-first; once we see one before this month, stop
              hasMore = false;
              break;
            }
          }

          if (hasMore && body.has_more && body.data.length > 0) {
            cursor = body.data[body.data.length - 1].id;
          } else {
            hasMore = false;
          }
        }

        return { sent, limit: MONTHLY_LIMIT };
      } catch {
        return { sent: 0, limit: MONTHLY_LIMIT };
      }
    },
  } satisfies ResendService);
});
