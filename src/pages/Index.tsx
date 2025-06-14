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
  reasoning?: string; // Allow assistant messages to have reasoning
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

const CHAT_HANDLER_URL = "https://tahxsobdcnbbqqonkhup.functions.supabase.co/chat-handler";

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

  // Update: parse assistant `content` JSON if present
  const parseAssistantMessage = (msg: any) => {
    if (msg.role === "assistant") {
      try {
        const { content, reasoning } = JSON.parse(msg.content);
        return { ...msg, content, reasoning };
      } catch {
        // fallback to plain content
        return { ...msg, content: msg.content, reasoning: undefined };
      }
    }
    return msg;
  };

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
      setMessages(
        (data ?? []).map(parseAssistantMessage)
      );
    }
    setIsLoading(false);
  };

  // Streaming handler: UPDATED to process SSE streaming!
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

    let assistantMsgId = Date.now().toString() + "_assistant";
    let streamedContent = "";
    let streamedReasoning = "";
    let streamingNewChatId: string | null = null;

    // Add a tentative placeholder assistant message for live streaming
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        reasoning: "",
      },
    ]);

    try {
      const response = await fetch(CHAT_HANDLER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: currentChatId,
          userMessageContent: userMessage.content,
          userId: user.id,
          model: modelOverride || selectedModel,
          webSearchEnabled: typeof webSearch === "boolean" ? webSearch : webSearchEnabled,
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        if (doneReading) {
          done = true;
          continue;
        }
        buffer += decoder.decode(value, { stream: true });

        // process each complete event
        while (true) {
          // Find a full SSE event: ends with \n\n
          const eventEnd = buffer.indexOf("\n\n");
          if (eventEnd === -1) break;
          const rawEvent = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          // Parse event and data
          let event = "message";
          let data = "";
          for (let line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          // Handle event types
          if (event === "chatId" && data) {
            streamingNewChatId = data;
            if (!currentChatId) {
              setCurrentChatId(data);
              setSidebarRefreshKey(Date.now());
              // PATCH: DO NOT fetchChatMessages here
            }
          } else if (event === "reasoning") {
            try {
              const parsed = JSON.parse(data);
              streamedReasoning = parsed.reasoning || "";
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, reasoning: streamedReasoning }
                    : msg
                )
              );
            } catch {}
          } else if (event === "content") {
            try {
              const parsed = JSON.parse(data);
              streamedContent += parsed.content || "";
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: streamedContent }
                    : msg
                )
              );
            } catch {}
          } else if (event === "done") {
            try {
              const parsed = JSON.parse(data);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: parsed.content,
                        reasoning: parsed.reasoning,
                      }
                    : msg
                )
              );
              // PATCH: Only fetchChatMessages if this is not the "first message, new chat"
              // If chatId was previously null (just created), do NOT refresh messages (would likely be empty)
              // Only update sidebar/listing as above.
              if (!currentChatId && streamingNewChatId) {
                // Only refresh sidebar, do NOT fetchChatMessages here!
                setCurrentChatId(streamingNewChatId);
                setSidebarRefreshKey(Date.now());
                // (Remove/skip fetchChatMessages(streamingNewChatId);)
              } else if (currentChatId) {
                // For subsequent messages, ensure up-to-date list
                await fetchChatMessages(currentChatId);
              }
            } catch {}
            done = true;
          } else if (event === "error") {
            try {
              const parsed = JSON.parse(data);
              toast({ title: "Error", description: parsed.error || "Unknown error from server", variant: "destructive" });
              // Remove the streamed assistant message placeholder
              setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
              done = true;
            } catch {}
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Error sending message", description: err?.message || "Could not connect to chat service.", variant: "destructive" });
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id && msg.id !== assistantMsgId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setInputValue("");
    setSidebarRefreshKey(Date.now());
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
