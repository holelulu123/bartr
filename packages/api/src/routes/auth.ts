import type { FastifyInstance } from 'fastify';
import * as argon2 from 'argon2';
import crypto from 'node:crypto';
import { signAccessToken, signRefreshToken, verifyToken, type JwtPayload } from '../lib/jwt.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { generateUniqueNickname } from '../lib/nickname.js';
import { generateVerificationCode, hashCode } from '../lib/email.js';

function emailHmac(email: string): string {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY is required in production');
  }
  const key = raw
    ? Buffer.from(raw, 'hex')
    : Buffer.from('bartr-dev-encryption-key-32bytes!'.padEnd(32).slice(0, 32));
  return crypto.createHmac('sha256', key).update(email.toLowerCase().trim()).digest('hex');
}

// Tight rate limit config for sensitive auth endpoints (applied per-route below)
const AUTH_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
const LOGIN_RATE_LIMIT = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

export default async function authRoutes(fastify: FastifyInstance) {
  // Refresh access token
  fastify.post<{ Body: { refresh_token: string } }>('/auth/refresh', AUTH_RATE_LIMIT, async (request, reply) => {
    const { refresh_token } = request.body;
    if (!refresh_token) {
      return reply.status(400).send({ error: 'refresh_token is required' });
    }

    let payload;
    try {
      payload = await verifyToken(refresh_token);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    // Atomically consume the token — DELETE ... RETURNING ensures only one
    // concurrent request can succeed even if two arrive with the same token.
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const deleted = await fastify.pg.query(
      'DELETE FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND expires_at > now() RETURNING id',
      [tokenHash, payload.sub],
    );

    if (deleted.rows.length === 0) {
      return reply.status(401).send({ error: 'Refresh token not found or expired' });
    }

    // Fetch fresh role from DB (role may have changed since token was issued)
    const userRow = await fastify.pg.query('SELECT role FROM users WHERE id = $1', [payload.sub]);
    const role = userRow.rows[0]?.role as JwtPayload['role'] | undefined;

    const newAccessToken = await signAccessToken({ sub: payload.sub, nickname: payload.nickname, role });
    const newRefreshToken = await signRefreshToken({ sub: payload.sub, nickname: payload.nickname });
    await storeRefreshToken(fastify, payload.sub, newRefreshToken);

    return reply.send({ access_token: newAccessToken, refresh_token: newRefreshToken });
  });

  // Logout (revoke refresh token)
  fastify.post<{ Body: { refresh_token: string } }>('/auth/logout', async (request, reply) => {
    const { refresh_token } = request.body;
    if (refresh_token) {
      const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
      await fastify.pg.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
    }
    return reply.send({ ok: true });
  });

  // Get current user (protected)
  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await fastify.pg.query(
        'SELECT id, nickname, role, created_at, last_active, email_verified FROM users WHERE id = $1',
        [request.user!.sub],
      );
      if (user.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return reply.send(user.rows[0]);
    },
  );

  // Email/password registration — nickname is auto-generated
  fastify.post<{
    Body: {
      email: string;
      password: string;
      public_key: string;
      private_key_blob: string;
      recovery_key_blob: string;
    };
  }>('/auth/register/email', AUTH_RATE_LIMIT, async (request, reply) => {
    const { email, password, public_key, private_key_blob, recovery_key_blob } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }

    if (!public_key || !private_key_blob || !recovery_key_blob) {
      return reply.status(400).send({ error: 'public_key, private_key_blob, and recovery_key_blob are required' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters' });
    }

    const hash = emailHmac(email);

    // Check email uniqueness
    const emailCheck = await fastify.pg.query('SELECT id FROM users WHERE email_hash = $1', [hash]);
    if (emailCheck.rows.length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const nickname = await generateUniqueNickname(fastify.pg);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const emailEncrypted = encrypt(email);
    const privateKeyBlobBuf = Buffer.from(private_key_blob, 'base64');
    const recoveryKeyBlobBuf = Buffer.from(recovery_key_blob, 'base64');

    const result = await fastify.pg.query(
      `INSERT INTO users (nickname, email_encrypted, email_hash, password_hash, public_key, private_key_blob, recovery_key_blob, auth_provider)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'email')
       RETURNING id, nickname`,
      [nickname, emailEncrypted, hash, passwordHash, public_key, privateKeyBlobBuf, recoveryKeyBlobBuf],
    );

    const user = result.rows[0];
    const accessToken = await signAccessToken({ sub: user.id, nickname: user.nickname, role: 'user' });
    const refreshToken = await signRefreshToken({ sub: user.id, nickname: user.nickname });

    await storeRefreshToken(fastify, user.id, refreshToken);
    await fastify.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);

    // Send verification email (fire-and-forget)
    const code = generateVerificationCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60_000); // 15 minutes
    await fastify.pg.query(
      `INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET code_hash = $2, expires_at = $3, created_at = now()`,
      [user.id, codeHash, expiresAt],
    );
    fastify.resend.sendVerificationEmail(email, code).catch(() => {});

    return reply.status(201).send({ access_token: accessToken, refresh_token: refreshToken });
  });

  // Email/password login
  fastify.post<{
    Body: { email: string; password: string };
  }>('/auth/login/email', LOGIN_RATE_LIMIT, async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }

    const hash = emailHmac(email);
    const result = await fastify.pg.query(
      'SELECT id, nickname, password_hash, role FROM users WHERE email_hash = $1',
      [hash],
    );

    // Use constant-time comparison to prevent user enumeration
    const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$dummydummydummy$dummydummydummydummydummydummy';
    const storedHash = result.rows[0]?.password_hash ?? DUMMY_HASH;
    const valid = await argon2.verify(storedHash, password).catch(() => false);

    if (!valid || result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const accessToken = await signAccessToken({ sub: user.id, nickname: user.nickname, role: user.role });
    const refreshToken = await signRefreshToken({ sub: user.id, nickname: user.nickname });

    await storeRefreshToken(fastify, user.id, refreshToken);
    await fastify.pg.query('UPDATE users SET last_active = now() WHERE id = $1', [user.id]);

    return reply.send({ access_token: accessToken, refresh_token: refreshToken });
  });

  // Get key blobs for the current user (called after login to load E2E keys)
  fastify.get(
    '/auth/key-blobs',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = await fastify.pg.query(
        'SELECT public_key, private_key_blob, recovery_key_blob FROM users WHERE id = $1',
        [request.user!.sub],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }
      const { public_key, private_key_blob, recovery_key_blob } = result.rows[0];
      return reply.send({
        public_key: public_key ?? null,
        private_key_blob: private_key_blob
          ? (private_key_blob as Buffer).toString('base64')
          : null,
        recovery_key_blob: recovery_key_blob
          ? (recovery_key_blob as Buffer).toString('base64')
          : null,
      });
    },
  );

  // Verify email with 6-digit code
  fastify.post<{ Body: { code: string } }>(
    '/auth/verify-email',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { code } = request.body;
      if (!code || !/^\d{6}$/.test(code)) {
        return reply.status(400).send({ error: 'A 6-digit code is required' });
      }

      const userId = request.user!.sub;

      // Check if already verified
      const userRow = await fastify.pg.query('SELECT email_verified FROM users WHERE id = $1', [userId]);
      if (userRow.rows[0]?.email_verified) {
        return reply.send({ verified: true });
      }

      // Atomic consume: delete matching code
      const codeH = hashCode(code);
      const deleted = await fastify.pg.query(
        'DELETE FROM email_verification_codes WHERE user_id = $1 AND code_hash = $2 AND expires_at > now() RETURNING id',
        [userId, codeH],
      );

      if (deleted.rows.length === 0) {
        return reply.status(400).send({ error: 'Invalid or expired verification code' });
      }

      await fastify.pg.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [userId]);
      return reply.send({ verified: true });
    },
  );

  // Resend verification email
  fastify.post(
    '/auth/resend-verification',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const userId = request.user!.sub;

      const userRow = await fastify.pg.query(
        'SELECT email_verified, email_encrypted FROM users WHERE id = $1',
        [userId],
      );

      if (!userRow.rows[0]) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (userRow.rows[0].email_verified) {
        return reply.send({ message: 'Email already verified' });
      }

      const email = decrypt(userRow.rows[0].email_encrypted);
      const code = generateVerificationCode();
      const codeH = hashCode(code);
      const expiresAt = new Date(Date.now() + 5 * 60_000);

      await fastify.pg.query(
        `INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET code_hash = $2, expires_at = $3, created_at = now()`,
        [userId, codeH, expiresAt],
      );

      fastify.resend.sendVerificationEmail(email, code).catch(() => {});

      return reply.send({ message: 'Verification email sent' });
    },
  );
}

async function storeRefreshToken(fastify: FastifyInstance, userId: string, token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await fastify.pg.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt],
  );
}
