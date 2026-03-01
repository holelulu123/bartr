import path from 'node:path';
import fs from 'node:fs/promises';
import type pg from 'pg';

/**
 * Programmatic migration runner.
 *
 * - Creates `schema_migrations` tracking table if it does not exist.
 * - Reads *.sql files from `db/migrations/` (relative to monorepo root).
 * - Applies each un-applied migration inside a transaction.
 * - Logs progress to console (runs before Fastify logger is available).
 */
export async function runMigrations(pool: pg.Pool): Promise<void> {
  const migrationsDir =
    process.env.MIGRATIONS_DIR ||
    path.join(process.cwd(), '..', '..', 'db', 'migrations');

  // Ensure tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  // Read and sort migration files
  let files: string[];
  try {
    const entries = await fs.readdir(migrationsDir);
    files = entries.filter((f) => f.endsWith('.sql')).sort();
  } catch (err) {
    console.error(
      `[migrate] Could not read migrations directory: ${migrationsDir}`,
    );
    throw err;
  }

  if (files.length === 0) {
    console.log('[migrate] No migration files found');
    return;
  }

  // Fetch already-applied migrations
  const { rows: applied } = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  let newCount = 0;

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const filePath = path.join(migrationsDir, file);
    const sql = await fs.readFile(filePath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
      console.log(`[migrate] Applied ${file}`);
      newCount++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] Failed to apply ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  if (newCount === 0) {
    console.log(
      `[migrate] All ${files.length} migrations already applied`,
    );
  } else {
    console.log(
      `[migrate] Applied ${newCount} new migration(s) (${files.length} total)`,
    );
  }
}
