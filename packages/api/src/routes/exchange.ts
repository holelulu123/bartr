import type { FastifyInstance } from 'fastify';

const VALID_OFFER_TYPES = ['buy', 'sell'];
const VALID_RATE_TYPES = ['market', 'fixed'];
const VALID_STATUSES = ['active', 'paused', 'removed'];
const VALID_SETTLEMENT_METHODS = [
  'cash', 'bank_transfer', 'paypal', 'wise', 'revolut',
  'zelle', 'venmo', 'sepa', 'interac', 'pix',
  'upi', 'mpesa', 'skrill', 'neteller', 'western_union',
  'moneygram', 'gift_card', 'other',
];
const VALID_PRICE_SOURCES = ['coingecko', 'binance', 'kraken'];

export default async function exchangeRoutes(fastify: FastifyInstance) {
  // POST /exchange/offers — create an exchange offer
  fastify.post<{
    Body: {
      offer_type: string;
      crypto_currency: string;
      fiat_currency: string;
      amount?: number;
      min_amount: number;
      max_amount: number;
      rate_type: string;
      margin_percent?: number;
      fixed_price?: number;
      payment_methods: string[];
      country_code?: string;
      city?: string;
      terms?: string;
      price_source?: string;
    };
  }>(
    '/exchange/offers',
    { preHandler: [fastify.authenticate, fastify.requireEmailVerified] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const {
        offer_type, crypto_currency, fiat_currency,
        amount, min_amount, max_amount,
        rate_type, margin_percent, fixed_price,
        payment_methods, country_code, city, terms,
        price_source = 'coingecko',
      } = request.body;

      // Validate offer_type
      if (!offer_type || !VALID_OFFER_TYPES.includes(offer_type)) {
        return reply.status(400).send({ error: 'offer_type must be "buy" or "sell"' });
      }

      // Validate rate_type
      if (!rate_type || !VALID_RATE_TYPES.includes(rate_type)) {
        return reply.status(400).send({ error: 'rate_type must be "market" or "fixed"' });
      }

      // Validate currencies exist
      const cryptoCheck = await fastify.pg.query(
        "SELECT symbol FROM supported_coins WHERE symbol = $1 AND coin_type = 'crypto' AND is_active = true",
        [crypto_currency],
      );
      if (cryptoCheck.rows.length === 0) {
        return reply.status(400).send({ error: 'Invalid or unsupported crypto currency' });
      }

      const fiatCheck = await fastify.pg.query(
        "SELECT symbol FROM supported_coins WHERE symbol = $1 AND coin_type = 'fiat' AND is_active = true",
        [fiat_currency],
      );
      if (fiatCheck.rows.length === 0) {
        return reply.status(400).send({ error: 'Invalid or unsupported fiat currency' });
      }

      // Validate payment_methods (settlement methods)
      if (!payment_methods || !Array.isArray(payment_methods) || payment_methods.length === 0) {
        return reply.status(400).send({ error: 'At least one settlement method is required' });
      }
      if (payment_methods.length > 10) {
        return reply.status(400).send({ error: 'Too many settlement methods (max 10)' });
      }
      for (const pm of payment_methods) {
        if (!VALID_SETTLEMENT_METHODS.includes(pm)) {
          return reply.status(400).send({ error: `Invalid settlement method: ${pm}` });
        }
      }

      // Validate min_amount and max_amount (required)
      if (min_amount === undefined || min_amount === null || min_amount < 0) {
        return reply.status(400).send({ error: 'min_amount is required and must be >= 0' });
      }
      if (max_amount === undefined || max_amount === null || max_amount <= 0) {
        return reply.status(400).send({ error: 'max_amount is required and must be > 0' });
      }
      if (min_amount > max_amount) {
        return reply.status(400).send({ error: 'min_amount must be less than or equal to max_amount' });
      }

      // Validate price_source
      if (!VALID_PRICE_SOURCES.includes(price_source)) {
        return reply.status(400).send({ error: 'price_source must be "coingecko", "binance", or "kraken"' });
      }

      // Validate fixed_price for fixed rate_type
      if (rate_type === 'fixed' && (fixed_price === undefined || fixed_price <= 0)) {
        return reply.status(400).send({ error: 'fixed_price is required for fixed rate type' });
      }

      // Validate country_code format
      if (country_code && !/^[A-Z]{2}$/.test(country_code)) {
        return reply.status(400).send({ error: 'country_code must be a 2-letter ISO code' });
      }

      // Validate city
      if (city !== undefined && city !== null) {
        if (typeof city !== 'string' || city.length > 30) {
          return reply.status(400).send({ error: 'City must be a string (max 100 chars)' });
        }
        if (/\d/.test(city)) {
          return reply.status(400).send({ error: 'City must not contain numbers' });
        }
      }

      // Validate terms length
      if (terms && terms.length > 100) {
        return reply.status(400).send({ error: 'Terms too long (max 100 characters)' });
      }

      // Enforce per-user max exchange offers limit
      const userRow = await fastify.pg.query(
        'SELECT max_exchange_offers FROM users WHERE id = $1',
        [userId],
      );
      const maxOffers = userRow.rows[0]?.max_exchange_offers;
      if (maxOffers !== null && maxOffers !== undefined) {
        const countRes = await fastify.pg.query(
          "SELECT COUNT(*) FROM exchange_offers WHERE user_id = $1 AND status = 'active'",
          [userId],
        );
        const activeCount = parseInt(countRes.rows[0].count, 10);
        if (activeCount >= maxOffers) {
          return reply.status(400).send({
            error: `You have reached your limit of ${maxOffers} active exchange offer${maxOffers === 1 ? '' : 's'}. Remove or pause an existing offer first.`,
          });
        }
      }

      const result = await fastify.pg.query(
        `INSERT INTO exchange_offers (
          user_id, offer_type, crypto_currency, fiat_currency,
          amount, min_amount, max_amount,
          rate_type, margin_percent, fixed_price,
          payment_methods, country_code, city, terms, price_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          userId, offer_type, crypto_currency, fiat_currency,
          amount ?? null, min_amount, max_amount,
          rate_type, margin_percent ?? 0, fixed_price ?? null,
          JSON.stringify(payment_methods), country_code ?? null, city ?? null, terms ?? null,
          price_source,
        ],
      );

      return reply.status(201).send(result.rows[0]);
    },
  );

  // GET /exchange/offers — list/filter offers
  fastify.get<{
    Querystring: {
      offer_type?: string;
      crypto_currency?: string;
      fiat_currency?: string;
      payment_method?: string;
      country_code?: string;
      user_id?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/exchange/offers',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const {
        offer_type, crypto_currency, fiat_currency,
        payment_method, country_code, user_id,
        page = '1', limit = '20',
      } = request.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const values: (string | number)[] = [];
      let paramIdx = 1;

      const currentUserId = request.user?.sub;

      if (user_id) {
        // Show offers the user created (active/paused) OR where the user is the accepted buyer
        conditions.push(`(eo.user_id = $${paramIdx} OR EXISTS (SELECT 1 FROM trades t WHERE t.offer_id = eo.id AND t.buyer_id = $${paramIdx} AND t.status IN ('accepted', 'completed')))`);
        values.push(user_id);
        paramIdx++;
        conditions.push(`eo.status != 'removed'`);
      } else {
        // Public browse: hide completed trades from everyone,
        // but show accepted trades to participants (they need the exchange page)
        conditions.push(`eo.status = 'active'`);
        conditions.push(`NOT EXISTS (SELECT 1 FROM trades t WHERE t.offer_id = eo.id AND t.status = 'completed')`);
        if (currentUserId) {
          conditions.push(`(
            NOT EXISTS (SELECT 1 FROM trades t WHERE t.offer_id = eo.id AND t.status = 'accepted')
            OR EXISTS (SELECT 1 FROM trades t WHERE t.offer_id = eo.id AND t.status = 'accepted' AND (t.buyer_id = $${paramIdx} OR eo.user_id = $${paramIdx}))
          )`);
          values.push(currentUserId);
          paramIdx++;
        } else {
          conditions.push(`NOT EXISTS (SELECT 1 FROM trades t WHERE t.offer_id = eo.id AND t.status = 'accepted')`);
        }
      }

      if (offer_type && VALID_OFFER_TYPES.includes(offer_type)) {
        conditions.push(`eo.offer_type = $${paramIdx++}`);
        values.push(offer_type);
      }

      if (crypto_currency) {
        conditions.push(`eo.crypto_currency = $${paramIdx++}`);
        values.push(crypto_currency.toUpperCase());
      }

      if (fiat_currency) {
        conditions.push(`eo.fiat_currency = $${paramIdx++}`);
        values.push(fiat_currency.toUpperCase());
      }

      if (payment_method && VALID_SETTLEMENT_METHODS.includes(payment_method)) {
        conditions.push(`eo.payment_methods @> $${paramIdx++}::jsonb`);
        values.push(JSON.stringify([payment_method]));
      }

      if (country_code) {
        conditions.push(`eo.country_code = $${paramIdx++}`);
        values.push(country_code.toUpperCase());
      }

      const where = `WHERE ${conditions.join(' AND ')}`;

      const countRes = await fastify.pg.query(
        `SELECT COUNT(*) FROM exchange_offers eo ${where}`,
        values,
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const listValues = [...values, limitNum, offset];
      const result = await fastify.pg.query(
        `SELECT eo.*, u.nickname as seller_nickname,
                COALESCE(rs.rating_avg, 0) as seller_rating_avg,
                COALESCE(rs.tier, 'new') as seller_tier,
                (SELECT COUNT(*) FROM trades t WHERE (t.buyer_id = eo.user_id OR t.seller_id = eo.user_id) AND t.status = 'completed')::int as seller_trade_count,
                (SELECT t.status FROM trades t WHERE t.offer_id = eo.id AND t.status IN ('accepted', 'completed') LIMIT 1) as accepted_trade_status,
                (SELECT bu.nickname FROM trades t JOIN users bu ON bu.id = t.buyer_id WHERE t.offer_id = eo.id AND t.status IN ('accepted', 'completed') LIMIT 1) as accepted_buyer_nickname
         FROM exchange_offers eo
         JOIN users u ON u.id = eo.user_id
         LEFT JOIN reputation_scores rs ON rs.user_id = eo.user_id
         ${where}
         ORDER BY eo.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        listValues,
      );

      return reply.send({
        offers: result.rows,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    },
  );

  // GET /exchange/offers/:id — single offer with seller info
  // After a trade is accepted, only the offer owner and the accepted buyer can view it.
  fastify.get<{ Params: { id: string } }>(
    '/exchange/offers/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const result = await fastify.pg.query(
        `SELECT eo.*, u.nickname as seller_nickname,
                COALESCE(rs.rating_avg, 0) as seller_rating_avg,
                COALESCE(rs.tier, 'new') as seller_tier,
                (SELECT COUNT(*) FROM trades t WHERE (t.buyer_id = eo.user_id OR t.seller_id = eo.user_id) AND t.status = 'completed')::int as seller_trade_count
         FROM exchange_offers eo
         JOIN users u ON u.id = eo.user_id
         LEFT JOIN reputation_scores rs ON rs.user_id = eo.user_id
         WHERE eo.id = $1`,
        [id],
      );

      if (result.rows.length === 0 || result.rows[0].status === 'removed') {
        return reply.status(404).send({ error: 'Offer not found' });
      }

      const offer = result.rows[0];

      // Check if there's an accepted or completed trade on this offer
      const acceptedTrade = await fastify.pg.query(
        `SELECT buyer_id FROM trades WHERE offer_id = $1 AND status IN ('accepted', 'completed') LIMIT 1`,
        [id],
      );

      if (acceptedTrade.rows.length > 0) {
        const isOwner = offer.user_id === userId;
        const isAcceptedBuyer = acceptedTrade.rows[0].buyer_id === userId;
        if (!isOwner && !isAcceptedBuyer) {
          return reply.status(404).send({ error: 'Offer not found' });
        }
      }

      return reply.send(offer);
    },
  );

  // PUT /exchange/offers/:id — update offer (owner only)
  fastify.put<{
    Params: { id: string };
    Body: {
      amount?: number | null;
      min_amount?: number | null;
      max_amount?: number | null;
      rate_type?: string;
      margin_percent?: number;
      fixed_price?: number | null;
      payment_methods?: string[];
      country_code?: string | null;
      city?: string | null;
      terms?: string | null;
      status?: string;
      price_source?: string;
    };
  }>(
    '/exchange/offers/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const existing = await fastify.pg.query(
        'SELECT * FROM exchange_offers WHERE id = $1',
        [id],
      );
      if (existing.rows.length === 0) {
        return reply.status(404).send({ error: 'Offer not found' });
      }
      if (existing.rows[0].user_id !== userId) {
        return reply.status(403).send({ error: 'Not your offer' });
      }

      const updates: string[] = [];
      const values: (string | number | null)[] = [];
      let paramIdx = 1;

      const body = request.body;

      if (body.rate_type !== undefined) {
        if (!VALID_RATE_TYPES.includes(body.rate_type)) {
          return reply.status(400).send({ error: 'rate_type must be "market" or "fixed"' });
        }
        updates.push(`rate_type = $${paramIdx++}`);
        values.push(body.rate_type);
      }

      if (body.status !== undefined) {
        if (!VALID_STATUSES.includes(body.status)) {
          return reply.status(400).send({ error: 'Invalid status' });
        }
        updates.push(`status = $${paramIdx++}`);
        values.push(body.status);
      }

      if (body.amount !== undefined) {
        updates.push(`amount = $${paramIdx++}`);
        values.push(body.amount);
      }

      if (body.min_amount !== undefined) {
        updates.push(`min_amount = $${paramIdx++}`);
        values.push(body.min_amount);
      }

      if (body.max_amount !== undefined) {
        updates.push(`max_amount = $${paramIdx++}`);
        values.push(body.max_amount);
      }

      if (body.margin_percent !== undefined) {
        updates.push(`margin_percent = $${paramIdx++}`);
        values.push(body.margin_percent);
      }

      if (body.fixed_price !== undefined) {
        updates.push(`fixed_price = $${paramIdx++}`);
        values.push(body.fixed_price);
      }

      if (body.payment_methods !== undefined) {
        if (!Array.isArray(body.payment_methods) || body.payment_methods.length === 0) {
          return reply.status(400).send({ error: 'At least one payment method is required' });
        }
        if (body.payment_methods.length > 10) {
          return reply.status(400).send({ error: 'Too many settlement methods (max 10)' });
        }
        for (const pm of body.payment_methods) {
          if (!VALID_SETTLEMENT_METHODS.includes(pm)) {
            return reply.status(400).send({ error: `Invalid settlement method: ${pm}` });
          }
        }
        updates.push(`payment_methods = $${paramIdx++}`);
        values.push(JSON.stringify(body.payment_methods));
      }

      if (body.country_code !== undefined) {
        if (body.country_code !== null && !/^[A-Z]{2}$/.test(body.country_code)) {
          return reply.status(400).send({ error: 'country_code must be a 2-letter ISO code' });
        }
        updates.push(`country_code = $${paramIdx++}`);
        values.push(body.country_code);
      }

      if (body.city !== undefined) {
        if (body.city !== null) {
          if (typeof body.city !== 'string' || body.city.length > 30) {
            return reply.status(400).send({ error: 'City must be a string (max 100 chars)' });
          }
          if (/\d/.test(body.city)) {
            return reply.status(400).send({ error: 'City must not contain numbers' });
          }
        }
        updates.push(`city = $${paramIdx++}`);
        values.push(body.city);
      }

      if (body.terms !== undefined) {
        if (body.terms !== null && body.terms.length > 100) {
          return reply.status(400).send({ error: 'Terms too long (max 100 characters)' });
        }
        updates.push(`terms = $${paramIdx++}`);
        values.push(body.terms);
      }

      if (body.price_source !== undefined) {
        if (!VALID_PRICE_SOURCES.includes(body.price_source)) {
          return reply.status(400).send({ error: 'price_source must be "coingecko", "binance", or "kraken"' });
        }
        updates.push(`price_source = $${paramIdx++}`);
        values.push(body.price_source);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Cross-validate min/max amounts (use updated value or fall back to existing)
      const finalMin = body.min_amount ?? existing.rows[0].min_amount;
      const finalMax = body.max_amount ?? existing.rows[0].max_amount;
      if (finalMin > finalMax) {
        return reply.status(400).send({ error: 'min_amount must be less than or equal to max_amount' });
      }

      updates.push(`updated_at = now()`);
      values.push(id);

      const result = await fastify.pg.query(
        `UPDATE exchange_offers SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        values,
      );

      return reply.send(result.rows[0]);
    },
  );

  // DELETE /exchange/offers/:id — remove offer (owner only)
  fastify.delete<{ Params: { id: string } }>(
    '/exchange/offers/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const existing = await fastify.pg.query(
        'SELECT user_id FROM exchange_offers WHERE id = $1',
        [id],
      );
      if (existing.rows.length === 0) {
        return reply.status(404).send({ error: 'Offer not found' });
      }
      if (existing.rows[0].user_id !== userId) {
        return reply.status(403).send({ error: 'Not your offer' });
      }

      await fastify.pg.query(
        "UPDATE exchange_offers SET status = 'removed', updated_at = now() WHERE id = $1",
        [id],
      );

      return reply.status(204).send();
    },
  );
}
