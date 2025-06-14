
import { LogIn, Plus, Search, MessageSquare, Loader2, LogOut, RefreshCcw } from "lucide-react";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useSidebarSync } from "@/hooks/useSidebarSync";

interface Chat {
  id: string;
  title: string | null;
  created_at: string;
}

interface SidebarProps {
  onLoginClick?: () => void;
  onNewChatClick?: () => void;
  onLoadChat?: (chatId: string) => void;
  userId?: string | null;
  onSignOutClick?: () => void;
  triggerRefresh?: any; // Add this prop
}

const SIDEBAR_WIDTH = 290;

const Sidebar: React.FC<SidebarProps> = ({
  onLoginClick,
  onNewChatClick,
  onLoadChat,
  userId,
  onSignOutClick,
  triggerRefresh,
}) => {
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const navigate = useNavigate();
  // === Use custom sidebar sync hook ===
  const { refreshKey: sidebarRefreshKey } = useSidebarSync(userId);

  // Fetch chats on refreshKey change (sync engine OR manual)
  useEffect(() => {
    async function fetchRecentChats() {
      if (!userId) {
        setRecentChats([]);
        return;
      }
      setLoadingChats(true);
      const { data, error } = await supabase
        .from('chats')
        .select('id, title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        toast({ title: "Error fetching chats", description: error.message, variant: "destructive" });
        setRecentChats([]);
      } else {
        setRecentChats((data ?? []) as Chat[]);
      }
      setLoadingChats(false);
    }
    fetchRecentChats();
  }, [userId, sidebarRefreshKey, triggerRefresh]);

  return (
    <aside
      className={`fixed left-0 top-0 z-30 h-screen w-[${SIDEBAR_WIDTH}px] bg-gradient-to-b from-[#201022] via-[#19101c] to-[#19101c] border-r border-[#251c2f]/70 px-4 py-5 flex flex-col`}
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="flex items-center gap-2 mb-6 select-none">
        <span className="font-bold tracking-wide text-xl text-white">
          T3
          <span className="text-accent font-bold">.chat</span>
        </span>
        {/* Manual refresh button */}
        <button
          className="ml-auto p-1 rounded hover:bg-[#251933] transition"
          title="Refresh list"
          aria-label="Refresh sidebar"
          onClick={() => triggerRefresh && triggerRefresh()}
          type="button"
        >
          <RefreshCcw size={20} className="text-white/60" />
        </button>
      </div>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-accent font-semibold text-white shadow-sm hover:bg-accent-dark transition mb-2 text-base focus:outline-none"
        onClick={onNewChatClick}
        disabled={!userId}
      >
        <Plus size={20} />
        New Chat
      </button>
      <div className="relative mb-3">
        <input
          className="w-full rounded-lg bg-[#23142e] text-base text-white/90 placeholder:text-white/30 px-9 py-2 focus:outline-none"
          placeholder="Search your threads..."
          type="text"
          disabled
        />
        <Search
          size={18}
          className="absolute left-2.5 top-2.5 text-white/40 pointer-events-none"
        />
      </div>
      {/* Scrollable chat list */}
      <div className="flex-1 overflow-y-auto mt-2 pr-1 custom-scrollbar">
        {loadingChats && (
          <div className="flex justify-center items-center h-full">
            <Loader2 size={24} className="animate-spin text-white/50" />
          </div>
        )}
        {!loadingChats && recentChats.length === 0 && userId && (
          <p className="text-center text-sm text-white/50 py-4">No recent chats.</p>
        )}
        {!loadingChats &&
          recentChats.map((chat) => (
            <div
              key={chat.id}
              className="py-2 px-3 rounded-md text-white/80 hover:bg-[#251933] hover:text-white font-medium cursor-pointer transition mb-1 flex items-center gap-2"
              onClick={() => {
                // Navigate to /chat/:chatId AND optionally call onLoadChat
                navigate(`/chat/${chat.id}`);
                onLoadChat?.(chat.id);
              }}
            >
              <MessageSquare size={16} className="text-white/60 shrink-0" />
              <span className="truncate flex-1">
                {chat.title || `Chat from ${new Date(chat.created_at).toLocaleDateString()}`}
              </span>
            </div>
          ))}
      </div>
      <div className="mt-auto pt-4 border-t border-[#251c2f]/70">
        {userId ? (
          <button
            className="flex items-center gap-2 text-white/80 hover:text-accent transition font-semibold px-1 py-2 w-full justify-start"
            type="button"
            onClick={onSignOutClick}
          >
            <LogOut size={20} />
            Sign Out
          </button>
        ) : (
          <button
            className="flex items-center gap-2 text-white/80 hover:text-accent transition font-semibold px-1 py-2 w-full justify-start"
            type="button"
            onClick={onLoginClick}
          >
            <LogIn size={20} />
            Login to Chat
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

