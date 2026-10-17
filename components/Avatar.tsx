import { initials } from "@/lib/format/trip";

// A real photo when there is one, otherwise the first initial on Mint. The name sits next to it,
// so the picture itself is decorative.
export function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-mint font-bold"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} loading="lazy" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
