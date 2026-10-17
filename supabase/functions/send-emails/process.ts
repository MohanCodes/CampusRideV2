// The send loop, with every outside dependency passed in so it can be tested without a network or a database.
import { renderEmail, type ClaimedEmail, type Rendered } from "./templates.ts";

export type Deps = {
  claim: (limit: number) => Promise<ClaimedEmail[]>;
  send: (message: Rendered & { to: string }) => Promise<void>;
  markSent: (id: number) => Promise<void>;
  markFailed: (id: number, error: string) => Promise<void>;
  siteUrl: string;
  now: () => Date;
  // A pause between sends, to stay under the provider's rate limit.
  pause?: () => Promise<void>;
};

export type BatchResult = { claimed: number; sent: number; failed: number };

// Claims up to `limit` due emails, renders and sends each, and reports back one by one. One bad email never
// stops the rest: it is marked failed (the database retries it later with a growing delay).
export async function processBatch(deps: Deps, limit = 50): Promise<BatchResult> {
  const batch = await deps.claim(limit);
  let sent = 0;
  let failed = 0;
  for (const email of batch) {
    try {
      const message = renderEmail(email, { siteUrl: deps.siteUrl, now: deps.now() });
      await deps.send({ ...message, to: email.to_email });
      await deps.markSent(email.id);
      sent++;
    } catch (e) {
      failed++;
      await deps.markFailed(email.id, e instanceof Error ? e.message : String(e)).catch(() => {});
    }
    if (deps.pause) await deps.pause();
  }
  return { claimed: batch.length, sent, failed };
}

// Compares two secrets without stopping at the first difference, so response timing doesn't leak how much matched.
export function secretsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
