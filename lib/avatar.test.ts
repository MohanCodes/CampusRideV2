import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { AvatarError, resizeAvatar, avatarPathFor } = await import("./avatar");

async function photo(w: number, h: number, opts: { orientation?: number } = {}) {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: "#808080" } }).withExif({
    IFD0: { Copyright: "secret", Make: "SecretCam" },
  });
  if (opts.orientation) img = img.withMetadata({ orientation: opts.orientation });
  return img.jpeg().toBuffer();
}

describe("resizeAvatar", () => {
  it("shrinks a large photo to 512 px on the long edge and outputs WebP", async () => {
    const out = await resizeAvatar(await photo(2000, 1000));
    const m = await sharp(out).metadata();
    expect(m.format).toBe("webp");
    expect(Math.max(m.width!, m.height!)).toBe(512);
    expect(m.width! / m.height!).toBeCloseTo(2, 1);
  });

  it("does not enlarge a small photo", async () => {
    const m = await sharp(await resizeAvatar(await photo(200, 100))).metadata();
    expect([m.width, m.height]).toEqual([200, 100]);
  });

  it("strips camera and copyright metadata", async () => {
    const out = await resizeAvatar(await photo(800, 800));
    const m = await sharp(out).metadata();
    expect(m.exif).toBeUndefined();
    expect(out.includes(Buffer.from("SecretCam"))).toBe(false);
    expect(out.includes(Buffer.from("secret"))).toBe(false);
  });

  it("keeps the photo upright by applying its orientation before stripping it", async () => {
    // Orientation 6 means "rotate 90 degrees": a 400 x 200 file is really 200 wide and 400 tall.
    const m = await sharp(await resizeAvatar(await photo(400, 200, { orientation: 6 }))).metadata();
    expect([m.width, m.height]).toEqual([200, 400]);
  });

  it("refuses something that is not an image", async () => {
    await expect(resizeAvatar(Buffer.from("hello, not a photo"))).rejects.toBeInstanceOf(AvatarError);
  });

  it("refuses a file over 8 MB", async () => {
    await expect(resizeAvatar(Buffer.alloc(8 * 1024 * 1024 + 1))).rejects.toThrow(/too large/);
  });

  it("puts the photo in the person's own folder", () => {
    expect(avatarPathFor("abc")).toBe("abc/profile.webp");
  });
});
