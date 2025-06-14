
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Custom hook to sync and locally refresh sidebar when a user's chats change.
 * - Executes refresh immediately when instructed (e.g. after first message DB sync)
 * - Uses Supabase Realtime for live updates (chat add/delete/change)
 * - Returns a trigger function and a refresh key
 */
export function useSidebarSync(userId?: string | null) {
  // Local refreshKey to force sidebar update
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const channelRef = useRef<any>(null);

  // Call this whenever you want to force a sidebar refresh
  const triggerSidebarRefresh = useCallback(() => {
    setRefreshKey(Date.now());
  }, []);

  // Setup realtime subscription to chats table, filtered by userId
  useEffect(() => {
    // Cleanup previous channel if userId changes
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!userId) return;

    const channel = supabase
      .channel("public:chats:sidebar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats", filter: `user_id=eq.${userId}` },
        () => {
          triggerSidebarRefresh();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [userId, triggerSidebarRefresh]);

  return { refreshKey, triggerSidebarRefresh };
}
