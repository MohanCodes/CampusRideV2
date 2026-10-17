import { SkeletonCard } from "@/components/states";

export default function Loading() {
  return (
    <main id="main" className="mx-auto max-w-[1180px] px-4 py-8 sm:px-[25px]">
      <div role="status" aria-label="Loading trip">
      <div className="skeleton h-12 w-2/3" />
      <div className="skeleton mt-6 h-[140px] w-full" />
      <div className="mt-6 max-w-[360px]">
        <SkeletonCard />
      </div>
    </div>
    </main>
  );
}
