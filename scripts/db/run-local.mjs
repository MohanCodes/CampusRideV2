// Builds the database from supabase/migrations on a throwaway PostgreSQL (no Docker), loads the
// seeds, then runs the SQL tests in supabase/tests and the concurrent-session tests in
// supabase/tests/race. See scripts/db/README.md for what this does and does not prove.
//
//   node scripts/db/run-local.mjs                 run everything
//   node scripts/db/run-local.mjs step5           only test files whose name contains "step5"
//   VERBOSE=1 ...                                 list every passing assertion too
//   KEEP=1 ...                                    leave the database running after the run
//   EXTRA_SQL='...' ...                           run extra SQL after the migrations (mutation checks)
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const filter = process.argv[2];

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on("error", reject);
  });

const port = await freePort();
const dir = mkdtempSync(join(tmpdir(), "campus-ride-pg-"));
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: false, onLog: () => {}, onError: () => {} });
await server.initialise();
await server.start();
const url = `postgresql://postgres:postgres@localhost:${port}/postgres`;
const client = new pg.Client({ connectionString: url });
await client.connect();

let failed = 0;
const fail = (msg) => { failed++; console.log(msg); };

try {
  await client.query(read("scripts/db/stubs.sql"));
  // pg_cron and pg_net are Supabase extensions; pgcrypto comes with PostgreSQL.
  for (const f of readdirSync(join(root, "supabase/migrations")).sort()) {
    const sql = read(`supabase/migrations/${f}`).replace(/^create extension if not exists (pg_cron|pg_net);$/gm, "");
    try { await client.query(sql); }
    catch (e) { console.log(`FAIL migration ${f}\n     ${e.message}`); process.exit(1); }
  }
  console.log("migrations: all applied");
  // For mutation checks: break something on purpose and confirm a test notices.
  if (process.env.EXTRA_SQL) await client.query(process.env.EXTRA_SQL);
  for (const f of ["supabase/seed.sql", "supabase/seed_dev.sql"]) {
    try { await client.query(read(f)); }
    catch (e) { console.log(`FAIL ${f}\n     ${e.message}`); process.exit(1); }
  }
  console.log("seeds: loaded");
  await client.query(read("scripts/db/shim.sql"));

  for (const file of readdirSync(join(root, "supabase/tests")).filter((f) => f.endsWith(".test.sql")).sort()) {
    if (filter && !file.includes(filter)) continue;
    const sql = read(`supabase/tests/${file}`).replace("select * from finish();", "").replace(/^rollback;$/m, "");
    const planned = Number(/select plan\((\d+)\)/.exec(sql)[1]);
    process.stdout.write(`${file}: `);
    try { await client.query(sql); }
    catch (e) { fail(`ERROR while running: ${e.message}`); await client.query("rollback"); continue; }
    const rows = (await client.query("select n, ok, d from shim.results order by n")).rows;
    await client.query("reset role; rollback;");
    const bad = rows.filter((r) => !r.ok);
    console.log(`planned ${planned}, ran ${rows.length}, failed ${bad.length}`);
    for (const r of rows) if (!r.ok || process.env.VERBOSE) console.log(`  ${r.ok ? "ok    " : "NOT OK"} ${r.n} ${r.d}`);
    if (bad.length || rows.length !== planned) failed++;
    await client.query("truncate shim.results restart identity");
  }

  // Tests that need several database sessions at once (locks, races). They read DATABASE_URL.
  const raceDir = join(root, "supabase/tests/race");
  for (const file of readdirSync(raceDir).filter((f) => f.endsWith(".mjs") && !f.startsWith("_")).sort()) {
    if (filter && !file.includes(filter)) continue;
    process.stdout.write(`race/${file}: `);
    const code = await new Promise((resolve) => {
      const p = spawn(process.execPath, [join(raceDir, file)], { env: { ...process.env, DATABASE_URL: url }, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (out += d));
      p.on("close", (c) => { console.log(c === 0 ? "passed" : "FAILED"); if (c !== 0 || process.env.VERBOSE) console.log(out.replace(/^/gm, "  ")); resolve(c); });
    });
    if (code !== 0) failed++;
  }
} finally {
  await client.end().catch(() => {});
  if (process.env.KEEP) console.log(`left running: ${url}`);
  else {
    await server.stop().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);
