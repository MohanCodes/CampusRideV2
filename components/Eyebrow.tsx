import type { ReactNode } from "react";

// Small uppercase label with a Forest dot. Marketing pages and tiny section labels only.
export function Eyebrow({
  children,
  center = false,
}: {
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`t-label flex items-center gap-[10px] ${center ? "justify-center" : ""}`}>
      <span aria-hidden="true" className="size-[7px] rounded-full bg-green" />
      {children}
    </div>
  );
}
