export default function Loading() {
  return (
    <main id="main" className="mx-auto max-w-[720px] px-4 py-8 sm:px-[25px]" role="status" aria-label="Loading chat">
      <div className="skeleton h-12 w-1/2" />
      <div className="skeleton mt-6 h-16 w-2/3" />
      <div className="skeleton ml-auto mt-4 h-12 w-1/2" />
      <div className="skeleton mt-4 h-16 w-3/5" />
    </main>
  );
}
