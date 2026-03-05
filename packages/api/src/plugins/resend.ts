import fp from 'fastify-plugin';
import { env } from '../config/env.js';

export interface EmailService {
  sendVerificationEmail(to: string, code: string): Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    resend: EmailService;
  }
}

export default fp(async (fastify) => {
  if (!env.brevoApiKey) {
    // Dev/test: no-op mock that logs instead of sending
    fastify.decorate('resend', {
      async sendVerificationEmail(to: string, code: string) {
        fastify.log.info({ to, code }, 'MOCK: would send verification email');
      },
    } satisfies EmailService);
    return;
  }

  // Real Brevo (Sendinblue) transactional email API
  fastify.decorate('resend', {
    async sendVerificationEmail(to: string, code: string) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.brevoApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: env.brevoFromEmail, name: 'bartr' },
          to: [{ email: to }],
          subject: 'bartr — Verify your email',
          htmlContent: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Verify your email</h2>
  <p style="margin: 0 0 24px; color: #555; font-size: 14px;">Enter this code on the verification page to confirm your email address.</p>
  <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
    <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111;">${code}</span>
  </div>
  <p style="margin: 0; color: #888; font-size: 13px;">This code expires in <strong>5 minutes</strong>. If you didn't create a bartr account, you can ignore this email.</p>
</div>`.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Brevo API error ${res.status}: ${body}`);
      }
    },
  } satisfies EmailService);
});
