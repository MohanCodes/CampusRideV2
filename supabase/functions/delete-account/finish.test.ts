import { describe, expect, it, vi } from "vitest";
import { bearer, finishDeletion, type FinishDeps } from "./finish.ts";

const make = (over: Partial<FinishDeps> = {}) => {
  const calls: string[] = [];
  const deps: FinishDeps = {
    userFromToken: vi.fn(async (t) => (t === "good" ? "u1" : null)),
    isClosed: vi.fn(async () => true),
    listPhotos: vi.fn(async () => ["u1/profile.jpg"]),
    removePhotos: vi.fn(async () => { calls.push("photos"); }),
    deleteSignIn: vi.fn(async () => { calls.push("signin"); }),
    ...over,
  };
  return { deps, calls };
};

describe("bearer", () => {
  it("reads a bearer token", () => expect(bearer("Bearer abc.def")).toBe("abc.def"));
  it("rejects anything else", () => {
    expect(bearer(null)).toBeNull();
    expect(bearer("Basic abc")).toBeNull();
    expect(bearer("Bearer")).toBeNull();
  });
});

describe("finishDeletion", () => {
  it("removes the photo, then the sign-in", async () => {
    const { deps, calls } = make();
    const r = await finishDeletion("Bearer good", deps);
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(deps.removePhotos).toHaveBeenCalledWith(["u1/profile.jpg"]);
    expect(calls).toEqual(["photos", "signin"]);
  });
  it("needs a token", async () => {
    const { deps } = make();
    expect((await finishDeletion(null, deps)).status).toBe(401);
    expect(deps.deleteSignIn).not.toHaveBeenCalled();
  });
  it("refuses a token Auth does not know", async () => {
    const { deps } = make();
    expect((await finishDeletion("Bearer forged", deps)).status).toBe(401);
    expect(deps.deleteSignIn).not.toHaveBeenCalled();
  });
  it("never removes an account that is still in use", async () => {
    const { deps } = make({ isClosed: vi.fn(async () => false) });
    const r = await finishDeletion("Bearer good", deps);
    expect(r).toEqual({ status: 409, body: { ok: false, error: "not_requested" } });
    expect(deps.removePhotos).not.toHaveBeenCalled();
    expect(deps.deleteSignIn).not.toHaveBeenCalled();
  });
  it("skips the photo call when there is no photo", async () => {
    const { deps, calls } = make({ listPhotos: vi.fn(async () => []) });
    await finishDeletion("Bearer good", deps);
    expect(deps.removePhotos).not.toHaveBeenCalled();
    expect(calls).toEqual(["signin"]);
  });
  it("keeps the sign-in if the photo cannot be removed, so it can be retried", async () => {
    const { deps } = make({ removePhotos: vi.fn(async () => { throw new Error("storage down"); }) });
    await expect(finishDeletion("Bearer good", deps)).rejects.toThrow("storage down");
    expect(deps.deleteSignIn).not.toHaveBeenCalled();
  });
});
