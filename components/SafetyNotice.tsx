import Link from "next/link";
import { FEATURES } from "@/lib/features";

// WEB_FLOWS.md Section 6.3. The sentence is exact; do not reword it.
export function SafetyNotice() {
  return (
    <p className="t-small text-muted">
      {"Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency."}
      {FEATURES.safetyPage && (
        <>
          {" "}
          <Link href="/safety" className="link">
            Safety tips
          </Link>
        </>
      )}
    </p>
  );
}
