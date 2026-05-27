/**
 * Apply a single SQL migration file against POSTGRES_URL_NON_POOLING.
 *
 * Usage:
 *   npx tsx scripts/db-migrate.ts supabase/migrations/20260527_0001_init.sql
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/db-migrate.ts <path-to-sql>");
    process.exit(1);
  }

  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    console.error("POSTGRES_URL_NON_POOLING is not set in env");
    process.exit(1);
  }

  const sql = readFileSync(resolve(file), "utf8");
  // Strip sslmode from URL — pg-connection-string v3 deprecation makes
  // require/prefer behave as verify-full; we explicitly opt out via ssl object.
  const cleanUrl = url.replace(/[?&]sslmode=[^&]*/g, "");
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`→ Connecting to Postgres`);
  await client.connect();

  console.log(`→ Applying ${file} (${sql.length} bytes)`);
  try {
    await client.query(sql);
    console.log("✓ Migration applied successfully");
  } catch (err) {
    const e = err as Error & { position?: string; detail?: string };
    console.error(`✗ Migration failed: ${e.message}`);
    if (e.detail) console.error(`  detail: ${e.detail}`);
    if (e.position) console.error(`  position: ${e.position}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
