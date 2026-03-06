import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

const CLEANUP_INTERVAL_MS = 60_000; // run every 1 minute
const MAX_AGE_MS = 10 * 60_000;     // delete after 10 minutes unverified (allows 2 resends)

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically deletes users who registered but never verified their email
 * within the allowed window. All related rows (refresh_tokens, verification
 * codes, reputation_scores) cascade-delete via ON DELETE CASCADE.
 *
 * Also purges expired refresh tokens to prevent unbounded table growth.
 */
export function startUnverifiedCleanup(app: FastifyInstance) {
  timer = setInterval(async () => {
    try {
      // Purge expired refresh tokens
      const tokenResult = await app.pg.query(
        'DELETE FROM refresh_tokens WHERE expires_at < now()',
      );
      if (tokenResult.rowCount && tokenResult.rowCount > 0) {
        app.log.info({ count: tokenResult.rowCount }, 'Purged expired refresh tokens');
      }
    } catch (err) {
      app.log.error({ err }, 'Refresh token cleanup failed');
    }

    // No email service configured — verification is disabled, skip unverified user cleanup
    if (!env.brevoApiKey) return;

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
