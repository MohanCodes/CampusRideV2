import Link from "next/link";
import type { ReactNode } from "react";

// Empty, error, and loading pieces shared by every list screen.

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div data-testid="empty-state" className="card px-6 py-10 text-center">
      <svg aria-hidden="true" viewBox="0 0 160 72" className="mx-auto mb-5 h-[72px] w-[160px]">
        <circle cx="80" cy="36" r="34" className="fill-none stroke-line" />
        <circle cx="80" cy="36" r="22" className="fill-none stroke-line" strokeDasharray="3 4" />
        <path d="M40 54V36h52V18" className="fill-none stroke-green" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5" />
        <circle cx="40" cy="54" r="5" className="fill-ink" />
        <circle cx="92" cy="18" r="5" className="fill-ink" />
      </svg>
      <h2 className="t-h2">{title}</h2>
      {body && <p className="mx-auto mt-2 max-w-[44ch] text-muted">{body}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}

// `href` reloads the same page; error boundaries pass `onRetry` instead.
export function ErrorState({ message = "We couldn't load this right now.", href, onRetry }: { message?: string; href?: string; onRetry?: () => void }) {
  return (
    <div data-testid="error-state" role="alert" className="card px-6 py-10 text-center">
      <h2 className="t-h2">Something went wrong</h2>
      <p className="mx-auto mt-2 max-w-[44ch] text-muted">{message}</p>
      <div className="mt-6">
        {onRetry ? (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Try again
          </button>
        ) : (
          <Link href={href ?? "/"} className="btn-secondary">
            Try again
          </Link>
        )}
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div aria-hidden="true" className="card p-4">
      <div className="skeleton h-6 w-3/4" />
      <div className="skeleton mt-3 h-5 w-1/3" />
      <div className="skeleton mt-4 h-4 w-1/2" />
      <div className="skeleton mt-2 h-4 w-1/3" />
      <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
        <div className="skeleton size-9 rounded-full" />
        <div className="skeleton h-4 w-1/3" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading trips" className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
