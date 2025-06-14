import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import modelsJson from "@/data/models.json";
import { LLMModel } from "@/types/llm-model";
import { UploadedFile } from "@/hooks/useFileUpload";
import { sendMessageStreaming, parseAssistantMessage } from "./useChatStreaming";

export const MODELS_LIST: LLMModel[] = (modelsJson as any).data;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  reasoning?: string;
  attachedFiles?: UploadedFile[]; // UI usage
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) handleNewChat();
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line
  }, []);

  // Only for initial chat loading, NOT for sending
  const fetchChatMessages = useCallback(async (chatId: string) => {
    if (!chatId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at, attachments')
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

  // NEW streaming handler now uses single DB insert (by edge only)
  const handleSendMessage = useCallback(
    async (modelOverride?: string, webSearch?: boolean, attachedFiles?: UploadedFile[]) => {
      if (!inputValue.trim()) return;
      if (!user) {
        toast({ title: "Authentication Required", description: "Please log in to start chatting.", variant: "default" });
        setLoginOpen(true);
        return;
      }
      // Clear input and immediately set loading state
      setInputValue("");
      setIsLoading(true);

      await sendMessageStreaming({
        inputValue,
        user,
        currentChatId,
        selectedModel: modelOverride || selectedModel,
        webSearchEnabled: typeof webSearch === "boolean" ? webSearch : webSearchEnabled,
        setCurrentChatId,
        setSidebarRefreshKey,
        setMessages,
        setIsLoading,
        attachedFiles: attachedFiles || [],
      });
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
