import { Client } from "pg";

async function main() {
  const url = process.env.POSTGRES_URL_NON_POOLING!;
  const client = new Client({
    connectionString: url.replace(/[?&]sslmode=[^&]*/g, ""),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const tables = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name;
  `);
  console.log("Tables in public schema:");
  for (const t of tables.rows) console.log(`  ✓ ${t.table_name}`);

  const policies = await client.query(`
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname;
  `);
  console.log(`\nRLS policies: ${policies.rowCount}`);
  for (const p of policies.rows) {
    console.log(`  ✓ ${p.tablename}.${p.policyname}`);
  }

  await client.end();
}

main();
