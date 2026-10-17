// The Content-Security-Policy (BUILD.md Section 12): the app itself, Supabase, Mapbox and Sentry, and nothing else.
// proxy.ts builds one per request with a fresh nonce, so scripts run only if this response put them on the page.
// Pure function so the header can be tested without a server.

export type CspOptions = {
  nonce: string;
  /** NEXT_PUBLIC_SUPABASE_URL, if set. Needed for the API, Realtime (wss) and signed photo links. */
  supabaseUrl?: string | null;
  /** SENTRY_DSN, if set. Only its host is allowed. */
  sentryDsn?: string | null;
  dev?: boolean;
};

function origin(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function buildCsp({ nonce, supabaseUrl, sentryDsn, dev = false }: CspOptions): string {
  const supabase = origin(supabaseUrl);
  const sentry = origin(sentryDsn);
  const wss = supabase ? `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}` : null;

  const connect = [
    "'self'",
    supabase?.origin,
    wss,
    "https://api.mapbox.com",
    "https://events.mapbox.com",
    "https://*.tiles.mapbox.com",
    sentry ? `https://${sentry.host}` : null,
    dev ? "ws://localhost:*" : null,
    dev ? "http://127.0.0.1:*" : null,
  ];
  const img = ["'self'", "data:", "blob:", "https://api.mapbox.com", "https://*.tiles.mapbox.com", supabase?.origin];

  const directives: [string, (string | null | undefined)[]][] = [
    ["default-src", ["'self'"]],
    // 'strict-dynamic' lets the nonce-approved Next scripts load their own chunks. Dev needs eval for fast refresh.
    ["script-src", ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", dev ? "'unsafe-eval'" : null]],
    // Inline styles: Tailwind output is a file, but Next, Mapbox and a few components set style attributes.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", img],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connect],
    // Mapbox GL runs its map in a worker made from a blob.
    ["worker-src", ["'self'", "blob:"]],
    ["child-src", ["blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["manifest-src", ["'self'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`);
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** A fresh, unguessable value for one response. */
export function makeNonce(): string {
  return btoa(crypto.randomUUID());
}
