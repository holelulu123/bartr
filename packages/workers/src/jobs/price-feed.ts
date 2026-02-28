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

async function fetchFromCoinGecko(): Promise<Record<string, Record<string, number>> | null> {
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
  const result: Record<string, Record<string, number>> = {};

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

async function fetchFromBinance(): Promise<Record<string, Record<string, number>> | null> {
  try {
    const symbols = Object.values(BINANCE_SYMBOLS);
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[price-feed] Binance error: ${res.status}`);
      return null;
    }

    const data: Array<{ symbol: string; price: string }> = await res.json();
    const result: Record<string, Record<string, number>> = {};

    for (const [crypto, binanceSymbol] of Object.entries(BINANCE_SYMBOLS)) {
      const ticker = data.find((t) => t.symbol === binanceSymbol);
      if (ticker) {
        // Binance only gives USDT price; we map that as USD approximation
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

async function fetchFromKraken(): Promise<Record<string, Record<string, number>> | null> {
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

    const result: Record<string, Record<string, number>> = {};

    for (const [crypto, krakenPair] of Object.entries(KRAKEN_PAIRS)) {
      // Kraken returns keys with different naming conventions
      const tickerData = Object.values(data.result as Record<string, { c: string[] }>)[
        Object.keys(KRAKEN_PAIRS).indexOf(crypto)
      ];
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
  // Try CoinGecko first (has all crypto + fiat pairs)
  let prices = await fetchFromCoinGecko();

  if (!prices) {
    console.log('[price-feed] CoinGecko unavailable, trying Binance...');
    prices = await fetchFromBinance();
  }

  if (!prices) {
    console.log('[price-feed] Binance unavailable, trying Kraken...');
    prices = await fetchFromKraken();
  }

  if (!prices) {
    consecutiveFailures++;
    console.error(`[price-feed] All sources failed (${consecutiveFailures} consecutive)`);
    return;
  }

  consecutiveFailures = 0;
  const now = new Date().toISOString();
  const payload = { ...prices, updated_at: now };

  await redis.set(REDIS_KEY, JSON.stringify(payload), 'EX', REDIS_TTL);
  await redis.set(REDIS_LAST_UPDATE, now, 'EX', REDIS_TTL);

  const coinCount = Object.keys(prices).length;
  console.log(`[price-feed] Cached prices for ${coinCount} coins at ${now}`);
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
