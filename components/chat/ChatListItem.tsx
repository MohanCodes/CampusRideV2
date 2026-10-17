import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { ChatThread } from "@/lib/data/types";
import { formatDeparture } from "@/lib/format/time";

// One chat in the Inbox: who, which trip, the latest message, and how many are unread.
export function ChatListItem({ thread, now }: { thread: ChatThread; now: Date }) {
  const closed = new Date(thread.closesAt) <= now;
  const preview = thread.lastBody
    ? thread.lastKind === "system" ? thread.lastBody : `${thread.lastFromMe ? "You: " : ""}${thread.lastBody}`
    : "No messages yet";
  return (
    <li data-testid="chat-row" className="card relative p-4 transition-colors hover:border-green">
      <div className="flex items-start gap-3">
        <Avatar name={thread.other.firstName} url={thread.other.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center justify-between gap-3">
            <Link href={`/chat/${thread.id}`} className="stretched truncate font-bold">
              {thread.other.firstName}
            </Link>
            {thread.unread > 0 && (
              <span data-testid="unread" className="tabular inline-grid min-w-[22px] place-items-center rounded-full bg-ink px-[6px] text-xs font-bold leading-[22px] text-on-ink">
                <span aria-hidden="true">{thread.unread}</span>
                <span className="sr-only">{thread.unread} unread</span>
              </span>
            )}
          </p>
          <p className="truncate text-sm text-muted">
            {thread.tripName} · <span className="tabular">{formatDeparture(thread.departsAt, now)}</span>
            {closed && " · Closed"}
          </p>
          <p className={`mt-1 truncate ${thread.lastKind === "system" ? "text-sm italic text-muted" : ""} ${thread.unread > 0 ? "font-bold" : ""}`}>{preview}</p>
        </div>
      </div>
    </li>
  );
}
