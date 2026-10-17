import { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat/merge";

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid("We couldn't find that chat."),
  // Plain text only. Phone numbers and links are allowed in chat; the app never turns anything into a link.
  body: z.string().trim().min(1, "Write a message first.").max(MAX_MESSAGE_LENGTH, "Keep messages under 1,000 characters."),
});

export const conversationIdSchema = z.object({ conversationId: z.string().uuid("We couldn't find that chat.") });
export const afterIdSchema = z.object({
  conversationId: z.string().uuid("We couldn't find that chat."),
  afterId: z.coerce.number().int().min(0),
});
