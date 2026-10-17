import type { ChatMessage } from "@/lib/data/types";

// Messages can arrive twice (once from the send, once from the live feed, once from a refresh), and
// out of order. Merging by id keeps one copy of each, oldest first.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export const lastId = (messages: ChatMessage[]): number => messages.reduce((max, m) => Math.max(max, m.id), 0);

// "On my way", "Running 5 min late", "I'm here": one tap instead of typing (WEB_FLOWS.md 4.9).
export const QUICK_REPLIES = ["On my way", "Running 5 min late", "I'm here"] as const;

export const MAX_MESSAGE_LENGTH = 1000;
