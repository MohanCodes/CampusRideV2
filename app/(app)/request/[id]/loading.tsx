import { SkeletonCard } from "@/components/states";

export default function Loading() {
  return (
    <main id="main" className="mx-auto max-w-[1180px] px-4 py-8 sm:px-[25px]">
      <div role="status" aria-label="Loading request">
      <div className="skeleton h-12 w-2/3" />
      <div className="skeleton mt-4 h-6 w-1/3" />
      <div className="mt-6 max-w-[420px]"><SkeletonCard /></div>
    </div>
    </main>
  );
}
