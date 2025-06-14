
import { LogIn, Plus, Search, MessageSquare, Loader2, LogOut } from "lucide-react";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
}

const Sidebar: React.FC<SidebarProps> = ({ onLoginClick, onNewChatClick, onLoadChat, userId, onSignOutClick, triggerRefresh }) => {
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  useEffect(() => {
    const fetchRecentChats = async () => {
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
    };

    fetchRecentChats();

    // Listen for realtime changes to 'chats'
    const channel = supabase
      .channel('public:chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `user_id=eq.${userId}` }, () => {
        fetchRecentChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, triggerRefresh]);

  return (
    <aside className="flex flex-col h-full w-[290px] bg-gradient-to-b from-[#201022] via-[#19101c] to-[#19101c] border-r border-[#251c2f]/70 px-4 py-5">
      <div className="flex items-center gap-2 mb-6 select-none">
        <span className="font-bold tracking-wide text-xl text-white">
          T3
          <span className="text-accent font-bold">.chat</span>
        </span>
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
      <div className="flex-1 overflow-y-auto mt-2 pr-1 custom-scrollbar">
        {loadingChats && (
          <div className="flex justify-center items-center h-full">
            <Loader2 size={24} className="animate-spin text-white/50" />
          </div>
        )}
        {!loadingChats && recentChats.length === 0 && userId && (
          <p className="text-center text-sm text-white/50 py-4">No recent chats.</p>
        )}
        {!loadingChats && recentChats.map((chat) => (
          <div
            key={chat.id}
            className="py-2 px-3 rounded-md text-white/80 hover:bg-[#251933] hover:text-white font-medium cursor-pointer transition mb-1 flex items-center gap-2"
            onClick={() => onLoadChat?.(chat.id)}
          >
            <MessageSquare size={16} className="text-white/60 shrink-0" />
            <span className="truncate flex-1">{chat.title || `Chat from ${new Date(chat.created_at).toLocaleDateString()}`}</span>
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
