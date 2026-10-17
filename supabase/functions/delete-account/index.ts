// The delete-account Edge Function (BUILD.md Sections 2 and 11). The signed-in person calls it right after
// request_account_deletion(). It uses the service role to remove their photo file and sign-in. verify_jwt is on,
// and the token is checked again against Auth to learn who is calling.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to the function automatically. It uses only fetch.
import { finishDeletion, type FinishDeps } from "./finish.ts";

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };

const env = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`missing setting: ${key}`);
  return v;
};

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

function deps(): FinishDeps {
  const base = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const svc = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return {
    userFromToken: async (token) => {
      const res = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const u = await res.json();
      return typeof u?.id === "string" ? u.id : null;
    },
    isClosed: async (id) => {
      const res = await fetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=deleted_at`, { headers: svc });
      if (!res.ok) throw new Error(`profile lookup failed (${res.status})`);
      const rows = await res.json();
      return Array.isArray(rows) && rows.length === 1 && rows[0].deleted_at !== null;
    },
    listPhotos: async (id) => {
      const res = await fetch(`${base}/storage/v1/object/list/avatars`, { method: "POST", headers: svc, body: JSON.stringify({ prefix: `${id}/`, limit: 100 }) });
      if (!res.ok) throw new Error(`photo list failed (${res.status})`);
      const items = (await res.json()) as { name: string }[];
      return items.map((i) => `${id}/${i.name}`);
    },
    removePhotos: async (paths) => {
      const res = await fetch(`${base}/storage/v1/object/avatars`, { method: "DELETE", headers: svc, body: JSON.stringify({ prefixes: paths }) });
      if (!res.ok) throw new Error(`photo delete failed (${res.status})`);
    },
    deleteSignIn: async (id) => {
      const res = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", headers: svc });
      if (!res.ok && res.status !== 404) throw new Error(`sign-in delete failed (${res.status})`);
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  try {
    const r = await finishDeletion(req.headers.get("authorization"), deps());
    return json(r.status, r.body);
  } catch (e) {
    // Only a short reason goes back; nothing from the request is echoed.
    return json(500, { ok: false, error: e instanceof Error ? e.message : "failed" });
  }
});
