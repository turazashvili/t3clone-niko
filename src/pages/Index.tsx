
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import ChatInputBar from "@/components/ChatInputBar";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import ChatArea from "./ChatArea";
import EmptyState from "./EmptyState";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

const Index = () => {
  const [loginOpen, setLoginOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState<number>(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) handleNewChat();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchChatMessages = async (chatId: string) => {
    if (!chatId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: "Error fetching messages", description: error.message, variant: "destructive" });
      setMessages([]);
    } else {
      setMessages((data ?? []) as Message[]);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to start chatting.", variant: "default" });
      setLoginOpen(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-handler', {
        body: {
          chatId: currentChatId,
          userMessageContent: userMessage.content,
          userId: user.id,
        },
      });

      if (error) throw error;

      const { assistantResponse, chatId: newChatId } = data;
      if (!currentChatId && newChatId) {
        setCurrentChatId(newChatId);
        setSidebarRefreshKey(Date.now()); // Trigger Sidebar refresh when creating a new chat!
        await fetchChatMessages(newChatId);
      } else {
        const assistantMessage: Message = {
          id: Date.now().toString() + "_assistant",
          role: "assistant",
          content: assistantResponse,
        };
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      }
    } catch (err: any) {
      toast({ title: "Error sending message", description: err.message || "Could not connect to chat service.", variant: "destructive" });
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setInputValue("");
    setSidebarRefreshKey(Date.now()); // Trigger a refresh when user starts a new chat session
  };

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    fetchChatMessages(chatId);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error signing out", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Signed out successfully" });
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-transparent">
      <Sidebar
        onLoginClick={() => setLoginOpen(true)}
        onNewChatClick={handleNewChat}
        onLoadChat={loadChat}
        userId={user?.id}
        onSignOutClick={handleSignOut}
        triggerRefresh={sidebarRefreshKey}
      />
      <main className="flex-1 flex flex-col min-h-screen relative bg-transparent">
        {messages.length === 0 && !isLoading ? (
          <EmptyState />
        ) : (
          <ChatArea messages={messages} isLoading={isLoading} />
        )}
        {/* Chat Input Area */}
        <div className="w-full max-w-3xl mx-auto px-4 pb-6 sticky bottom-0 bg-transparent pt-2">
          <ChatInputBar
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSend={handleSendMessage}
            isLoading={isLoading}
            disabled={!user}
            user={user}
          />
          <div className="text-xs text-white/40 mt-2 text-center">
            Make sure you agree to our <a href="#" className="underline hover:text-accent">Terms</a> and <a href="#" className="underline hover:text-accent">Privacy Policy</a>
          </div>
        </div>
      </main>
      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        afterLogin={() =>
          supabase.auth.getSession().then(({ data }) => {
            setUser(data.session?.user ?? null);
            setSession(data.session);
          })
        }
      />
    </div>
  );
};

export default Index;
