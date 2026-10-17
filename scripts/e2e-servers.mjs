// Builds and serves the app twice for the browser tests:
//   3100  the normal app (no backend), for the landing page and sign-in
//   3101  demo mode with sample data and a pinned clock, for the board and trip pages
// Playwright starts this script and waits for port 3101, which comes up last.
import { spawn, spawnSync } from "node:child_process";

// A developer's .env.local must not turn these "no backend" servers into real ones. Next only reads .env.local for
// variables that are not already defined, and an empty value counts as defined (and as "not set" to the app).
// Its own build folder, so a `next dev` running alongside is not overwritten.
const env = { ...process.env, NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" };
const demoEnv = {
  ...env,
  NEXT_DIST_DIR: ".next-demo",
  CAMPUS_RIDE_DEMO: "1",
  CAMPUS_RIDE_DEMO_NOW: "2026-10-17T20:00:00Z", // Saturday, 1:00 PM in Los Angeles
};

function build(e) {
  const r = spawnSync("npx", ["next", "build"], { stdio: "inherit", env: e });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
build(env);
build(demoEnv);

const servers = [
  spawn("npx", ["next", "start", "-p", "3100"], { stdio: "inherit", env }),
  spawn("npx", ["next", "start", "-p", "3101"], { stdio: "inherit", env: demoEnv }),
];
const stop = () => servers.forEach((s) => s.kill("SIGTERM"));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
servers[0].on("exit", () => process.exit(1));
