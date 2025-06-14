
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
          // Debug: Log realtime payload and setMessages
          console.log("[useMessagesRealtime] Got event:", payload);
          setMessages((messages) => {
            // Debug: current state and payload
            console.log("[useMessagesRealtime] setMessages, before:", messages);
            if (payload.eventType === "INSERT") {
              if (!messages.some(m => m.id === payload.new.id)) {
                const out = [
                  ...messages,
                  payload.new as Message,
                ].sort(
                  (a, b) =>
                    new Date(a.created_at || "").getTime() -
                    new Date(b.created_at || "").getTime()
                );
                console.log("[useMessagesRealtime] setMessages, after INSERT:", out);
                return out;
              }
              return messages;
            }
            if (payload.eventType === "UPDATE") {
              const out = messages.map(m =>
                m.id === payload.new.id
                  ? { ...m, ...(payload.new as Message) }
                  : m
              );
              console.log("[useMessagesRealtime] setMessages, after UPDATE:", out);
              return out;
            }
            if (payload.eventType === "DELETE") {
              const out = messages.filter(m => m.id !== payload.old.id);
              console.log("[useMessagesRealtime] setMessages, after DELETE:", out);
              return out;
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

