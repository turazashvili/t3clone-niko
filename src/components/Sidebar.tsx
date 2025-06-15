import { Menu, Plus, Search, MessageSquare, Loader2, LogOut, LogIn } from "lucide-react";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useSidebarSync } from "@/hooks/useSidebarSync";
import DeleteChatButton from "./DeleteChatButton";
import { useChatsRealtime } from "@/hooks/useChatsRealtime";

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
  triggerRefresh?: any;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

// Key for localStorage
const SIDEBAR_COLLAPSED_KEY = "t3chat_sidebar_collapsed";

const SIDEBAR_WIDTH = 290;

const Sidebar: React.FC<SidebarProps> = ({
  onLoginClick,
  onNewChatClick,
  onLoadChat,
  userId,
  onSignOutClick,
  triggerRefresh,
  collapsed,
  setCollapsed,
}) => {
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  const navigate = useNavigate();
  const { refreshKey: sidebarRefreshKey } = useSidebarSync(userId);

  // Helper to detect mobile size
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 768);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  // Update localStorage every time collapsed state changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
    }
  }, [collapsed]);

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

  // Use new realtime hook for chat updates!
  useChatsRealtime(userId, setRecentChats);

  // For mobile sidebar overlay, clicking a chat will close sidebar
  const handleChatClick = (chatId: string) => {
    navigate(`/chat/${chatId}`);
    onLoadChat?.(chatId);
    if (isMobile) {
      setCollapsed(true);
    }
  };

  // Collapsed sidebar (mobile "open" state = overlay)
  if (collapsed) {
    return (
      <div
        className="fixed left-0 top-3 sm:top-5 z-40 flex gap-2 sm:gap-2"
        style={{ width: "auto" }}
      >
        <button
          aria-label="Expand sidebar"
          className="w-10 h-10 flex items-center justify-center rounded-md bg-[#2d1a3d] hover:bg-[#23142e] transition shadow"
          onClick={() => setCollapsed(false)}
        >
          <Menu size={22} color="#dec9f7" />
        </button>
        <button
          aria-label="New chat"
          className="w-10 h-10 flex items-center justify-center rounded-md bg-[#2d1a3d] hover:bg-[#23142e] transition shadow"
          onClick={() => {
            onNewChatClick?.();
            // remain collapsed but nav to /
            navigate("/");
          }}
          disabled={!userId}
        >
          <Plus size={22} color="#dec9f7" />
        </button>
      </div>
    );
  }

  // Mobile sidebar is open (viewport < 768px and !collapsed)
  if (isMobile && !collapsed) {
    // -- FULL SCREEN OVERLAY --
    return (
      <div
        className="
          fixed z-50 inset-0 bg-gradient-to-b from-[#201022] via-[#19101c] to-[#19101c]
          border-r border-[#251c2f]/70
          px-2 py-4 sm:px-4 sm:py-5 flex flex-col
          w-full h-full
          transition-all
        "
        style={{ maxWidth: "100vw", width: "100vw", height: "100vh" }}
      >
        <div className="flex items-center gap-2 mb-6 select-none">
          <button
            aria-label="Collapse sidebar"
            className="mr-2 w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#23142e] transition"
            onClick={() => setCollapsed(true)}
          >
            <Menu size={20} color="#dec9f7" />
          </button>
          <span className="font-bold tracking-wide text-xl text-white">
            T3
            <span className="text-accent font-bold">.chat</span>
          </span>
        </div>
        <button
          className="w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-accent font-semibold text-white shadow-sm hover:bg-accent-dark transition mb-2 text-base focus:outline-none"
          onClick={() => {
            onNewChatClick?.();
            navigate("/");
            if (isMobile) setCollapsed(true);
          }}
          disabled={!userId}
        >
          <Plus size={20} />
          <span className="hidden xs:inline">New Chat</span>
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
        <div className="flex-1 overflow-y-auto mt-2 pr-1 custom-scrollbar min-h-0 pb-20"> {/* add pb for footer */}
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
                className="py-2 px-2 sm:px-3 rounded-md text-white/80 hover:bg-[#251933] hover:text-white font-medium cursor-pointer transition mb-1 flex items-center gap-2"
                onClick={() => handleChatClick(chat.id)}
              >
                <MessageSquare size={16} className="text-white/60 shrink-0" />
                <span className="truncate flex-1 text-sm">
                  {chat.title || `Chat from ${new Date(chat.created_at).toLocaleDateString()}`}
                </span>
              </div>
            ))}
        </div>
        {/* Footer always at the bottom, overlayed atop scroll area */}
        <div
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#19101c] via-[#19101c]/80 to-transparent p-4 pt-8"
          style={{
            boxShadow: "0 -2px 16px 0 #19101c66",
            pointerEvents: 'auto'
          }}
        >
          {userId ? (
            <button
              className="flex items-center gap-2 text-white/80 hover:text-accent transition font-semibold px-1 py-2 w-full justify-start text-sm"
              type="button"
              onClick={onSignOutClick}
            >
              <LogOut size={20} />
              <span className="hidden xs:inline">Sign Out</span>
            </button>
          ) : (
            <button
              className="flex items-center gap-2 text-white/80 hover:text-accent transition font-semibold px-1 py-2 w-full justify-start text-sm"
              type="button"
              onClick={onLoginClick}
            >
              <LogIn size={20} />
              <span className="hidden xs:inline">Login to Chat</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // -- Desktop expanded sidebar (unchanged) --
  return (
    <aside
      className={`
        fixed left-0 top-0 z-30 h-screen bg-gradient-to-b from-[#201022] via-[#19101c] to-[#19101c]
        border-r border-[#251c2f]/70
        px-2 py-4 sm:px-4 sm:py-5 flex flex-col
        w-[80vw] max-w-[310px] sm:w-[${SIDEBAR_WIDTH}px]
        transition-all
      `}
      style={{
        width: 'clamp(220px, 80vw, 320px)',
        maxWidth: '320px'
      }}
    >
      <div className="flex items-center gap-2 mb-6 select-none">
        <button
          aria-label="Collapse sidebar"
          className="mr-2 w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#23142e] transition"
          onClick={() => setCollapsed(true)}
        >
          <Menu size={20} color="#dec9f7" />
        </button>
        <span className="font-bold tracking-wide text-xl text-white">
          T3
          <span className="text-accent font-bold">.chat</span>
        </span>
      </div>
      <button
        className="w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-accent font-semibold text-white shadow-sm hover:bg-accent-dark transition mb-2 text-base focus:outline-none"
        onClick={() => {
          onNewChatClick?.();
          navigate("/");
        }}
        disabled={!userId}
      >
        <Plus size={20} />
        <span className="hidden xs:inline">New Chat</span>
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
      <div className="flex-1 overflow-y-auto mt-2 pr-1 custom-scrollbar min-h-0">
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
              className="group/sidebar-chat relative py-2 px-2 sm:px-3 rounded-md text-white/80 hover:bg-[#251933] hover:text-white font-medium cursor-pointer transition mb-1 flex items-center gap-2"
              onClick={() => {
                navigate(`/chat/${chat.id}`);
                onLoadChat?.(chat.id);
              }}
            >
              <MessageSquare size={16} className="text-white/60 shrink-0" />
              <span className="truncate flex-1 text-sm">
                {chat.title || `Chat from ${new Date(chat.created_at).toLocaleDateString()}`}
              </span>
              <div className="ml-2 flex-shrink-0">
                <DeleteChatButton chatId={chat.id} onDeleted={() => {
                  // Refresh chats after deletion
                  setRecentChats(cs => cs.filter(c => c.id !== chat.id));
                  if (typeof window !== "undefined" && window.location.pathname === `/chat/${chat.id}`) {
                    navigate("/");
                  }
                }} />
              </div>
            </div>
          ))}
      </div>
      <div className="mt-auto pt-4 border-t border-[#251c2f]/70">
        {userId ? (
          <button
            className="flex items-center gap-2 text-white/80 hover:text-accent transition font-semibold px-1 py-2 w-full justify-start text-sm"
            type="button"
            onClick={onSignOutClick}
          >
            <LogOut size={20} />
            <span className="hidden xs:inline">Sign Out</span>
          </button>
        ) : (
          <button
            className="flex items-center gap-2 text-white/80 hover:text-accent transition font-semibold px-1 py-2 w-full justify-start text-sm"
            type="button"
            onClick={onLoginClick}
          >
            <LogIn size={20} />
            <span className="hidden xs:inline">Login to Chat</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
