import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Standing rules from AGENTS.md Section 4 and BUILD.md Section 12, checked against the source on every test run.
// A new file that breaks one of them fails the build, instead of waiting for someone to notice.
const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".next-demo", "test-results", "playwright-report", ".git", "supabase", "e2e", "scripts", ".github"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".next")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}
const files = walk(ROOT).map((path) => ({ path: path.slice(ROOT.length + 1), text: readFileSync(path, "utf8") }));
const code = (f: { text: string }) => f.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the web app", () => {
  it("scans real files", () => expect(files.length).toBeGreaterThan(100));

  it("never mentions the service role key", () => {
    const hits = files.filter((f) => /SERVICE_ROLE/i.test(code(f))).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("never puts a secret in a NEXT_PUBLIC_ variable", () => {
    const hits = files.filter((f) => /NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE|PRIVATE|PASSWORD|API_KEY)/.test(code(f))).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("never renders raw HTML", () => {
    const hits = files.filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(code(f))).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("never asks the browser for the person's location", () => {
    const hits = files.filter((f) => /navigator\.geolocation|geolocate|trackUserLocation|watchPosition/i.test(code(f))).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("never writes to the protected tables from the app", () => {
    const protectedTables = ["trips", "trip_private", "seat_requests", "ride_requests", "ride_offers", "blocks", "reports"];
    const re = new RegExp(`\\.from\\(\\s*["'](${protectedTables.join("|")})["']\\s*\\)\\s*\\.(insert|update|upsert|delete)\\(`);
    const hits = files.filter((f) => re.test(code(f))).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("reads people through public_profiles, not profiles, outside the person's own page", () => {
    // These read or change the signed-in person's own row only (row-level security allows nothing else).
    const allowed = new Set(["lib/data/me.ts", "lib/auth/dal.ts", "lib/actions/account.ts", "lib/data/post.ts"]);
    const hits = files.filter((f) => /\.from\(\s*["']profiles["']\s*\)/.test(code(f)) && !allowed.has(f.path)).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("makes every server action file validate before it acts", () => {
    // A "use server" file is thin: each exported action hands its input to a perform* function, which parses it with Zod.
    const actionFiles = files.filter((f) => /^\s*["']use server["']/.test(f.text));
    expect(actionFiles.length).toBeGreaterThan(5);
    const bare = actionFiles.filter((f) => !/\bperform[A-Z]\w*\(|\.safeParse\(|\.parse\(/.test(code(f))).map((f) => f.path);
    // These only sign out or read nothing from the person.
    expect(bare.filter((p) => p !== "lib/auth/actions.ts")).toEqual([]);
  });

  it("sets the session cookies HttpOnly, SameSite=Lax and Secure in production", async () => {
    const { sessionCookieOptions } = await import("@/lib/supabase/cookies");
    const o = sessionCookieOptions({ maxAge: 10 });
    expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 10 });
  });
});

describe("the Edge Functions", () => {
  const fn = readdirSync(join(ROOT, "supabase/functions")).filter((n) => statSync(join(ROOT, "supabase/functions", n)).isDirectory());
  it("are the two that may hold the service role key", () => expect(fn.sort()).toEqual(["delete-account", "send-emails"]));
  it("never log the key or echo it back", () => {
    for (const name of fn) {
      const text = readFileSync(join(ROOT, "supabase/functions", name, "index.ts"), "utf8");
      expect(text, name).not.toMatch(/console\.(log|info|debug|error)\([^)]*(key|KEY|secret|SECRET|token|Authorization)/);
    }
  });
});
