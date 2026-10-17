import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Not found — CampusRide" };

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-[560px] px-4 py-6 sm:px-[25px]">
      <header className="flex h-[78px] items-center">
        <Logo />
      </header>
      <div className="card mt-6 p-8 text-center">
        <h1 className="t-h1 text-[2.4rem]">We can&apos;t find that page</h1>
        <p className="mt-3 text-muted">The link may be old, or the trip may have been removed.</p>
        <Link href="/" className="btn-secondary mt-6">
          Back to the board
        </Link>
      </div>
    </main>
  );
}
