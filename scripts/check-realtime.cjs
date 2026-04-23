const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const url = fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('ERROR: SUPABASE_DB_PASSWORD not found (set it in .env.local or as an env var)');
  process.exit(1);
}
const u = new URL(url);
u.password = encodeURIComponent(password);
const client = new Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    await client.connect();

    const pubs = await client.query('SELECT pubname FROM pg_publication ORDER BY pubname');
    console.log('--- Publications ---');
    pubs.rows.forEach((r) => console.log('  ' + r.pubname));

    const tables = await client.query(
      "SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY schemaname, tablename",
    );
    console.log('\n--- Tables published to supabase_realtime (' + tables.rows.length + ') ---');
    if (tables.rows.length === 0) console.log('  (none)');
    else tables.rows.forEach((r) => console.log('  ' + r.schemaname + '.' + r.tablename));

    const allTables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const pubSet = new Set(
      tables.rows.filter((r) => r.schemaname === 'public').map((r) => r.tablename),
    );
    console.log('\n--- All public tables (' + allTables.rows.length + ') - * = published ---');
    allTables.rows.forEach((r) =>
      console.log('  ' + (pubSet.has(r.tablename) ? '*' : ' ') + ' ' + r.tablename),
    );

    await client.end();
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
