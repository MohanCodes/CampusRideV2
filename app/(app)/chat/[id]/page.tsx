import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ChatThread } from "@/components/chat/ChatThread";
import { Icon } from "@/components/icons";
import { ErrorState } from "@/components/states";
import { UserRow } from "@/components/UserRow";
import { getUser, requireOnboarded } from "@/lib/auth/dal";
import { getConversation } from "@/lib/data/chat";
import { DEMO_ME } from "@/lib/data/mock";
import { demoForcesError, getNow, isDemo } from "@/lib/demo";
import { getSupabaseEnv } from "@/lib/env";
import { formatDeparture } from "@/lib/format/time";

export const metadata = { title: "Chat — CampusRide" };

const CLOSED_TEXT = {
  time: "This chat is closed. Chats close 24 hours after the trip leaves.",
  trip_cancelled: "This trip was cancelled, so the chat is closed.",
  seat_cancelled: "This seat was cancelled, so the chat is closed.",
} as const;

export default async function ChatPage({ params, searchParams }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const demo = isDemo();
  if (!demo) await requireOnboarded(`/chat/${id}`);
  const user = await getUser();
  const res = demoForcesError(sp.fail) ? { ok: false as const } : await getConversation(id);
  const now = getNow();

  if (!res.ok) {
    return (
      <AppShell signedIn={Boolean(user)} demo={demo} hideBottomNav>
        <div className="mt-8"><ErrorState message="We couldn't load this chat. Check your connection and try again." href={`/chat/${id}`} /></div>
      </AppShell>
    );
  }
  if (!res.data) notFound();
  const c = res.data;

  return (
    <AppShell signedIn={Boolean(user)} demo={demo} hideBottomNav>
      <Link href="/inbox" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm">
        <Icon name="back" size={16} />
        Inbox
      </Link>
      <div className="mx-auto max-w-[720px]">
        <header className="mb-4 border-b border-line pb-4">
          <UserRow person={c.other} size={48} />
          <p className="mt-3 text-sm text-muted">
            <Link href={`/trip/${c.tripId}`} className="link">{c.tripName}</Link>
            {" · "}
            <span className="tabular">{formatDeparture(c.departsAt, now)}</span>
          </p>
        </header>
        <ChatThread
          conversationId={c.id}
          initial={c.messages}
          meId={user?.id ?? DEMO_ME}
          nowIso={now.toISOString()}
          live={!demo && getSupabaseEnv() !== null}
          demo={demo}
          open={c.open}
          closedText={c.closedReason ? CLOSED_TEXT[c.closedReason] : null}
        />
      </div>
    </AppShell>
  );
}
