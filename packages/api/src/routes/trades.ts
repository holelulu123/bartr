import type { FastifyInstance } from 'fastify';

export default async function tradeRoutes(fastify: FastifyInstance) {
  // Create a trade offer (buyer initiates on a listing or exchange offer)
  fastify.post<{
    Body: { listing_id?: string; offer_id?: string };
  }>(
    '/trades',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const buyerId = request.user!.sub;
      const { listing_id, offer_id } = request.body;

      if (!listing_id && !offer_id) {
        return reply.status(400).send({ error: 'listing_id or offer_id is required' });
      }

      let sellerId: string;

      if (listing_id) {
        // Verify listing exists and is active
        const listing = await fastify.pg.query(
          'SELECT id, user_id, status FROM listings WHERE id = $1',
          [listing_id],
        );
        if (listing.rows.length === 0) {
          return reply.status(404).send({ error: 'Listing not found' });
        }
        if (listing.rows[0].status !== 'active') {
          return reply.status(400).send({ error: 'Listing is not active' });
        }

        sellerId = listing.rows[0].user_id;
        if (sellerId === buyerId) {
          return reply.status(400).send({ error: 'Cannot trade on your own listing' });
        }

        // Check for existing active trade by this buyer on this listing
        const existingTrade = await fastify.pg.query(
          "SELECT id FROM trades WHERE listing_id = $1 AND buyer_id = $2 AND status IN ('offered', 'accepted')",
          [listing_id, buyerId],
        );
        if (existingTrade.rows.length > 0) {
          return reply.status(409).send({ error: 'You already have an active trade on this listing' });
        }

        const result = await fastify.pg.query(
          `INSERT INTO trades (listing_id, buyer_id, seller_id, status)
           VALUES ($1, $2, $3, 'offered')
           RETURNING id, listing_id, offer_id, buyer_id, seller_id, status, created_at, updated_at`,
          [listing_id, buyerId, sellerId],
        );

        await fastify.pg.query(
          `INSERT INTO trade_events (trade_id, event_type, created_by)
           VALUES ($1, 'offered', $2)`,
          [result.rows[0].id, buyerId],
        );

        return reply.status(201).send(result.rows[0]);
      }

      // Exchange offer trade
      const offer = await fastify.pg.query(
        'SELECT id, user_id, status FROM exchange_offers WHERE id = $1',
        [offer_id],
      );
      if (offer.rows.length === 0) {
        return reply.status(404).send({ error: 'Exchange offer not found' });
      }
      if (offer.rows[0].status !== 'active') {
        return reply.status(400).send({ error: 'Exchange offer is not active' });
      }

      sellerId = offer.rows[0].user_id;
      if (sellerId === buyerId) {
        return reply.status(400).send({ error: 'Cannot trade on your own offer' });
      }

      // Check for existing active trade
      const existingTrade = await fastify.pg.query(
        "SELECT id FROM trades WHERE offer_id = $1 AND buyer_id = $2 AND status IN ('offered', 'accepted')",
        [offer_id, buyerId],
      );
      if (existingTrade.rows.length > 0) {
        return reply.status(409).send({ error: 'You already have an active trade on this offer' });
      }

      const result = await fastify.pg.query(
        `INSERT INTO trades (offer_id, buyer_id, seller_id, status)
         VALUES ($1, $2, $3, 'offered')
         RETURNING id, listing_id, offer_id, buyer_id, seller_id, status, created_at, updated_at`,
        [offer_id, buyerId, sellerId],
      );

      await fastify.pg.query(
        `INSERT INTO trade_events (trade_id, event_type, created_by)
         VALUES ($1, 'offered', $2)`,
        [result.rows[0].id, buyerId],
      );

      return reply.status(201).send(result.rows[0]);
    },
  );

  // Get a single trade
  fastify.get<{ Params: { id: string } }>(
    '/trades/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const result = await fastify.pg.query(
        `SELECT t.*,
                l.title as listing_title,
                CASE WHEN eo.id IS NOT NULL THEN eo.offer_type || ' ' || eo.crypto_currency || '/' || eo.fiat_currency ELSE NULL END as offer_summary,
                bu.nickname as buyer_nickname,
                su.nickname as seller_nickname,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', te.id, 'event_type', te.event_type, 'created_by', te.created_by, 'created_at', te.created_at) ORDER BY te.created_at)
                   FROM trade_events te WHERE te.trade_id = t.id), '[]'
                ) as events
         FROM trades t
         LEFT JOIN listings l ON l.id = t.listing_id
         LEFT JOIN exchange_offers eo ON eo.id = t.offer_id
         JOIN users bu ON bu.id = t.buyer_id
         JOIN users su ON su.id = t.seller_id
         WHERE t.id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      const trade = result.rows[0];
      // Only participants can view
      if (trade.buyer_id !== userId && trade.seller_id !== userId) {
        return reply.status(403).send({ error: 'Not a participant in this trade' });
      }

      return reply.send(trade);
    },
  );

  // List my trades
  fastify.get<{
    Querystring: { role?: string; status?: string; page?: string; limit?: string };
  }>(
    '/trades',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { role, status, page = '1', limit = '20' } = request.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const values: (string | number)[] = [];
      let paramIdx = 1;

      if (role === 'buyer') {
        conditions.push(`t.buyer_id = $${paramIdx++}`);
        values.push(userId);
      } else if (role === 'seller') {
        conditions.push(`t.seller_id = $${paramIdx++}`);
        values.push(userId);
      } else {
        conditions.push(`(t.buyer_id = $${paramIdx} OR t.seller_id = $${paramIdx})`);
        values.push(userId);
        paramIdx++;
      }

      if (status) {
        conditions.push(`t.status = $${paramIdx++}`);
        values.push(status);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;

      const countRes = await fastify.pg.query(
        `SELECT COUNT(*) FROM trades t ${where}`,
        values,
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const listValues = [...values, limitNum, offset];
      const listResult = await fastify.pg.query(
        `SELECT t.id, t.listing_id, t.offer_id, t.buyer_id, t.seller_id, t.status, t.created_at, t.updated_at,
                l.title as listing_title,
                CASE WHEN eo.id IS NOT NULL THEN eo.offer_type || ' ' || eo.crypto_currency || '/' || eo.fiat_currency ELSE NULL END as offer_summary,
                bu.nickname as buyer_nickname,
                su.nickname as seller_nickname
         FROM trades t
         LEFT JOIN listings l ON l.id = t.listing_id
         LEFT JOIN exchange_offers eo ON eo.id = t.offer_id
         JOIN users bu ON bu.id = t.buyer_id
         JOIN users su ON su.id = t.seller_id
         ${where}
         ORDER BY t.updated_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        listValues,
      );

      return reply.send({
        trades: listResult.rows,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    },
  );

  // Accept a trade (seller only, from 'offered')
  fastify.post<{ Params: { id: string } }>(
    '/trades/:id/accept',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const trade = await fastify.pg.query(
        'SELECT * FROM trades WHERE id = $1',
        [id],
      );
      if (trade.rows.length === 0) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      const t = trade.rows[0];
      if (t.seller_id !== userId) {
        return reply.status(403).send({ error: 'Only the seller can accept' });
      }
      if (t.status !== 'offered') {
        return reply.status(400).send({ error: `Cannot accept a trade with status: ${t.status}` });
      }

      const result = await fastify.pg.query(
        `UPDATE trades SET status = 'accepted', updated_at = now()
         WHERE id = $1 RETURNING id, listing_id, buyer_id, seller_id, status, created_at, updated_at`,
        [id],
      );

      await fastify.pg.query(
        `INSERT INTO trade_events (trade_id, event_type, created_by) VALUES ($1, 'accepted', $2)`,
        [id, userId],
      );

      return reply.send(result.rows[0]);
    },
  );

  // Decline a trade (seller only, from 'offered')
  fastify.post<{ Params: { id: string } }>(
    '/trades/:id/decline',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const trade = await fastify.pg.query('SELECT * FROM trades WHERE id = $1', [id]);
      if (trade.rows.length === 0) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      const t = trade.rows[0];
      if (t.seller_id !== userId) {
        return reply.status(403).send({ error: 'Only the seller can decline' });
      }
      if (t.status !== 'offered') {
        return reply.status(400).send({ error: `Cannot decline a trade with status: ${t.status}` });
      }

      const result = await fastify.pg.query(
        `UPDATE trades SET status = 'declined', updated_at = now()
         WHERE id = $1 RETURNING id, listing_id, buyer_id, seller_id, status, created_at, updated_at`,
        [id],
      );

      await fastify.pg.query(
        `INSERT INTO trade_events (trade_id, event_type, created_by) VALUES ($1, 'declined', $2)`,
        [id, userId],
      );

      return reply.send(result.rows[0]);
    },
  );

  // Cancel a trade (buyer only, from 'offered' or 'accepted')
  fastify.post<{ Params: { id: string } }>(
    '/trades/:id/cancel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const trade = await fastify.pg.query('SELECT * FROM trades WHERE id = $1', [id]);
      if (trade.rows.length === 0) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      const t = trade.rows[0];
      if (t.buyer_id !== userId) {
        return reply.status(403).send({ error: 'Only the buyer can cancel' });
      }
      if (!['offered', 'accepted'].includes(t.status)) {
        return reply.status(400).send({ error: `Cannot cancel a trade with status: ${t.status}` });
      }

      const result = await fastify.pg.query(
        `UPDATE trades SET status = 'cancelled', updated_at = now()
         WHERE id = $1 RETURNING id, listing_id, buyer_id, seller_id, status, created_at, updated_at`,
        [id],
      );

      await fastify.pg.query(
        `INSERT INTO trade_events (trade_id, event_type, created_by) VALUES ($1, 'cancelled', $2)`,
        [id, userId],
      );

      return reply.send(result.rows[0]);
    },
  );

  // Complete a trade (either party, from 'accepted')
  // Both buyer and seller must confirm. We track this via trade_events.
  fastify.post<{ Params: { id: string } }>(
    '/trades/:id/complete',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const trade = await fastify.pg.query('SELECT * FROM trades WHERE id = $1', [id]);
      if (trade.rows.length === 0) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      const t = trade.rows[0];
      if (t.buyer_id !== userId && t.seller_id !== userId) {
        return reply.status(403).send({ error: 'Not a participant in this trade' });
      }
      if (t.status !== 'accepted') {
        return reply.status(400).send({ error: `Cannot complete a trade with status: ${t.status}` });
      }

      // Use a transaction with row-level locking to prevent race conditions
      // when both parties confirm simultaneously
      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');

        // Lock the trade row for the duration of this transaction
        const lockedTrade = await client.query(
          "SELECT id, status FROM trades WHERE id = $1 FOR UPDATE",
          [id],
        );
        if (lockedTrade.rows[0].status !== 'accepted') {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: `Cannot complete a trade with status: ${lockedTrade.rows[0].status}` });
        }

        // Check if this user already confirmed
        const alreadyConfirmed = await client.query(
          "SELECT id FROM trade_events WHERE trade_id = $1 AND event_type = 'complete_confirmed' AND created_by = $2",
          [id, userId],
        );
        if (alreadyConfirmed.rows.length > 0) {
          await client.query('ROLLBACK');
          return reply.status(409).send({ error: 'You already confirmed completion' });
        }

        // Record confirmation
        await client.query(
          `INSERT INTO trade_events (trade_id, event_type, created_by) VALUES ($1, 'complete_confirmed', $2)`,
          [id, userId],
        );

        // Count distinct confirmers (including the one just inserted)
        const confirmations = await client.query(
          "SELECT COUNT(DISTINCT created_by) as cnt FROM trade_events WHERE trade_id = $1 AND event_type = 'complete_confirmed'",
          [id],
        );

        if (parseInt(confirmations.rows[0].cnt, 10) >= 2) {
          // Both confirmed — mark trade as completed atomically
          const result = await client.query(
            `UPDATE trades SET status = 'completed', updated_at = now()
             WHERE id = $1 AND status = 'accepted'
             RETURNING id, listing_id, buyer_id, seller_id, status, created_at, updated_at`,
            [id],
          );

          await client.query(
            `INSERT INTO trade_events (trade_id, event_type, created_by) VALUES ($1, 'completed', $2)`,
            [id, userId],
          );

          await client.query('COMMIT');
          return reply.send({ ...result.rows[0], message: 'Trade completed! Both parties confirmed.' });
        }

        await client.query('COMMIT');
        return reply.send({
          id: t.id,
          status: 'accepted',
          message: 'Completion confirmed. Waiting for the other party to confirm.',
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );
}
