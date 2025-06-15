
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Chat {
  id: string;
  title: string | null;
  created_at: string;
  user_id: string;
}

type ChatsUpdater = React.Dispatch<React.SetStateAction<Chat[]>>;

/**
 * Listens for real-time changes in the chats table and updates local chat state.
 * @param userId - Only updates for chats owned by this user
 * @param setChats - A setter for updating the local chats state
 */
export function useChatsRealtime(
  userId: string | null | undefined,
  setChats: ChatsUpdater
) {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("public:chats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        (payload) => {
          // ADDED DEBUG LOGGING to diagnose realtime
          console.log("Realtime chats payload", payload);
          setChats((chats) => {
            // Ignore chats from other users for non-insert events
            if (
              payload.eventType === "INSERT" &&
              payload.new.user_id === userId
            ) {
              // Insert new chat if not already present
              if (!chats.some((c) => c.id === payload.new.id)) {
                const newChat: Chat = {
                  id: payload.new.id,
                  title: payload.new.title,
                  created_at: payload.new.created_at,
                  user_id: payload.new.user_id,
                };
                return [newChat, ...chats].sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );
              }
              return chats;
            }
            if (
              payload.eventType === "UPDATE" &&
              payload.new.user_id === userId
            ) {
              // ADDED LOG: Chat update received
              console.log("Realtime UPDATE for chat", payload.new);
              // Update chat properties locally
              return chats.map((c) =>
                c.id === payload.new.id
                  ? { ...c, ...payload.new }
                  : c
              );
            }
            if (
              payload.eventType === "DELETE" &&
              payload.old.user_id === userId
            ) {
              // Remove deleted chats locally
              return chats.filter((c) => c.id !== payload.old.id);
            }
            return chats;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, setChats]);
}
