import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import crypto from 'node:crypto';
import { processImage } from '../lib/image.js';

export default async function userRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  // Get public profile by nickname
  fastify.get<{ Params: { nickname: string } }>('/users/:nickname', async (request, reply) => {
    const { nickname } = request.params;

    const result = await fastify.pg.query(
      `SELECT u.id, u.nickname, u.bio, u.avatar_key, u.created_at, u.last_active,
              rs.composite_score, rs.rating_avg, rs.tier
       FROM users u
       LEFT JOIN reputation_scores rs ON rs.user_id = u.id
       WHERE u.nickname = $1`,
      [nickname],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const user = result.rows[0];
    return reply.send({
      id: user.id,
      nickname: user.nickname,
      bio: user.bio,
      avatar_url: user.avatar_key
        ? `/api/users/${user.nickname}/avatar`
        : null,
      created_at: user.created_at,
      last_active: user.last_active,
      reputation: {
        composite_score: parseFloat(user.composite_score) || 0,
        rating_avg: parseFloat(user.rating_avg) || 0,
        tier: user.tier || 'new',
      },
    });
  });

  // Get a user's public key (needed by sender to encrypt a message to them)
  fastify.get<{ Params: { nickname: string } }>(
    '/users/:nickname/public-key',
    async (request, reply) => {
      const { nickname } = request.params;
      const result = await fastify.pg.query(
        'SELECT public_key FROM users WHERE nickname = $1',
        [nickname],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }
      const { public_key } = result.rows[0];
      if (!public_key) {
        return reply.status(404).send({ error: 'User has no public key (legacy account)' });
      }
      return reply.send({ public_key });
    },
  );

  // Update own profile (protected)
  fastify.put<{ Body: { nickname?: string; bio?: string } }>(
    '/users/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { nickname, bio } = request.body;

      const updates: string[] = [];
      const values: (string | null)[] = [];
      let paramIdx = 1;

      if (nickname !== undefined) {
        if (nickname.length < 3 || nickname.length > 30) {
          return reply.status(400).send({ error: 'Nickname must be 3-30 characters' });
        }
        // Check uniqueness
        const existing = await fastify.pg.query(
          'SELECT id FROM users WHERE nickname = $1 AND id != $2',
          [nickname, userId],
        );
        if (existing.rows.length > 0) {
          return reply.status(409).send({ error: 'Nickname already taken' });
        }
        updates.push(`nickname = $${paramIdx++}`);
        values.push(nickname);
      }

      if (bio !== undefined) {
        if (bio.length > 500) {
          return reply.status(400).send({ error: 'Bio must be 500 characters or less' });
        }
        updates.push(`bio = $${paramIdx++}`);
        values.push(bio);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      values.push(userId);
      const result = await fastify.pg.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING id, nickname, bio, avatar_key`,
        values,
      );

      return reply.send(result.rows[0]);
    },
  );

  // Upload avatar (protected)
  fastify.put(
    '/users/me/avatar',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Only JPEG, PNG, and WebP images are allowed' });
      }

      // Read full buffer for magic-byte validation + EXIF stripping
      const rawBuffer = await data.toBuffer();

      let processed: { buffer: Buffer; mime: string };
      try {
        processed = await processImage(rawBuffer, data.mimetype);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid image';
        return reply.status(400).send({ error: msg });
      }

      const ext = processed.mime.split('/')[1] === 'jpeg' ? 'jpg' : processed.mime.split('/')[1];
      const key = `avatars/${userId}-${crypto.randomUUID()}.${ext}`;

      // Delete old avatar if exists
      const existing = await fastify.pg.query('SELECT avatar_key FROM users WHERE id = $1', [
        userId,
      ]);
      if (existing.rows[0]?.avatar_key) {
        try {
          await fastify.minio.removeObject(fastify.minioBucket, existing.rows[0].avatar_key);
        } catch {
          // Ignore if old avatar doesn't exist
        }
      }

      // Upload processed (EXIF-stripped) buffer to MinIO
      await fastify.minio.putObject(fastify.minioBucket, key, processed.buffer, {
        'Content-Type': processed.mime,
      });

      // Update user record
      await fastify.pg.query('UPDATE users SET avatar_key = $1 WHERE id = $2', [key, userId]);

      return reply.send({ avatar_key: key });
    },
  );

  // Serve avatar image
  fastify.get<{ Params: { nickname: string } }>(
    '/users/:nickname/avatar',
    async (request, reply) => {
      const { nickname } = request.params;

      const result = await fastify.pg.query('SELECT avatar_key FROM users WHERE nickname = $1', [
        nickname,
      ]);

      if (result.rows.length === 0 || !result.rows[0].avatar_key) {
        return reply.status(404).send({ error: 'Avatar not found' });
      }

      const key = result.rows[0].avatar_key;
      const stream = await fastify.minio.getObject(fastify.minioBucket, key);
      const ext = key.split('.').pop();
      const contentType =
        ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';

      return reply.header('Content-Type', contentType).header('Cache-Control', 'public, max-age=86400').send(stream);
    },
  );
}
