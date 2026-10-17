"use server";

import { redirect } from "next/navigation";
import { AVATAR_INPUT_TYPES, AvatarError, avatarPathFor, resizeAvatar } from "@/lib/avatar";
import { getMyProfile, getUser } from "@/lib/auth/dal";
import { errorMessage } from "@/lib/errors";
import { safeNext } from "@/lib/routes";
import { onboardingSchema } from "@/lib/schemas/onboarding";
import { createClient } from "@/lib/supabase/server";

type FieldName = "firstName" | "lastName" | "classYear" | "bio" | "photo";

export type ProfileStepState =
  | { status: "idle" }
  | { status: "error"; message?: string; fields?: Partial<Record<FieldName, string>> }
  | {
      status: "ok";
      values: { firstName: string; lastName: string; classYear: number; bio: string; avatarPath: string };
    };

export type FinishState = { status: "idle" } | { status: "error"; message: string };

// Step 1 of 2: check the form, resize and store the photo, and hand back what to confirm.
// Nothing is saved to the profile until the pledge step.
export async function saveProfileStep(_prev: ProfileStepState, formData: FormData): Promise<ProfileStepState> {
  const user = await getUser();
  const supabase = await createClient();
  if (!user || !supabase) return { status: "error", message: errorMessage("not_signed_in") };

  const file = formData.get("photo");
  const hasNewPhoto = file instanceof File && file.size > 0;
  const existing = (await getMyProfile())?.avatar_path ?? null;

  const parsed = onboardingSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    classYear: formData.get("classYear"),
    bio: formData.get("bio") ?? "",
    avatarPath: hasNewPhoto ? avatarPathFor(user.id) : (existing ?? ""),
  });
  if (!parsed.success) {
    const fields: Partial<Record<FieldName, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "avatarPath" ? "photo" : (issue.path[0] as FieldName);
      fields[key] ??= issue.message;
    }
    return { status: "error", fields };
  }

  if (hasNewPhoto) {
    if (!AVATAR_INPUT_TYPES.includes(file.type)) {
      return { status: "error", fields: { photo: "Pick a JPG, PNG, or WebP photo." } };
    }
    try {
      const body = await resizeAvatar(Buffer.from(await file.arrayBuffer()));
      const { error } = await supabase.storage
        .from("avatars")
        .upload(parsed.data.avatarPath, body, { contentType: "image/webp", upsert: true });
      if (error) return { status: "error", fields: { photo: "We couldn't save your photo. Try again." } };
    } catch (e) {
      if (e instanceof AvatarError) return { status: "error", fields: { photo: e.message } };
      throw e;
    }
  }

  return { status: "ok", values: parsed.data };
}

// Step 2 of 2: "I agree". The database function re-checks everything, including that the photo exists.
export async function finishOnboarding(_prev: FinishState, formData: FormData): Promise<FinishState> {
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: errorMessage("not_signed_in") };

  const parsed = onboardingSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    classYear: formData.get("classYear"),
    bio: formData.get("bio") ?? "",
    avatarPath: formData.get("avatarPath"),
  });
  if (!parsed.success) return { status: "error", message: errorMessage("invalid_profile") };

  const { error } = await supabase.rpc("complete_onboarding", {
    p_first: parsed.data.firstName,
    p_last: parsed.data.lastName,
    p_class_year: parsed.data.classYear,
    p_bio: parsed.data.bio,
    p_avatar_path: parsed.data.avatarPath,
  });
  if (error) return { status: "error", message: errorMessage(error) };

  redirect(safeNext(formData.get("next") as string | null));
}
