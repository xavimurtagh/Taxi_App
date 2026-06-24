import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import env from '../config/env.js';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/**
 * Lightweight SQL migration runner.
 *
 * - Applies every `NNN_*.sql` file in backend/migrations/ in ascending order.
 * - Records applied migrations in the `schema_migrations` table so each file
 *   runs exactly once (idempotent across repeated invocations).
 * - Ensures required extensions (postgis, pgcrypto) exist before running.
 *
 * Usage: `npm run migrate`
 */
async function migrate() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  console.log('[migrate] Connected to database');

  try {
    // Required extensions. The production postgis/postgis image ships postgis,
    // but pgcrypto (gen_random_uuid) and postgis must both be present.
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    // Migration bookkeeping table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map(
        (r) => r.filename
      )
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort();

    if (files.length === 0) {
      console.log('[migrate] No migration files found');
      return;
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip   ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const hasOwnTransaction = /\bBEGIN\b/i.test(sql) && /\bCOMMIT\b/i.test(sql);

      console.log(`[migrate] apply  ${file}`);
      try {
        if (hasOwnTransaction) {
          // File manages its own transaction — run as-is, then record.
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [file]
          );
        } else {
          // Wrap in a transaction so a failure rolls the file back atomically.
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
        }
        ran += 1;
      } catch (err) {
        if (!hasOwnTransaction) {
          await client.query('ROLLBACK').catch(() => {});
        }
        console.error(`[migrate] FAILED ${file}: ${err.message}`);
        throw err;
      }
    }

    console.log(
      `[migrate] Done. ${ran} migration(s) applied, ${files.length - ran} already up to date.`
    );
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('[migrate] Migration run failed:', err.message);
  process.exit(1);
});
