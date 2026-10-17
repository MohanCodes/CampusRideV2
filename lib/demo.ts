import { getSupabaseEnv } from "@/lib/env";

// Demo mode serves clearly labeled sample data so screens can be judged without a backend.
// It needs CAMPUS_RIDE_DEMO=1 and only applies when no Supabase settings exist, so it can never
// mask real data in staging or production. CAMPUS_RIDE_DEMO_NOW pins the clock for tests.
export function isDemo(): boolean {
  return process.env.CAMPUS_RIDE_DEMO === "1" && !getSupabaseEnv();
}

export function getNow(): Date {
  const pinned = isDemo() ? process.env.CAMPUS_RIDE_DEMO_NOW : undefined;
  const d = pinned ? new Date(pinned) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// In demo mode, ?fail=1 makes the board show its error state so that screen can be reviewed and tested.
export function demoForcesError(param: string | string[] | undefined): boolean {
  return isDemo() && (Array.isArray(param) ? param[0] : param) === "1";
}
