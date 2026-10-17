import Link from "next/link";

// Safety, Terms and Privacy: linked from every footer and the sign-in screen.
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 text-sm ${className}`} aria-label="About CampusRide">
      <li><Link href="/safety" className="inline-flex min-h-[44px] items-center link">Safety</Link></li>
      <li><Link href="/terms" className="inline-flex min-h-[44px] items-center link">Terms</Link></li>
      <li><Link href="/privacy" className="inline-flex min-h-[44px] items-center link">Privacy</Link></li>
    </ul>
  );
}
