import type { FastifyInstance } from 'fastify';

export default async function priceRoutes(fastify: FastifyInstance) {
  // GET /prices — full cached price object from Redis (public)
  fastify.get(
    '/prices',
    async (_request, reply) => {
      const cached = await fastify.redis.get('prices:all');
      if (!cached) {
        return reply.status(503).send({ error: 'Price data not yet available' });
      }
      return reply.send(JSON.parse(cached));
    },
  );

  // GET /prices/:crypto — prices for one coin (public)
  fastify.get<{ Params: { crypto: string } }>(
    '/prices/:crypto',
    async (request, reply) => {
      const { crypto } = request.params;
      const symbol = crypto.toUpperCase();

      const cached = await fastify.redis.get('prices:all');
      if (!cached) {
        return reply.status(503).send({ error: 'Price data not yet available' });
      }

      const prices = JSON.parse(cached);
      if (!prices[symbol]) {
        return reply.status(404).send({ error: `No price data for ${symbol}` });
      }

      return reply.send({ symbol, prices: prices[symbol], updated_at: prices.updated_at });
    },
  );

  // GET /prices/exchanges — per-exchange prices (public)
  fastify.get(
    '/prices/exchanges',
    async (_request, reply) => {
      const [coingecko, binance, kraken] = await Promise.all([
        fastify.redis.get('prices:exchange:coingecko'),
        fastify.redis.get('prices:exchange:binance'),
        fastify.redis.get('prices:exchange:kraken'),
      ]);

      return reply.send({
        coingecko: coingecko ? JSON.parse(coingecko) : null,
        binance: binance ? JSON.parse(binance) : null,
        kraken: kraken ? JSON.parse(kraken) : null,
      });
    },
  );

  // GET /supported-coins — list from supported_coins table (public)
  fastify.get(
    '/supported-coins',
    async (_request, reply) => {
      const result = await fastify.pg.query(
        'SELECT symbol, name, coin_type, is_active, sort_order FROM supported_coins WHERE is_active = true ORDER BY sort_order',
      );
      return reply.send({ coins: result.rows });
    },
  );
}
