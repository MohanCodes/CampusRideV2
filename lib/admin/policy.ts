// The no-show policy from WEB_FLOWS.md 6.4: a warning on the second report, a short suspension on the third.
// This only suggests; an admin presses the button (BUILD.md Section 10). Nothing happens automatically.
export function noShowSuggestion(noShowCount: number): string | null {
  if (noShowCount >= 3) return "Third no-show or more: suspend for 7 days.";
  if (noShowCount === 2) return "Second no-show: send a warning.";
  return null;
}
