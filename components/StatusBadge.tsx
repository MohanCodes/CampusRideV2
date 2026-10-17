import { Icon } from "@/components/icons";

export type Status = "open" | "full" | "pending" | "accepted" | "declined" | "expired" | "past" | "cancelled";

const LABEL: Record<Status, string> = {
  open: "Open", full: "Full", pending: "Pending", accepted: "Accepted",
  declined: "Declined", expired: "Expired", past: "Past", cancelled: "Cancelled",
};

// Success uses Forest with a check and a word; Danger is only for declines. Color never works alone.
const STYLE: Record<Status, string> = {
  open: "border-line text-ink",
  full: "border-line text-muted",
  pending: "border-line bg-pale text-ink",
  accepted: "border-green bg-mint text-green",
  declined: "border-danger text-danger",
  expired: "border-line text-muted",
  past: "border-line text-muted",
  cancelled: "border-line text-muted",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-[10px] py-[2px] text-xs font-bold ${STYLE[status]}`}>
      {status === "accepted" && <Icon name="check" size={14} />}
      {status === "pending" && <Icon name="clock" size={14} />}
      {LABEL[status]}
    </span>
  );
}
