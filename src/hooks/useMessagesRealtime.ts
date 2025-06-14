
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "./useChat";

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
                return [...messages, payload.new].sort((a,b) =>
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              }
              return messages;
            }
            if (payload.eventType === "UPDATE") {
              // Replace the message with updated one.
              return messages.map(m => (m.id === payload.new.id ? { ...m, ...payload.new } : m));
            }
            if (payload.eventType === "DELETE") {
              // Remove the message.
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

