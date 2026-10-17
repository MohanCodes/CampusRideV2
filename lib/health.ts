// What /api/health answers. It is "ok" only if the database really answered a trivial query, so an uptime monitor
// that checks it notices a database outage and a missing setting, not just a running web server.
export type HealthClient = { rpc: (fn: "health") => PromiseLike<{ data: unknown; error: unknown }> };

export async function checkHealth(client: HealthClient | null, timeoutMs = 4000): Promise<{ status: number; body: { ok: boolean } }> {
  if (!client) return { status: 503, body: { ok: false } };
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
    const { data, error } = await Promise.race([Promise.resolve(client.rpc("health")), timeout]);
    return data === true && !error ? { status: 200, body: { ok: true } } : { status: 503, body: { ok: false } };
  } catch {
    return { status: 503, body: { ok: false } };
  }
}
