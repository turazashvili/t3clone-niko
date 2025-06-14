import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import modelsJson from "@/data/models.json";
import { LLMModel } from "@/types/llm-model";
import { UploadedFile } from "@/hooks/useFileUpload";

export const MODELS_LIST: LLMModel[] = (modelsJson as any).data;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  reasoning?: string;
}

export const MODEL_LIST = [
  { label: "Gemini 2.5 Pro", value: "google/gemini-2.5-pro-preview" },
  { label: "GPT-4o Mini", value: "openai/o4-mini" },
  { label: "GPT-4.1", value: "openai/gpt-4.1" },
  { label: "OpenAI o1 Pro", value: "openai/o1-pro" },
  { label: "Claude Opus 4", value: "anthropic/claude-opus-4" },
  { label: "Claude Sonnet 4", value: "anthropic/claude-sonnet-4" },
  { label: "DeepSeek R1", value: "deepseek/deepseek-r1-0528" },
];

const CHAT_HANDLER_URL = "https://tahxsobdcnbbqqonkhup.functions.supabase.co/chat-handler";

export function useChat() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState(MODELS_LIST[0].id);
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
    // eslint-disable-next-line
  }, []);

  // Helper: parse assistant messages
  const parseAssistantMessage = (msg: any) => {
    if (msg.role === "assistant") {
      try {
        const { content, reasoning } = JSON.parse(msg.content);
        return { ...msg, content, reasoning };
      } catch {
        return { ...msg, content: msg.content, reasoning: undefined };
      }
    }
    return msg;
  };

  const fetchChatMessages = useCallback(async (chatId: string) => {
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
  }, []);

  // Streaming handler
  const handleSendMessage = useCallback(
    async (modelOverride?: string, webSearch?: boolean, attachedFiles?: UploadedFile[]) => {
      if (!inputValue.trim()) return;
      if (!user) {
        toast({ title: "Authentication Required", description: "Please log in to start chatting.", variant: "default" });
        setLoginOpen(true);
        return;
      }

      // Make new user message with optional attachments
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: inputValue,
        // @ts-ignore: allow attachedFiles passthrough, not in DB yet
        attachedFiles,
      };
      setMessages((prevMessages) => [...prevMessages, userMessage]);
      setInputValue("");
      setIsLoading(true);

      let assistantMsgId = Date.now().toString() + "_assistant";
      let streamedContent = "";
      let streamedReasoning = "";
      let streamingNewChatId: string | null = null;

      // Add placeholder assistant message
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
            attachedFiles, // NEW
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
                // Do NOT fetchChatMessages here
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

                if (!currentChatId && streamingNewChatId) {
                  setCurrentChatId(streamingNewChatId);
                  setSidebarRefreshKey(Date.now());
                  // Do NOT call fetchChatMessages here -- trust streamed messages!
                } else if (currentChatId) {
                  // For existing chats, fetch – but do not replace messages if fetch returns empty!
                  const fetchData = await supabase
                    .from('messages')
                    .select('id, role, content, created_at')
                    .eq('chat_id', currentChatId)
                    .order('created_at', { ascending: true });

                  if (fetchData.error) {
                    toast({ title: "Error fetching messages", description: fetchData.error.message, variant: "destructive" });
                    // Do NOT clear messages
                  } else if ((fetchData.data ?? []).length > 0) {
                    setMessages(
                      fetchData.data.map(parseAssistantMessage)
                    );
                  }
                  // If fetchData.data is empty, don't clear/overwrite existing messages!
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
    },
    [inputValue, user, currentChatId, selectedModel, webSearchEnabled]
  );

  const handleNewChat = useCallback(() => {
    setCurrentChatId(null);
    setMessages([]);
    setInputValue("");
    setSidebarRefreshKey(Date.now());
  }, []);

  const loadChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    fetchChatMessages(chatId);
  }, [fetchChatMessages]);

  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error signing out", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Signed out successfully" });
    }
  }, []);

  return {
    loginOpen, setLoginOpen,
    session, user,
    currentChatId, setCurrentChatId,
    messages, setMessages,
    inputValue, setInputValue,
    isLoading, setIsLoading,
    sidebarRefreshKey, setSidebarRefreshKey,
    selectedModel, setSelectedModel,
    webSearchEnabled, setWebSearchEnabled,
    handleSendMessage,
    handleNewChat,
    loadChat,
    handleSignOut,
  };
}
