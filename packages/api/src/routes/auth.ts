import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { signAccessToken, signRefreshToken, verifyToken } from '../lib/jwt.js';
import { env } from '../config/env.js';

export default async function authRoutes(fastify: FastifyInstance) {
  // Google OAuth: redirect to Google
  fastify.get('/auth/google', async (_request, reply) => {
    const params = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: env.googleRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Google OAuth: callback
  fastify.get<{ Querystring: { code?: string; error?: string } }>(
    '/auth/google/callback',
    async (request, reply) => {
      const { code, error } = request.query;

      if (error || !code) {
        return reply.redirect(`${env.clientUrl}?auth_error=google_denied`);
      }

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: env.googleClientId,
          client_secret: env.googleClientSecret,
          redirect_uri: env.googleRedirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        fastify.log.error('Google token exchange failed');
        return reply.redirect(`${env.clientUrl}?auth_error=token_exchange`);
      }

      const tokenData = (await tokenRes.json()) as { id_token: string };

      // Decode Google ID token (the signature was verified by Google's endpoint)
      const payload = JSON.parse(
        Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString(),
      ) as { sub: string; email?: string; name?: string };

      const googleId = payload.sub;
      const email = payload.email || '';

      // Check if user exists
      const existing = await fastify.pg.query(
        'SELECT id, nickname FROM users WHERE google_id = $1',
        [googleId],
      );

      if (existing.rows.length > 0) {
        // Existing user — issue tokens
        const user = existing.rows[0];
        const accessToken = signAccessToken({ sub: user.id, nickname: user.nickname });
        const refreshToken = signRefreshToken({ sub: user.id, nickname: user.nickname });

        await storeRefreshToken(fastify, user.id, refreshToken);
        await fastify.pg.query('UPDATE users SET last_active = now() WHERE id = $1', [user.id]);

        return reply.redirect(
          `${env.clientUrl}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}`,
        );
      }

      // New user — redirect to registration page with Google data
      return reply.redirect(
        `${env.clientUrl}/auth/register?google_id=${googleId}&email=${encodeURIComponent(email)}`,
      );
    },
  );

  // Complete registration (new user sets nickname + password)
  fastify.post<{
    Body: { google_id: string; email: string; nickname: string; password: string };
  }>('/auth/register', async (request, reply) => {
    const { google_id, email, nickname, password } = request.body;

    if (!google_id || !nickname || !password) {
      return reply.status(400).send({ error: 'google_id, nickname, and password are required' });
    }

    if (nickname.length < 3 || nickname.length > 30) {
      return reply.status(400).send({ error: 'Nickname must be 3-30 characters' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters' });
    }

    // Check nickname uniqueness
    const nicknameCheck = await fastify.pg.query('SELECT id FROM users WHERE nickname = $1', [
      nickname,
    ]);
    if (nicknameCheck.rows.length > 0) {
      return reply.status(409).send({ error: 'Nickname already taken' });
    }

    // Check google_id uniqueness
    const googleCheck = await fastify.pg.query('SELECT id FROM users WHERE google_id = $1', [
      google_id,
    ]);
    if (googleCheck.rows.length > 0) {
      return reply.status(409).send({ error: 'Google account already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailEncrypted = email ? Buffer.from(email) : null; // TODO: real encryption in Task 10

    const result = await fastify.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nickname`,
      [google_id, nickname, emailEncrypted, passwordHash],
    );

    const user = result.rows[0];
    const accessToken = signAccessToken({ sub: user.id, nickname: user.nickname });
    const refreshToken = signRefreshToken({ sub: user.id, nickname: user.nickname });

    await storeRefreshToken(fastify, user.id, refreshToken);

    // Initialize reputation score
    await fastify.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);

    return reply.status(201).send({ access_token: accessToken, refresh_token: refreshToken });
  });

  // Refresh access token
  fastify.post<{ Body: { refresh_token: string } }>('/auth/refresh', async (request, reply) => {
    const { refresh_token } = request.body;
    if (!refresh_token) {
      return reply.status(400).send({ error: 'refresh_token is required' });
    }

    let payload;
    try {
      payload = verifyToken(refresh_token);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    // Check token exists in DB
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const stored = await fastify.pg.query(
      'SELECT id FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND expires_at > now()',
      [tokenHash, payload.sub],
    );

    if (stored.rows.length === 0) {
      return reply.status(401).send({ error: 'Refresh token not found or expired' });
    }

    // Rotate: delete old, issue new
    await fastify.pg.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

    const newAccessToken = signAccessToken({ sub: payload.sub, nickname: payload.nickname });
    const newRefreshToken = signRefreshToken({ sub: payload.sub, nickname: payload.nickname });
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
        'SELECT id, nickname, created_at, last_active FROM users WHERE id = $1',
        [request.user!.sub],
      );
      if (user.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return reply.send(user.rows[0]);
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
