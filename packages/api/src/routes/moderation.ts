import type { FastifyInstance } from 'fastify';

// Basic keyword filter for listing content
const BLOCKED_KEYWORDS = [
  'scam', 'fraud', 'phishing', 'hack', 'stolen', 'counterfeit',
  'illegal', 'drug', 'weapon', 'explosive', 'child',
];

export function checkKeywordFilter(text: string): string | null {
  const lower = text.toLowerCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

export default async function moderationRoutes(fastify: FastifyInstance) {
  // Submit a flag (report) on a listing, user, or message
  fastify.post<{
    Body: {
      target_type: string;
      target_id: string;
      reason: string;
    };
  }>(
    '/flags',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { target_type, target_id, reason } = request.body;

      if (!target_type || !['listing', 'user', 'message'].includes(target_type)) {
        return reply.status(400).send({ error: 'target_type must be listing, user, or message' });
      }
      if (!target_id) {
        return reply.status(400).send({ error: 'target_id is required' });
      }
      if (!reason || reason.length < 5 || reason.length > 1000) {
        return reply.status(400).send({ error: 'Reason must be 5-1000 characters' });
      }

      // Verify target exists
      if (target_type === 'listing') {
        const listing = await fastify.pg.query('SELECT id FROM listings WHERE id = $1', [target_id]);
        if (listing.rows.length === 0) {
          return reply.status(404).send({ error: 'Listing not found' });
        }
      } else if (target_type === 'user') {
        const user = await fastify.pg.query('SELECT id FROM users WHERE id = $1', [target_id]);
        if (user.rows.length === 0) {
          return reply.status(404).send({ error: 'User not found' });
        }
      }

      // Prevent duplicate flags from same reporter on same target
      const existing = await fastify.pg.query(
        "SELECT id FROM moderation_flags WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'pending'",
        [userId, target_type, target_id],
      );
      if (existing.rows.length > 0) {
        return reply.status(409).send({ error: 'You already have a pending flag on this target' });
      }

      const result = await fastify.pg.query(
        `INSERT INTO moderation_flags (reporter_id, target_type, target_id, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING id, reporter_id, target_type, target_id, reason, status, created_at`,
        [userId, target_type, target_id, reason],
      );

      return reply.status(201).send(result.rows[0]);
    },
  );

  // Get my flags
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>(
    '/flags/mine',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { page = '1', limit = '20' } = request.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const countRes = await fastify.pg.query(
        'SELECT COUNT(*) FROM moderation_flags WHERE reporter_id = $1',
        [userId],
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const result = await fastify.pg.query(
        `SELECT id, target_type, target_id, reason, status, created_at
         FROM moderation_flags
         WHERE reporter_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limitNum, offset],
      );

      return reply.send({
        flags: result.rows,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    },
  );

  // Admin: list all pending flags
  // For now, any authenticated user can view (admin role TBD in production)
  fastify.get<{
    Querystring: { status?: string; target_type?: string; page?: string; limit?: string };
  }>(
    '/admin/flags',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { status = 'pending', target_type, page = '1', limit = '20' } = request.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const values: (string | number)[] = [];
      let paramIdx = 1;

      if (status) {
        conditions.push(`mf.status = $${paramIdx++}`);
        values.push(status);
      }
      if (target_type) {
        conditions.push(`mf.target_type = $${paramIdx++}`);
        values.push(target_type);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await fastify.pg.query(
        `SELECT COUNT(*) FROM moderation_flags mf ${where}`,
        values,
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const listValues = [...values, limitNum, offset];
      const result = await fastify.pg.query(
        `SELECT mf.id, mf.target_type, mf.target_id, mf.reason, mf.status, mf.created_at,
                u.nickname as reporter_nickname
         FROM moderation_flags mf
         JOIN users u ON u.id = mf.reporter_id
         ${where}
         ORDER BY mf.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        listValues,
      );

      return reply.send({
        flags: result.rows,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    },
  );

  // Admin: update flag status (review/resolve/dismiss)
  fastify.put<{
    Params: { id: string };
    Body: { status: string };
  }>(
    '/admin/flags/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body;

      const validStatuses = ['reviewed', 'resolved', 'dismissed'];
      if (!status || !validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Status must be reviewed, resolved, or dismissed' });
      }

      const existing = await fastify.pg.query(
        'SELECT id FROM moderation_flags WHERE id = $1',
        [id],
      );
      if (existing.rows.length === 0) {
        return reply.status(404).send({ error: 'Flag not found' });
      }

      const result = await fastify.pg.query(
        `UPDATE moderation_flags SET status = $1 WHERE id = $2
         RETURNING id, reporter_id, target_type, target_id, reason, status, created_at`,
        [status, id],
      );

      return reply.send(result.rows[0]);
    },
  );

  // Content filter check endpoint (can be used by frontend to pre-check)
  fastify.post<{
    Body: { text: string };
  }>('/moderation/check', async (request, reply) => {
    const { text } = request.body;
    if (!text) {
      return reply.status(400).send({ error: 'text is required' });
    }

    const blocked = checkKeywordFilter(text);
    return reply.send({
      allowed: blocked === null,
      blocked_keyword: blocked,
    });
  });
}
