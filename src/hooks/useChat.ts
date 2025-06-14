import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import modelsJson from "@/data/models.json";
import { LLMModel } from "@/types/llm-model";
import { UploadedFile } from "@/hooks/useFileUpload";
import { sendMessageStreaming, parseAssistantMessage } from "./useChatStreaming";
import { useMessagesRealtime } from "./useMessagesRealtime";

export const MODELS_LIST: LLMModel[] = (modelsJson as any).data;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  reasoning?: string;
  attachedFiles?: UploadedFile[]; // UI usage
  chat_id?: string; // <------ Add this line
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

  // === NEW: Attach Realtime chat syncing here ===
  useMessagesRealtime(currentChatId, setMessages);

  // Only for initial chat loading, NOT for sending
  const fetchChatMessages = useCallback(async (chatId: string) => {
    if (!chatId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at, attachments, chat_id')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: "Error fetching messages", description: error.message, variant: "destructive" });
      setMessages([]);
    } else {
      // On successful fetch: wipe and replace with only the DB messages (no leftover optimistic messages)
      setMessages(
        (data ?? []).map((raw) => {
          // parseAssistantMessage may need to propagate chat_id now
          // If it does not, we add it here:
          const parsed = parseAssistantMessage(raw);
          return { ...parsed, chat_id: raw.chat_id };
        })
      );
    }
    setIsLoading(false);
  }, []);

  // Helper to delete all messages after a certain messageId in the DB and locally
  const deleteMessagesAfter = useCallback(
    async (messageId: string) => {
      // Find the retried message index in state
      const idx = messages.findIndex(msg => msg.id === messageId);
      if (idx === -1 || !currentChatId) return;

      // Find messages after idx (to delete in DB)
      const afterMessages = messages.slice(idx + 1);
      const afterMsgIds = afterMessages.map(m => m.id);

      // Remove from frontend
      setMessages(messages.slice(0, idx + 1));

      if (afterMsgIds.length > 0) {
        // Remove from DB (batched delete)
        const { error } = await supabase
          .from("messages")
          .delete()
          .in("id", afterMsgIds);
        if (error) {
          toast({ title: "Failed to delete previous messages in DB", description: error.message, variant: "destructive" });
        }
      }
    },
    [messages, currentChatId]
  );

  // Add editMessage implementation
  const editMessage = useCallback(
    async (msgId: string, newContent: string) => {
      if (!session) {
        toast({ title: "Not authenticated", description: "Please log in.", variant: "destructive" });
        setLoginOpen(true);
        return false;
      }
      setIsLoading(true);
      try {
        const res = await fetch(
          "https://tahxsobdcnbbqqonkhup.functions.supabase.co/message-edit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ id: msgId, newContent }),
          }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast({ title: "Failed to edit message", description: data.error || "Unknown error", variant: "destructive" });
          setIsLoading(false);
          return false;
        }
        setIsLoading(false);
        return true;
      } catch(e: any) {
        toast({ title: "Failed to edit message", description: e.message, variant: "destructive" });
        setIsLoading(false);
        return false;
      }
    },
    [session]
  );

  // REPLACE THE OLD handleSendMessage, redoAfterEdit, etc. from here...

  const handleSendMessage = useCallback(
    async (
      modelOverride?: string,
      webSearch?: boolean,
      attachedFiles?: UploadedFile[],
      inputOverride?: string,
      chatIdOverride?: string // <-- NEW PARAM
    ) => {
      const contentToSend = inputOverride !== undefined ? inputOverride : inputValue;
      console.log("handleSendMessage called", {
        modelOverride,
        webSearch,
        attachedFiles,
        inputOverride,
        contentToSend,
        user,
        currentChatId: chatIdOverride ?? currentChatId
      });

      if (!contentToSend.trim()) {
        console.log("Early exit: contentToSend is empty", { contentToSend });
        return;
      }
      if (!user) {
        console.log("Early exit: user not set");
        toast({ title: "Authentication Required", description: "Please log in to start chatting.", variant: "default" });
        setLoginOpen(true);
        return;
      }
      if (inputOverride === undefined) setInputValue("");
      setIsLoading(true);

      // REMOVE the optimistic setMessages here!
      // Previously, something like:
      // setMessages((prev) => [...prev, { ... }]);
      // Instead, just send the message, and let realtime sync show it when it is inserted.

      await sendMessageStreaming({
        inputValue: contentToSend,
        user,
        currentChatId: chatIdOverride ?? currentChatId,
        selectedModel: modelOverride || selectedModel,
        webSearchEnabled: typeof webSearch === "boolean" ? webSearch : webSearchEnabled,
        setCurrentChatId,
        setSidebarRefreshKey,
        setMessages, // Still pass this, as sendMessageStreaming might want to update messages after stream is done.
        setIsLoading,
        attachedFiles: attachedFiles || [],
      });
    },
    [inputValue, user, currentChatId, selectedModel, webSearchEnabled]
  );

  // Helper for redoing after edit - NO LONGER NEEDED for UI edit flow!
  // Kept for API compatibility, but should now be avoided for in-UI flow

  const redoAfterEdit = useCallback(
    async ({
      msgId,
      newContent,
      attachedFiles,
      modelOverride,
      chat_id,
    }: {
      msgId: string;
      newContent: string;
      attachedFiles?: UploadedFile[];
      modelOverride?: string;
      chat_id?: string;
    }) => {
      // OLD LOGIC, NO LONGER USED IN MAIN EDIT FLOW
      // - delete all following messages
      // - send the edited message as a new prompt (preserving attachments, chat_id)
      // LEAVE IT for now but don't use in the main ChatMessage edit submit.
    },
    [deleteMessagesAfter, handleSendMessage]
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
    deleteMessagesAfter,
    editMessage,
    redoAfterEdit,
    fetchChatMessages
  };
}
