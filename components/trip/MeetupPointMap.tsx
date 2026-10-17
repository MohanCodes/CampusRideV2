// A small picture of where the meetup point is. The interactive Mapbox map arrives in Step 5
// with the meetup point picker; until then this flat illustration stands in, with the name beside it.
export function MeetupPointMap({ name }: { name: string }) {
  return (
    <div role="img" aria-label={`Map placeholder for the meetup point, ${name}`} className="overflow-hidden rounded-xl border border-line bg-pale">
      <svg viewBox="0 0 320 140" className="block h-[140px] w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M0 35H320M0 75H320M0 115H320M60 0V140M140 0V140M220 0V140M290 0V140" className="stroke-surface" strokeWidth="12" fill="none" />
        <path d="M60 115V75H220V35" className="stroke-green" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 6" fill="none" />
        <circle cx="60" cy="115" r="8" className="fill-surface stroke-ink" strokeWidth="3" />
        <circle cx="220" cy="35" r="9" className="fill-ink stroke-surface" strokeWidth="3" />
      </svg>
    </div>
  );
}
