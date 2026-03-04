import type { FastifyInstance } from 'fastify';

export default async function messageRoutes(fastify: FastifyInstance) {
  // Create or get a message thread (between two users, optionally about a listing or exchange offer)
  fastify.post<{
    Body: { recipient_nickname: string; listing_id?: string; offer_id?: string };
  }>(
    '/threads',
    { preHandler: [fastify.authenticate, fastify.requireEmailVerified] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { recipient_nickname, listing_id, offer_id } = request.body;

      if (!recipient_nickname) {
        return reply.status(400).send({ error: 'recipient_nickname is required' });
      }

      // Find recipient
      const recipient = await fastify.pg.query(
        'SELECT id FROM users WHERE nickname = $1',
        [recipient_nickname],
      );
      if (recipient.rows.length === 0) {
        return reply.status(404).send({ error: 'Recipient not found' });
      }
      const recipientId = recipient.rows[0].id;

      if (recipientId === userId) {
        return reply.status(400).send({ error: 'Cannot message yourself' });
      }

      // Check for existing thread between these users (optionally for this listing/offer)
      let existingQuery: string;
      let existingParams: (string | null)[];

      if (listing_id) {
        existingQuery = `SELECT id FROM message_threads
          WHERE listing_id = $3
          AND ((participant_1 = $1 AND participant_2 = $2) OR (participant_1 = $2 AND participant_2 = $1))`;
        existingParams = [userId, recipientId, listing_id];
      } else if (offer_id) {
        existingQuery = `SELECT id FROM message_threads
          WHERE offer_id = $3
          AND ((participant_1 = $1 AND participant_2 = $2) OR (participant_1 = $2 AND participant_2 = $1))`;
        existingParams = [userId, recipientId, offer_id];
      } else {
        existingQuery = `SELECT id FROM message_threads
          WHERE listing_id IS NULL AND offer_id IS NULL
          AND ((participant_1 = $1 AND participant_2 = $2) OR (participant_1 = $2 AND participant_2 = $1))`;
        existingParams = [userId, recipientId];
      }

      const existing = await fastify.pg.query(existingQuery, existingParams);
      if (existing.rows.length > 0) {
        return reply.send({ id: existing.rows[0].id, existing: true });
      }

      // Create new thread
      const result = await fastify.pg.query(
        `INSERT INTO message_threads (participant_1, participant_2, listing_id, offer_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, participant_1, participant_2, listing_id, offer_id, created_at`,
        [userId, recipientId, listing_id || null, offer_id || null],
      );

      return reply.status(201).send(result.rows[0]);
    },
  );

  // List my threads
  fastify.get<{
    Querystring: { page?: string; limit?: string; offer_id?: string };
  }>(
    '/threads',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { page = '1', limit = '20', offer_id } = request.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const countParams: (string | number)[] = [userId];
      let countWhere = '(mt.participant_1 = $1 OR mt.participant_2 = $1)';
      if (offer_id) {
        countParams.push(offer_id);
        countWhere += ` AND mt.offer_id = $${countParams.length}`;
      }

      const countRes = await fastify.pg.query(
        `SELECT COUNT(*) FROM message_threads mt WHERE ${countWhere}`,
        countParams,
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const listParams: (string | number)[] = [userId];
      let listWhere = '(mt.participant_1 = $1 OR mt.participant_2 = $1)';
      let paramIdx = 2;
      if (offer_id) {
        listParams.push(offer_id);
        listWhere += ` AND mt.offer_id = $${paramIdx++}`;
      }
      listParams.push(limitNum, offset);

      const result = await fastify.pg.query(
        `SELECT mt.id, mt.listing_id, mt.offer_id, mt.created_at,
                u1.nickname as participant_1_nickname,
                u2.nickname as participant_2_nickname,
                l.title as listing_title,
                CASE WHEN eo.id IS NOT NULL THEN eo.offer_type || ' ' || eo.crypto_currency || '/' || eo.fiat_currency ELSE NULL END as offer_summary,
                (SELECT m.created_at FROM messages m WHERE m.thread_id = mt.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
                (SELECT u.nickname FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.thread_id = mt.id ORDER BY m.created_at DESC LIMIT 1) as last_sender_nickname
         FROM message_threads mt
         JOIN users u1 ON u1.id = mt.participant_1
         JOIN users u2 ON u2.id = mt.participant_2
         LEFT JOIN listings l ON l.id = mt.listing_id
         LEFT JOIN exchange_offers eo ON eo.id = mt.offer_id
         WHERE ${listWhere}
         ORDER BY last_message_at DESC NULLS LAST, mt.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        listParams,
      );

      return reply.send({
        threads: result.rows,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    },
  );

  // Send a message in a thread
  // body_encrypted: base64-encoded AES-256-GCM ciphertext produced by the client.
  // The server stores it opaquely — it cannot decrypt it.
  fastify.post<{
    Params: { threadId: string };
    Body: { body_encrypted: string };
  }>(
    '/threads/:threadId/messages',
    { preHandler: [fastify.authenticate, fastify.requireEmailVerified] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { threadId } = request.params;
      const { body_encrypted } = request.body;

      if (!body_encrypted || body_encrypted.trim().length === 0) {
        return reply.status(400).send({ error: 'body_encrypted is required' });
      }
      // base64 overhead ~33%, so 5000 bytes plaintext ≈ 6800 base64 chars + IV/tag overhead
      if (body_encrypted.length > 8192) {
        return reply.status(400).send({ error: 'Encrypted message too large' });
      }

      // Verify thread exists and user is participant
      const thread = await fastify.pg.query(
        'SELECT * FROM message_threads WHERE id = $1',
        [threadId],
      );
      if (thread.rows.length === 0) {
        return reply.status(404).send({ error: 'Thread not found' });
      }

      const t = thread.rows[0];
      if (t.participant_1 !== userId && t.participant_2 !== userId) {
        return reply.status(403).send({ error: 'Not a participant in this thread' });
      }

      const recipientId = t.participant_1 === userId ? t.participant_2 : t.participant_1;

      const result = await fastify.pg.query(
        `INSERT INTO messages (thread_id, sender_id, recipient_id, body_encrypted)
         VALUES ($1, $2, $3, $4)
         RETURNING id, thread_id, sender_id, recipient_id, created_at`,
        [threadId, userId, recipientId, Buffer.from(body_encrypted, 'base64')],
      );

      return reply.status(201).send({
        ...result.rows[0],
        body_encrypted, // Return ciphertext back to sender (base64)
      });
    },
  );

  // Get messages in a thread
  fastify.get<{
    Params: { threadId: string };
    Querystring: { page?: string; limit?: string };
  }>(
    '/threads/:threadId/messages',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { threadId } = request.params;
      const { page = '1', limit = '50' } = request.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      // Verify thread and participation
      const thread = await fastify.pg.query(
        'SELECT * FROM message_threads WHERE id = $1',
        [threadId],
      );
      if (thread.rows.length === 0) {
        return reply.status(404).send({ error: 'Thread not found' });
      }

      const t = thread.rows[0];
      if (t.participant_1 !== userId && t.participant_2 !== userId) {
        return reply.status(403).send({ error: 'Not a participant in this thread' });
      }

      const countRes = await fastify.pg.query(
        'SELECT COUNT(*) FROM messages WHERE thread_id = $1',
        [threadId],
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const result = await fastify.pg.query(
        `SELECT m.id, m.sender_id, m.recipient_id, m.body_encrypted, m.created_at,
                u.nickname as sender_nickname
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.thread_id = $1
         ORDER BY m.created_at ASC
         LIMIT $2 OFFSET $3`,
        [threadId, limitNum, offset],
      );

      // Server returns ciphertext as base64 — client decrypts using E2E keys
      const messages = result.rows.map((msg) => ({
        id: msg.id,
        sender_id: msg.sender_id,
        sender_nickname: msg.sender_nickname,
        recipient_id: msg.recipient_id,
        body_encrypted: (msg.body_encrypted as Buffer).toString('base64'),
        created_at: msg.created_at,
      }));

      return reply.send({
        messages,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    },
  );
}
