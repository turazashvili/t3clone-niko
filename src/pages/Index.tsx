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

const MODEL_LIST = [
  { label: "Gemini 2.5 Pro", value: "google/gemini-2.5-pro-preview" },
  { label: "GPT-4o Mini", value: "openai/o4-mini" },
  { label: "GPT-4.1", value: "openai/gpt-4.1" },
  { label: "OpenAI o1 Pro", value: "openai/o1-pro" },
  { label: "Claude Opus 4", value: "anthropic/claude-opus-4" },
  { label: "Claude Sonnet 4", value: "anthropic/claude-sonnet-4" },
  { label: "DeepSeek R1", value: "deepseek/deepseek-r1-0528" },
];

const Index = () => {
  const [loginOpen, setLoginOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState(MODEL_LIST[0].value);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

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

  const handleSendMessage = async (modelOverride?: string, webSearch?: boolean) => {
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
      // Optimistically add empty assistant message for streaming UI
      const assistantMsgId = Date.now().toString() + "_assistant";
      setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

      // -- FIXED SECTION: Use access token from local session state, not supabase.auth.session()
      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (session?.access_token) {
        fetchHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      // --- FIX: Call Supabase Edge Function (correct full URL, not relative path)
      const response = await fetch(
        'https://tahxsobdcnbbqqonkhup.functions.supabase.co/chat-handler',
        {
          method: 'POST',
          headers: fetchHeaders,
          body: JSON.stringify({
            chatId: currentChatId,
            userMessageContent: userMessage.content,
            userId: user.id,
            model: modelOverride || selectedModel,
            webSearchEnabled: typeof webSearch === "boolean" ? webSearch : webSearchEnabled,
          }),
        }
      );

      if (!response.body || !response.ok) {
        // Get error message if available
        let errMsg = "Could not connect to chat service.";
        try { errMsg = ((await response.json())?.error) ?? errMsg; } catch {}
        throw new Error(errMsg);
      }

      // Stream chat content
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantContent = "";
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        if (value) {
          const text = decoder.decode(value);
          assistantContent += text;
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === assistantMsgId ? { ...msg, content: assistantContent } : msg
            )
          );
        }
        done = doneReading;
      }

      // When streaming ends, if no chatId, update it and reload full history
      if (!currentChatId) {
        setSidebarRefreshKey(Date.now());
      }
    } catch (err: any) {
      toast({ title: "Error sending message", description: err.message || "Could not connect to chat service.", variant: "destructive" });
      setMessages(prev => prev.filter(msg => !msg.id?.toString().endsWith("_assistant")));
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
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            webSearchEnabled={webSearchEnabled}
            setWebSearchEnabled={setWebSearchEnabled}
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
