import { redis } from '../lib/redis.js';

const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  LTC: 'litecoin',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  APT: 'aptos',
  ARB: 'arbitrum',
};

const FIAT_IDS = [
  'usd', 'eur', 'ils', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'cny', 'inr',
  'krw', 'brl', 'mxn', 'sek', 'nok', 'dkk', 'pln', 'czk', 'huf', 'ron',
  'try', 'zar', 'aed', 'sar', 'sgd', 'hkd', 'twd', 'thb', 'nzd', 'rub',
  'uah', 'ngn', 'ars', 'clp', 'cop', 'php', 'idr', 'myr', 'vnd', 'pkr',
  'bgn', 'egp',
];

const POLL_INTERVAL = 60_000; // 60 seconds
const REDIS_TTL = 300; // 5 minutes
const REDIS_KEY = 'prices:all';
const REDIS_LAST_UPDATE = 'prices:last_update';

// Per-exchange Redis keys
const REDIS_KEY_COINGECKO = 'prices:exchange:coingecko';
const REDIS_KEY_BINANCE = 'prices:exchange:binance';
const REDIS_KEY_KRAKEN = 'prices:exchange:kraken';
const REDIS_KEY_FIAT_RATES = 'prices:fiat_rates';

// Binance symbol mapping (crypto → USDT pairs)
const BINANCE_SYMBOLS: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  XRP: 'XRPUSDT',
  ADA: 'ADAUSDT',
  DOGE: 'DOGEUSDT',
  LTC: 'LTCUSDT',
  DOT: 'DOTUSDT',
  AVAX: 'AVAXUSDT',
  MATIC: 'MATICUSDT',
  LINK: 'LINKUSDT',
  ATOM: 'ATOMUSDT',
  UNI: 'UNIUSDT',
  APT: 'APTUSDT',
  ARB: 'ARBUSDT',
};

// Kraken pair mapping (major coins only)
const KRAKEN_PAIRS: Record<string, string> = {
  BTC: 'XBTUSD',
  ETH: 'ETHUSD',
  SOL: 'SOLUSD',
  ADA: 'ADAUSD',
  DOGE: 'DOGEUSD',
  LTC: 'LTCUSD',
  DOT: 'DOTUSD',
  LINK: 'LINKUSD',
};

let consecutiveFailures = 0;

type PriceMap = Record<string, Record<string, number>>;

/**
 * Derive fiat prices from USD-only prices using fiat conversion rates.
 * e.g. BTC→ILS = BTC_USD × USD→ILS rate
 */
function deriveFiatPrices(
  usdOnlyPrices: PriceMap,
  fiatRates: Record<string, number>,
): PriceMap {
  const result: PriceMap = {};

  for (const [crypto, prices] of Object.entries(usdOnlyPrices)) {
    const usdPrice = prices['USD'];
    if (usdPrice === undefined) continue;

    result[crypto] = { USD: usdPrice };

    for (const [fiat, rate] of Object.entries(fiatRates)) {
      if (fiat === 'USD') continue;
      result[crypto][fiat] = usdPrice * rate;
    }
  }

  return result;
}

/**
 * Extract fiat conversion rates from CoinGecko's USDT data.
 * Since USDT ≈ 1 USD, CoinGecko's USDT→fiat prices give us USD→fiat rates.
 */
function extractFiatRates(coingeckoData: PriceMap): Record<string, number> {
  const usdtPrices = coingeckoData['USDT'];
  if (!usdtPrices) return {};

  const rates: Record<string, number> = {};
  for (const [fiat, price] of Object.entries(usdtPrices)) {
    rates[fiat] = price;
  }
  return rates;
}

async function fetchFromCoinGecko(): Promise<PriceMap | null> {
  const ids = Object.values(CRYPTO_IDS).join(',');
  const currencies = FIAT_IDS.join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currencies}`;

  const res = await fetch(url);
  if (res.status === 429) {
    console.warn('[price-feed] CoinGecko rate limited (429)');
    return null;
  }
  if (!res.ok) {
    console.warn(`[price-feed] CoinGecko error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const result: PriceMap = {};

  for (const [symbol, geckoId] of Object.entries(CRYPTO_IDS)) {
    const prices = data[geckoId];
    if (!prices) continue;
    result[symbol] = {};
    for (const fiat of FIAT_IDS) {
      if (prices[fiat] !== undefined) {
        result[symbol][fiat.toUpperCase()] = prices[fiat];
      }
    }
  }

  return result;
}

async function fetchFromBinance(): Promise<PriceMap | null> {
  try {
    const symbols = Object.values(BINANCE_SYMBOLS);
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[price-feed] Binance error: ${res.status}`);
      return null;
    }

    const data: Array<{ symbol: string; price: string }> = await res.json();
    const result: PriceMap = {};

    for (const [crypto, binanceSymbol] of Object.entries(BINANCE_SYMBOLS)) {
      const ticker = data.find((t) => t.symbol === binanceSymbol);
      if (ticker) {
        result[crypto] = { USD: parseFloat(ticker.price) };
      }
    }

    // USDT and USDC are stablecoins, ~1 USD
    result['USDT'] = { USD: 1.0 };
    result['USDC'] = { USD: 1.0 };

    return result;
  } catch (err) {
    console.warn('[price-feed] Binance fetch failed:', err);
    return null;
  }
}

async function fetchFromKraken(): Promise<PriceMap | null> {
  try {
    const pairs = Object.values(KRAKEN_PAIRS).join(',');
    const url = `https://api.kraken.com/0/public/Ticker?pair=${pairs}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[price-feed] Kraken error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.error?.length > 0) {
      console.warn('[price-feed] Kraken API error:', data.error);
      return null;
    }

    const result: PriceMap = {};
    const krakenResult = data.result as Record<string, { c: string[] }>;

    for (const [crypto, krakenPair] of Object.entries(KRAKEN_PAIRS)) {
      // Try exact key match first, then fuzzy (Kraken returns e.g. XXBTZUSD for XBTUSD)
      let tickerData = krakenResult[krakenPair];
      if (!tickerData) {
        const altKey = Object.keys(krakenResult).find(
          (k) => k.includes(krakenPair) || krakenPair.includes(k),
        );
        if (altKey) tickerData = krakenResult[altKey];
      }
      if (tickerData?.c?.[0]) {
        result[crypto] = { USD: parseFloat(tickerData.c[0]) };
      }
    }

    result['USDT'] = { USD: 1.0 };
    result['USDC'] = { USD: 1.0 };

    return result;
  } catch (err) {
    console.warn('[price-feed] Kraken fetch failed:', err);
    return null;
  }
}

async function fetchPrices(): Promise<void> {
  // Fetch all three exchanges in parallel
  const [coingecko, binance, kraken] = await Promise.all([
    fetchFromCoinGecko().catch((err) => {
      console.warn('[price-feed] CoinGecko fetch error:', err);
      return null;
    }),
    fetchFromBinance().catch((err) => {
      console.warn('[price-feed] Binance fetch error:', err);
      return null;
    }),
    fetchFromKraken().catch((err) => {
      console.warn('[price-feed] Kraken fetch error:', err);
      return null;
    }),
  ]);

  // Need at least one source for merged blob
  const merged = coingecko ?? binance ?? kraken;

  if (!merged) {
    consecutiveFailures++;
    console.error(`[price-feed] All sources failed (${consecutiveFailures} consecutive)`);
    return;
  }

  consecutiveFailures = 0;
  const now = new Date().toISOString();

  // Extract fiat rates from CoinGecko USDT data for deriving Binance/Kraken fiat prices
  const fiatRates = coingecko ? extractFiatRates(coingecko) : {};

  // Derive full fiat prices for Binance and Kraken (they only have USD)
  const binanceFull = binance && Object.keys(fiatRates).length > 0
    ? deriveFiatPrices(binance, fiatRates)
    : binance;
  const krakenFull = kraken && Object.keys(fiatRates).length > 0
    ? deriveFiatPrices(kraken, fiatRates)
    : kraken;

  // Write all keys atomically using pipeline
  const pipeline = redis.pipeline();

  // Backward-compatible merged blob
  const mergedPayload = { ...merged, updated_at: now };
  pipeline.set(REDIS_KEY, JSON.stringify(mergedPayload), 'EX', REDIS_TTL);
  pipeline.set(REDIS_LAST_UPDATE, now, 'EX', REDIS_TTL);

  // Per-exchange keys
  if (coingecko) {
    pipeline.set(REDIS_KEY_COINGECKO, JSON.stringify({ ...coingecko, updated_at: now }), 'EX', REDIS_TTL);
  }
  if (binanceFull) {
    pipeline.set(REDIS_KEY_BINANCE, JSON.stringify({ ...binanceFull, updated_at: now }), 'EX', REDIS_TTL);
  }
  if (krakenFull) {
    pipeline.set(REDIS_KEY_KRAKEN, JSON.stringify({ ...krakenFull, updated_at: now }), 'EX', REDIS_TTL);
  }

  // Fiat rates for reference
  if (Object.keys(fiatRates).length > 0) {
    pipeline.set(REDIS_KEY_FIAT_RATES, JSON.stringify(fiatRates), 'EX', REDIS_TTL);
  }

  await pipeline.exec();

  const sources = [coingecko && 'CoinGecko', binance && 'Binance', kraken && 'Kraken'].filter(Boolean).join(', ');
  const coinCount = Object.keys(merged).length;
  console.log(`[price-feed] Cached prices for ${coinCount} coins from [${sources}] at ${now}`);
}

export function startPriceFeed(): void {
  console.log('[price-feed] Starting price feed worker (60s interval)');

  // Initial fetch
  fetchPrices().catch((err) => console.error('[price-feed] Initial fetch error:', err));

  // Recurring poll
  setInterval(() => {
    const backoff = consecutiveFailures > 0
      ? Math.min(consecutiveFailures * 2, 10) // up to 10x delay
      : 1;

    if (backoff > 1) {
      console.log(`[price-feed] Backing off ${backoff}x due to ${consecutiveFailures} failures`);
    }

    setTimeout(
      () => fetchPrices().catch((err) => console.error('[price-feed] Poll error:', err)),
      (backoff - 1) * POLL_INTERVAL,
    );
  }, POLL_INTERVAL);
}
