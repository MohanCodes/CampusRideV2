export default function Loading() {
  return (
    <main id="main" className="mx-auto max-w-[1180px] px-4 py-8 sm:px-[25px]">
      <div className="skeleton h-12 w-1/3" />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
    </main>
  );
}
