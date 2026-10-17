// Public Supabase settings. Both are safe in the browser: row-level security protects the data.
// The service role key is never read here or anywhere in the web app.
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
