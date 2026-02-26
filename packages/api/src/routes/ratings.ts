import type { FastifyInstance } from 'fastify';

export default async function ratingRoutes(fastify: FastifyInstance) {
  // Submit a rating for a completed trade
  fastify.post<{
    Params: { tradeId: string };
    Body: { score: number; comment?: string };
  }>(
    '/trades/:tradeId/rate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { tradeId } = request.params;
      const { score, comment } = request.body;

      if (!score || score < 1 || score > 5 || !Number.isInteger(score)) {
        return reply.status(400).send({ error: 'Score must be an integer between 1 and 5' });
      }

      if (comment && comment.length > 500) {
        return reply.status(400).send({ error: 'Comment must be 500 characters or less' });
      }

      // Verify trade exists and is completed
      const trade = await fastify.pg.query(
        'SELECT * FROM trades WHERE id = $1',
        [tradeId],
      );
      if (trade.rows.length === 0) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      const t = trade.rows[0];
      if (t.status !== 'completed') {
        return reply.status(400).send({ error: 'Can only rate completed trades' });
      }

      // Must be a participant
      if (t.buyer_id !== userId && t.seller_id !== userId) {
        return reply.status(403).send({ error: 'Not a participant in this trade' });
      }

      // Determine who is being rated
      const toUserId = t.buyer_id === userId ? t.seller_id : t.buyer_id;

      // Check if already rated
      const existing = await fastify.pg.query(
        'SELECT id FROM ratings WHERE trade_id = $1 AND from_user_id = $2',
        [tradeId, userId],
      );
      if (existing.rows.length > 0) {
        return reply.status(409).send({ error: 'You already rated this trade' });
      }

      const result = await fastify.pg.query(
        `INSERT INTO ratings (trade_id, from_user_id, to_user_id, score, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, trade_id, from_user_id, to_user_id, score, comment, created_at`,
        [tradeId, userId, toUserId, score, comment || null],
      );

      // Recalculate reputation for the rated user
      await recalculateReputation(fastify, toUserId);

      return reply.status(201).send(result.rows[0]);
    },
  );

  // Get ratings for a user
  fastify.get<{
    Params: { nickname: string };
    Querystring: { page?: string; limit?: string };
  }>('/users/:nickname/ratings', async (request, reply) => {
    const { nickname } = request.params;
    const { page = '1', limit = '20' } = request.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Find user
    const user = await fastify.pg.query('SELECT id FROM users WHERE nickname = $1', [nickname]);
    if (user.rows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }
    const userId = user.rows[0].id;

    const countRes = await fastify.pg.query(
      'SELECT COUNT(*) FROM ratings WHERE to_user_id = $1',
      [userId],
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const ratingsRes = await fastify.pg.query(
      `SELECT r.id, r.score, r.comment, r.created_at,
              u.nickname as from_nickname
       FROM ratings r
       JOIN users u ON u.id = r.from_user_id
       WHERE r.to_user_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limitNum, offset],
    );

    return reply.send({
      ratings: ratingsRes.rows,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  });
}

/**
 * Recalculate reputation score for a user.
 *
 * Composite score (0-100) is based on:
 * - rating_avg: Average of all ratings (40% weight)
 * - completion_rate: Completed trades / total trades (20% weight)
 * - volume_score: Based on number of completed trades (20% weight)
 * - tenure_bonus: Based on account age (10% weight)
 * - dispute_rate: Inverse of cancelled/declined ratio (10% weight)
 *
 * Tier thresholds:
 * - new: < 3 completed trades
 * - verified: >= 3 completed trades and score >= 30
 * - trusted: >= 10 completed trades and score >= 60
 * - elite: >= 25 completed trades and score >= 80
 */
export async function recalculateReputation(fastify: FastifyInstance, userId: string) {
  // Get rating stats
  const ratingStats = await fastify.pg.query(
    'SELECT COALESCE(AVG(score), 0) as avg, COUNT(*) as count FROM ratings WHERE to_user_id = $1',
    [userId],
  );
  const ratingAvg = parseFloat(ratingStats.rows[0].avg) || 0;
  const ratingCount = parseInt(ratingStats.rows[0].count, 10);

  // Get trade stats
  const tradeStats = await fastify.pg.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed') as completed,
       COUNT(*) FILTER (WHERE status IN ('completed', 'cancelled', 'declined')) as resolved,
       COUNT(*) FILTER (WHERE status IN ('cancelled', 'declined')) as negative,
       COUNT(*) as total
     FROM trades
     WHERE buyer_id = $1 OR seller_id = $1`,
    [userId],
  );
  const completed = parseInt(tradeStats.rows[0].completed, 10);
  const resolved = parseInt(tradeStats.rows[0].resolved, 10);
  const negative = parseInt(tradeStats.rows[0].negative, 10);

  // Get account age in days
  const userRes = await fastify.pg.query(
    'SELECT created_at FROM users WHERE id = $1',
    [userId],
  );
  const daysSinceJoin = userRes.rows.length > 0
    ? (Date.now() - new Date(userRes.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  // Calculate component scores (all 0-1 range)
  const completionRate = resolved > 0 ? completed / resolved : 0;
  const volumeScore = Math.min(1, completed / 50); // maxes out at 50 trades
  const tenureBonus = Math.min(1, daysSinceJoin / 365); // maxes out at 1 year
  const disputeRate = resolved > 0 ? negative / resolved : 0;

  // Composite score: weighted sum scaled to 0-100
  const compositeScore = Math.round(
    (((ratingAvg / 5) * 0.4) +
     (completionRate * 0.2) +
     (volumeScore * 0.2) +
     (tenureBonus * 0.1) +
     ((1 - disputeRate) * 0.1)) * 100,
  );

  // Determine tier (anti-manipulation: need minimum trade count)
  let tier = 'new';
  if (completed >= 25 && compositeScore >= 80) {
    tier = 'elite';
  } else if (completed >= 10 && compositeScore >= 60) {
    tier = 'trusted';
  } else if (completed >= 3 && compositeScore >= 30) {
    tier = 'verified';
  }

  await fastify.pg.query(
    `UPDATE reputation_scores
     SET rating_avg = $2, composite_score = $3, completion_rate = $4,
         volume_score = $5, tenure_bonus = $6, dispute_rate = $7,
         response_score = 0, tier = $8, updated_at = now()
     WHERE user_id = $1`,
    [
      userId,
      ratingAvg.toFixed(2),
      compositeScore,
      completionRate.toFixed(4),
      volumeScore.toFixed(4),
      tenureBonus.toFixed(4),
      disputeRate.toFixed(4),
      tier,
    ],
  );
}
