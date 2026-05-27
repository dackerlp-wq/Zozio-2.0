import { Client } from "pg";
async function main() {
  const c = new Client({
    connectionString: process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]*/g, ""),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const r = await c.query("select id, name from animals order by name limit 5");
  for (const x of r.rows) console.log(`${x.id}\t${x.name}`);
  await c.end();
}
main();
