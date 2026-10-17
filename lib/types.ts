// Hand-written row types for what the app reads. (Generated types need a running database.)
export type Profile = {
  id: string;
  campus_id: string;
  first_name: string | null;
  last_name: string | null;
  class_year: number | null;
  bio: string | null;
  avatar_path: string | null;
  role: "student" | "admin";
  onboarded_at: string | null;
  suspended_until: string | null;
};

export type Campus = { id: string; name: string };
