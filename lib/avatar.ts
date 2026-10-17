import "server-only";
import sharp from "sharp";
import { AVATAR_MAX_INPUT_BYTES } from "@/lib/schemas/onboarding";

export const AVATAR_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_EDGE = 512;

export class AvatarError extends Error {}

// BUILD.md 5.9: resize to 512 px on the long edge and strip metadata (location, camera, and so on).
// sharp drops metadata unless asked to keep it; rotate() first applies the photo's orientation so
// it still stands upright once that information is gone.
export async function resizeAvatar(input: Buffer): Promise<Buffer> {
  if (input.byteLength > AVATAR_MAX_INPUT_BYTES) throw new AvatarError("That photo is too large. Pick one under 8 MB.");
  try {
    return await sharp(input, { failOn: "error" })
      .rotate()
      .resize(AVATAR_MAX_EDGE, AVATAR_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AvatarError("We couldn't use that file. Pick a JPG, PNG, or WebP photo.");
  }
}

export const avatarPathFor = (userId: string) => `${userId}/profile.webp`;
