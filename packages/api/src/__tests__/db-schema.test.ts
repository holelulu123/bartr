import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

const EXPECTED_TABLES = [
  'users',
  'categories',
  'listings',
  'listing_images',
  'trades',
  'trade_events',
  'ratings',
  'reputation_scores',
  'message_threads',
  'messages',
  'moderation_flags',
];

describe('Database schema', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('has all expected tables', async () => {
    const result = await app.pg.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    const tables = result.rows.map((r: { table_name: string }) => r.table_name);

    for (const table of EXPECTED_TABLES) {
      expect(tables).toContain(table);
    }
  });

  it('users table has correct columns', async () => {
    const result = await app.pg.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`,
    );
    const columns = result.rows.map((r: { column_name: string }) => r.column_name);

    expect(columns).toContain('id');
    expect(columns).toContain('google_id');
    expect(columns).toContain('nickname');
    expect(columns).toContain('password_hash');
    expect(columns).toContain('created_at');
  });

  it('listings table has jsonb payment_methods', async () => {
    const result = await app.pg.query(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'payment_methods'`,
    );
    expect(result.rows[0].data_type).toBe('jsonb');
  });

  it('ratings score has check constraint (1-5)', async () => {
    const result = await app.pg.query(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'ratings' AND constraint_type = 'CHECK'`,
    );
    expect(result.rows.length).toBeGreaterThan(0);
  });
});
