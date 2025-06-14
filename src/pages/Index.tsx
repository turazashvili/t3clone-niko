
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
  reasoning?: string;
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

  // Streaming handler:
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

    // Prepare streaming message "placeholder" object for frontend
    let assistantMsgId = Date.now().toString() + "_assistant";
    let streamedReasoning = "";
    let streamedContent = "";

    // Add a new "streaming" assistant message right away
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        reasoning: "",
      }
    ]);

    try {
      // Streaming fetch!
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

      // Start streaming/chunking...
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      // Stream logic
      if (reader) {
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });

            // Handle all complete lines in buffer
            while (true) {
              const lineEnd = buffer.indexOf('\n');
              if (lineEnd === -1) break;
              const line = buffer.slice(0, lineEnd).trim();
              buffer = buffer.slice(lineEnd + 1);

              // Only process 'data: ' lines, per OpenRouter/Edge Function
              if (!line || line.startsWith(":")) continue;
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                  done = true;
                  break;
                }
                try {
                  // This mirrors edge function logic:
                  const parsed = JSON.parse(data);
                  // Streamed fields
                  if (parsed.choices?.[0]?.delta?.reasoning !== undefined) {
                    streamedReasoning += parsed.choices[0].delta.reasoning;
                  }
                  if (parsed.choices?.[0]?.delta?.content !== undefined) {
                    streamedContent += parsed.choices[0].delta.content;
                  }
                  // Update "in progress" message in UI
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: streamedContent, reasoning: streamedReasoning }
                        : msg
                    )
                  );
                } catch {
                  // Ignore malformed JSON parts.
                }
              }
            }
          }
          if (doneReading) break;
        }
        // Final update: the stream finished.
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: streamedContent, reasoning: streamedReasoning }
              : msg
          )
        );
      } else {
        // Fallback: Not a stream (shouldn't happen)
        const { assistantResponse, chatId: newChatId } = await response.json();
        const { content, reasoning } = JSON.parse(assistantResponse);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content, reasoning }
              : msg
          )
        );
      }

      // If a new chatId was created, update and fetch latest from db afterwards
      if (!currentChatId) {
        // Get chatId from backend's final response (re-fetch the chat messages)
        try {
          const body = await response.clone().json();
          if (body.chatId) {
            setCurrentChatId(body.chatId);
            setSidebarRefreshKey(Date.now());
            await fetchChatMessages(body.chatId);
          }
        } catch { /* ignore errors from re-read attempt when already streamed */ }
      }
    } catch (err: any) {
      toast({ title: "Error sending message", description: err.message || "Could not connect to chat service.", variant: "destructive" });
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id && msg.id !== assistantMsgId));
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

