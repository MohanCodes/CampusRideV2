import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

const client = (result: Promise<{ data: unknown; error: unknown }>) => ({ rpc: () => result });

describe("checkHealth", () => {
  it("is 200 when the database answers true", async () => {
    expect(await checkHealth(client(Promise.resolve({ data: true, error: null })))).toEqual({ status: 200, body: { ok: true } });
  });
  it("is 503 when the query errors", async () => {
    expect((await checkHealth(client(Promise.resolve({ data: null, error: { message: "down" } })))).status).toBe(503);
  });
  it("is 503 when the answer is not true", async () => {
    expect((await checkHealth(client(Promise.resolve({ data: false, error: null })))).status).toBe(503);
  });
  it("is 503 when the call throws", async () => {
    expect((await checkHealth(client(Promise.reject(new Error("network"))))).status).toBe(503);
  });
  it("is 503 when the database is too slow", async () => {
    expect((await checkHealth(client(new Promise(() => {})), 20)).status).toBe(503);
  });
  it("is 503 when no database is configured", async () => {
    expect((await checkHealth(null)).status).toBe(503);
  });
  it("says nothing but ok", async () => {
    const r = await checkHealth(client(Promise.resolve({ data: null, error: { message: "secret detail" } })));
    expect(JSON.stringify(r.body)).toBe('{"ok":false}');
  });
});
