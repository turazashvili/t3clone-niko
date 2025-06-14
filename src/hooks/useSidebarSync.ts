
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
  // Use a ref to keep track of the *exact* channel instance for cleanup
  const channelRef = useRef<any>(null);

  // Call this whenever you want to force a sidebar refresh
  const triggerSidebarRefresh = useCallback(() => {
    setRefreshKey(Date.now());
  }, []);

  // Setup realtime subscription to chats table, filtered by userId
  useEffect(() => {
    // Always clean up previous channel instance if any before subscribing a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!userId) return;

    // Create a truly new channel instance
    const channel = supabase
      .channel(`public:chats:sidebar:${userId}:${Date.now()}`) // Unique name per userId/time
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats", filter: `user_id=eq.${userId}` },
        () => {
          triggerSidebarRefresh();
        }
      );

    // Only call .subscribe() ONCE for the channel instance
    channel.subscribe();

    channelRef.current = channel;

    return () => {
      // Always cleanup the current channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, triggerSidebarRefresh]);

  return { refreshKey, triggerSidebarRefresh };
}

