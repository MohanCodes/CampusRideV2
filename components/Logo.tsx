import Link from "next/link";

// Ink circle with a Mint arrow, then the one-word wordmark.
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-[10px] text-[1.5rem] font-bold tracking-[-0.04em] max-[650px]:text-[1.4375rem]"
    >
      <span
        aria-hidden="true"
        className="grid size-[35px] place-items-center rounded-full bg-ink text-[1.4rem] font-normal tracking-normal text-mint"
      >
        ↗
      </span>
      CampusRide
    </Link>
  );
}
