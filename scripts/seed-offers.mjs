#!/usr/bin/env node
// Seed 40 test exchange offers via the API.
// Usage:   node scripts/seed-offers.mjs
// Cleanup: node scripts/seed-offers.mjs --cleanup

import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';

const API = 'http://localhost:4000';
const EMAIL = 'seedbot@test.local';
const PASS = 'SeedBot123!';
const IDS_FILE = '/tmp/seeded-offer-ids.json';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : null;
}

async function login() {
  // Try register first (may fail if exists)
  try {
    await api('POST', '/auth/register/email', { email: EMAIL, password: PASS });
    console.log('Registered test account.');
  } catch {
    // already exists, fine
  }

  const data = await api('POST', '/auth/login/email', { email: EMAIL, password: PASS });
  const token = data.token || data.access_token;
  if (!token) throw new Error('Login failed — no token returned');
  console.log('Logged in.');
  return token;
}

// ── Cleanup ──
if (process.argv.includes('--cleanup')) {
  if (!existsSync(IDS_FILE)) {
    console.log('No seeded offers file found.');
    process.exit(1);
  }
  const ids = JSON.parse(readFileSync(IDS_FILE, 'utf8'));
  const token = await login();
  let deleted = 0;
  for (const id of ids) {
    try {
      await api('DELETE', `/exchange/offers/${id}`, null, token);
      deleted++;
    } catch { /* already gone */ }
  }
  if (deleted > 0 || deleted === ids.length) unlinkSync(IDS_FILE);
  console.log(`Deleted ${deleted}/${ids.length} offers.${deleted === 0 ? ' IDs file kept for retry.' : ''}`);
  process.exit(0);
}

// ── Seed ──
const CRYPTOS = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'];
const FIATS = ['USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CAD'];
const TYPES = ['buy', 'sell'];
const SOURCES = ['coingecko', 'binance', 'kraken'];
const METHODS_LIST = [
  ['bank_transfer'],
  ['cash'],
  ['paypal'],
  ['bank_transfer', 'cash'],
  ['wise'],
  ['revolut'],
  ['bank_transfer', 'paypal'],
  ['cash', 'wise'],
  ['sepa'],
  ['zelle', 'venmo'],
];
const COUNTRIES = ['US', 'GB', 'DE', 'IL', 'JP', 'CA', 'FR', 'AU', 'NL', 'SE'];
const CITIES = ['New York', 'London', 'Berlin', 'Tel Aviv', 'Tokyo', 'Toronto', 'Paris', 'Sydney', 'Amsterdam', 'Stockholm'];
const TERMS = [
  'Fast and reliable trader, reply within five minutes',
  'No third-party payments accepted',
  'ID verification required for large amounts',
  'Weekend trades only',
  'Available Mon-Fri nine to six UTC',
  'Experienced trader with many completed deals',
  'First-time traders welcome',
  'Quick release, please have payment ready',
  'Small amounts preferred',
  '',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const token = await login();
const ids = [];

console.log('Creating 40 offers...');
for (let i = 1; i <= 40; i++) {
  const ci = Math.floor(Math.random() * COUNTRIES.length);
  const minAmt = randInt(1, 9) * 100;
  const maxAmt = minAmt + randInt(1, 9) * 1000;
  const terms = pick(TERMS);

  const body = {
    offer_type: pick(TYPES),
    crypto_currency: pick(CRYPTOS),
    fiat_currency: pick(FIATS),
    rate_type: 'market',
    price_source: pick(SOURCES),
    margin_percent: randInt(-5, 5),
    min_amount: minAmt,
    max_amount: maxAmt,
    payment_methods: pick(METHODS_LIST),
    country_code: COUNTRIES[ci],
    city: CITIES[ci],
    ...(terms && { terms }),
  };

  try {
    const offer = await api('POST', '/exchange/offers', body, token);
    ids.push(offer.id);
    console.log(`  [${i}/40] ${body.offer_type} ${body.crypto_currency}/${body.fiat_currency} → ${offer.id.slice(0, 8)}...`);
  } catch (err) {
    console.log(`  [${i}/40] FAILED: ${err.message}`);
  }
}

writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));
console.log(`\nDone! Created ${ids.length} offers.`);
console.log('To remove them: node scripts/seed-offers.mjs --cleanup');
