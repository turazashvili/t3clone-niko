
import { useState, useCallback } from "react";

/**
 * Custom hook to allow manual sidebar refreshes.
 * Returns a force-refresh function and a refresh key that changes when triggered.
 */
export function useSidebarSync(userId?: string | null) {
  // Local refreshKey to force sidebar update
  const [refreshKey, setRefreshKey] = useState(Date.now());

  // Call this whenever you want to force a sidebar refresh
  const triggerSidebarRefresh = useCallback(() => {
    setRefreshKey(Date.now());
  }, []);

  return { refreshKey, triggerSidebarRefresh };
}
