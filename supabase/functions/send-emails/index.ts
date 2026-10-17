// The send-emails Edge Function (BUILD.md Section 8.1). A scheduled job calls it every minute with a shared
// secret. It claims due rows from email_outbox, sends them through Resend, and reports each result.
//
// Secrets (Edge Function secrets, never in the web app): RESEND_API_KEY, EMAIL_FROM, EMAIL_FUNCTION_SECRET,
// SITE_URL. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
// It uses only fetch, so there is nothing to install.
import { processBatch, secretsMatch } from "./process.ts";
import type { ClaimedEmail } from "./templates.ts";

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };

const env = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`missing setting: ${key}`);
  return v;
};

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name} failed (${res.status})`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!secretsMatch(req.headers.get("x-function-secret"), Deno.env.get("EMAIL_FUNCTION_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const from = env("EMAIL_FROM");
    const resendKey = env("RESEND_API_KEY");
    const result = await processBatch({
      siteUrl: env("SITE_URL"),
      now: () => new Date(),
      claim: (limit) => rpc<ClaimedEmail[]>("claim_emails", { p_limit: limit }),
      markSent: (id) => rpc("mark_email_sent", { p_id: id }),
      markFailed: (id, error) => rpc("mark_email_failed", { p_id: id, p_error: error }),
      send: async (m) => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
        });
        // The response body can echo the address, so only the status goes into the stored error.
        if (!res.ok) throw new Error(`Resend refused the email (${res.status})`);
      },
      // Resend allows about two requests a second.
      pause: () => new Promise((r) => setTimeout(r, 550)),
    });
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
