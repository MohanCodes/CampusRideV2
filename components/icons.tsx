import type { ReactNode } from "react";

// One outlined icon set at one weight. Icons never carry meaning alone: each sits next to a word.
const PATHS: Record<string, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  pin: (<><path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.2" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>),
  sliders: (<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>),
  copy: (<><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></>),
  back: <path d="M15 5l-7 7 7 7" />,
  arrow: <path d="M7 17L17 7M9 7h8v8" />,
  car: (<><path d="M4 15v-3l1.7-4.2A2 2 0 0 1 7.6 6.5h8.8a2 2 0 0 1 1.9 1.3L20 12v3" /><path d="M3.5 15h17v2.5h-17z" /><circle cx="7.5" cy="17.5" r="0.4" /><circle cx="16.5" cy="17.5" r="0.4" /></>),
  home: <path d="M4 11l8-6.5 8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  inbox: (<><path d="M4 13l2.2-7a1 1 0 0 1 1-.7h9.6a1 1 0 0 1 1 .7L20 13" /><path d="M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5h-4.5a2.5 2.5 0 0 1-5 0z" /></>),
  user: (<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  users: (<><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6.3a3 3 0 0 1 0 5.4M17.5 14a5.5 5.5 0 0 1 3 5" /></>),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
