import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

const CLEANUP_INTERVAL_MS = 60_000; // run every 1 minute
const MAX_AGE_MS = 5 * 60_000;      // delete after 5 minutes unverified

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically deletes users who registered but never verified their email
 * within the allowed window. All related rows (refresh_tokens, verification
 * codes, reputation_scores) cascade-delete via ON DELETE CASCADE.
 */
export function startUnverifiedCleanup(app: FastifyInstance) {
  // No email service configured — verification is disabled, nothing to clean up
  if (!env.brevoApiKey) return;

  timer = setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - MAX_AGE_MS);
      const result = await app.pg.query(
        `DELETE FROM users
         WHERE email_verified = FALSE
           AND auth_provider = 'email'
           AND created_at < $1`,
        [cutoff],
      );
      if (result.rowCount && result.rowCount > 0) {
        app.log.info({ count: result.rowCount }, 'Cleaned up unverified users');
      }
    } catch (err) {
      app.log.error({ err }, 'Unverified user cleanup failed');
    }
  }, CLEANUP_INTERVAL_MS);
}

export function stopUnverifiedCleanup() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
