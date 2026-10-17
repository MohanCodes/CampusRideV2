// The second half of deleting an account (BUILD.md Section 11). The web app first calls request_account_deletion(),
// which clears the profile and cancels what is ahead. This function then removes the photo file and the sign-in.
// The steps are written against small injected pieces so they can be tested without a network.
//
// It only ever finishes an account that was closed in step one (profiles.deleted_at is set), and only for the
// person whose sign-in token arrived. It cannot be used to delete anyone else, or an account still in use.

export type FinishDeps = {
  /** The user id for this bearer token, or null if the token is not valid. */
  userFromToken: (token: string) => Promise<string | null>;
  /** True if the profile exists and was closed by request_account_deletion(). */
  isClosed: (userId: string) => Promise<boolean>;
  /** Photo files stored under {userId}/. */
  listPhotos: (userId: string) => Promise<string[]>;
  removePhotos: (paths: string[]) => Promise<void>;
  deleteSignIn: (userId: string) => Promise<void>;
};

export type FinishResult = { status: number; body: { ok: boolean; error?: string } };

export function bearer(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return m ? m[1] : null;
}

export async function finishDeletion(authHeader: string | null, d: FinishDeps): Promise<FinishResult> {
  const token = bearer(authHeader);
  if (!token) return { status: 401, body: { ok: false, error: "not_signed_in" } };
  const userId = await d.userFromToken(token);
  if (!userId) return { status: 401, body: { ok: false, error: "not_signed_in" } };
  // Closing the account comes first, so this function can never remove a live account.
  if (!(await d.isClosed(userId))) return { status: 409, body: { ok: false, error: "not_requested" } };

  const photos = await d.listPhotos(userId);
  if (photos.length) await d.removePhotos(photos);
  // Last, because after this the token stops working. Running it again after a failure here is safe.
  await d.deleteSignIn(userId);
  return { status: 200, body: { ok: true } };
}
