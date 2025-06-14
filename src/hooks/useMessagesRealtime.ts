import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/chat";

/**
 * Listens for Realtime changes to messages in a chat and updates state.
 * - Keeps messages in sync with DB changes instantly.
 */
export function useMessagesRealtime(
  chatId: string | null,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) {
  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((messages) => {
            if (payload.eventType === "INSERT") {
              // If the message doesn't exist, add to messages.
              if (!messages.some(m => m.id === payload.new.id)) {
                return [
                  ...messages,
                  payload.new as Message, // safely cast
                ].sort(
                  (a, b) =>
                    new Date(a.created_at || "").getTime() -
                    new Date(b.created_at || "").getTime()
                );
              }
              return messages;
            }
            if (payload.eventType === "UPDATE") {
              // Replace the message with updated one.
              return messages.map(m =>
                m.id === payload.new.id
                  ? { ...m, ...(payload.new as Message) }
                  : m
              );
            }
            if (payload.eventType === "DELETE") {
              // Instead of blindly filtering by ID, remove all local messages that do not exist in the DB after deletes.
              // But since we don't have full state, fallback to by ID as before.
              return messages.filter(m => m.id !== payload.old.id);
            }
            return messages;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, setMessages]);
}
