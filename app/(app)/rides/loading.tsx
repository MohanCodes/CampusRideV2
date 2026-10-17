import { SkeletonGrid } from "@/components/states";

export default function Loading() {
  return (
    <main id="main" className="mx-auto max-w-[1180px] px-4 py-8 sm:px-[25px]">
      <div className="skeleton h-12 w-1/2" />
      <div className="skeleton mt-6 h-10 w-2/3" />
      <div className="mt-6">
        <SkeletonGrid count={4} />
      </div>
    </main>
  );
}
