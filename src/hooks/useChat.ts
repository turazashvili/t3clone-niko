import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import modelsJson from "@/data/models.json";
import { LLMModel } from "@/types/llm-model";
import { UploadedFile } from "@/hooks/useFileUpload";
import { sendMessageStreaming, parseAssistantMessage } from "./useChatStreaming";
import { useMessagesRealtime } from "./useMessagesRealtime";
import { processMessageStream } from "./useMessageStreamer";
import { formatToastError } from "./formatToastError";
import { useSidebarSync } from "@/hooks/useSidebarSync";
import { useUserProfile } from "./useUserProfile";
import { useNavigate } from "react-router-dom";

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

  // Use custom hook for profile fetching
  const { userProfile, profileLoading } = useUserProfile(user);

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState(MODELS_LIST[0].id);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // Track previous chat id to detect when a new chat is created
  const prevChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      prevChatIdRef.current === null &&
      typeof currentChatId === "string" &&
      !!currentChatId
    ) {
      // Just transitioned from new chat (null) to first real chatId
      setSidebarRefreshKey(Date.now());
    }
    prevChatIdRef.current = currentChatId;
  }, [currentChatId]);

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

  // === NEW: Attach realtime chat syncing here ===
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

  // Refactored: Streaming editMessage using SSE (mirrors sendMessageStreaming logic)
  const editMessage = useCallback(
    async (msgId: string, newContent: string, modelOverride?: string) => {
      if (!session) {
        toast({ title: "Not authenticated", description: "Please log in.", variant: "destructive" });
        setLoginOpen(true);
        return false;
      }
      setIsLoading(true);
      let assistantMsgId = Date.now().toString() + "_assistantEdit";
      let streamedContent = "";
      let streamedReasoning = "";

      // Find/prepare UI placeholder
      const editingTargetMsgIndex = messages.findIndex(
        (m, i) =>
          m.id === msgId &&
          messages[i + 1] &&
          messages[i + 1].role === "assistant"
      );
      const origAssistant = editingTargetMsgIndex !== -1 ? messages[editingTargetMsgIndex + 1] : null;

      setMessages((prev) => {
        if (origAssistant) {
          return prev.map((msg, idx) =>
            idx === editingTargetMsgIndex + 1
              ? { ...msg, content: "", reasoning: "" }
              : msg
          );
        } else {
          // Add placeholder if no assistant after
          const i = prev.findIndex(m => m.id === msgId);
          if (i !== -1) {
            const cp = [...prev];
            cp.splice(i + 1, 0, {
              id: assistantMsgId,
              role: "assistant",
              content: "",
              reasoning: "",
            });
            return cp;
          }
        }
        return prev;
      });

      try {
        const payload: Record<string, any> = { id: msgId, newContent };
        if (modelOverride) payload.modelOverride = modelOverride;
        const res = await fetch(
          "https://tahxsobdcnbbqqonkhup.functions.supabase.co/message-edit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok || !res.body) {
          let errJson: any = null;
          let errText: string | undefined = undefined;
          try {
            errJson = await res.json();
          } catch {
            errText = await res.text();
          }
          toast({
            title: "Failed to edit message",
            description: formatToastError(errJson || errText),
            variant: "destructive",
          });
          setIsLoading(false);
          return false;
        }

        const reader = res.body.getReader();

        await processMessageStream(reader, {
          onReasoning: (chunk) => {
            streamedReasoning = chunk;
            setMessages(prev => {
              // Update the UI assistant placeholder
              const idx = prev.findIndex((m, i) =>
                m.id === msgId && prev[i + 1] && prev[i + 1].role === "assistant"
              );
              if (idx !== -1 && prev[idx + 1]) {
                return prev.map((msg, i2) =>
                  i2 === idx + 1 ? { ...msg, reasoning: streamedReasoning } : msg
                );
              }
              const aIdx = prev.findIndex((m) => m.id === assistantMsgId);
              if (aIdx !== -1) {
                return prev.map((msg, i2) =>
                  i2 === aIdx ? { ...msg, reasoning: streamedReasoning } : msg
                );
              }
              return prev;
            });
          },
          onContent: (chunk) => {
            streamedContent += chunk;
            setMessages(prev => {
              const idx = prev.findIndex((m, i) =>
                m.id === msgId && prev[i + 1] && prev[i + 1].role === "assistant"
              );
              if (idx !== -1 && prev[idx + 1]) {
                return prev.map((msg, i2) =>
                  i2 === idx + 1 ? { ...msg, content: streamedContent } : msg
                );
              }
              const aIdx = prev.findIndex((m) => m.id === assistantMsgId);
              if (aIdx !== -1) {
                return prev.map((msg, i2) =>
                  i2 === aIdx ? { ...msg, content: streamedContent } : msg
                );
              }
              return prev;
            });
          },
          onDone: async ({ content, reasoning }) => {
            // Refetch the full chat for consistency
            const iMsg = messages.find((m) => m.id === msgId);
            const chatIdToFetch = iMsg?.chat_id || currentChatId;
            if (chatIdToFetch) {
              const { data, error } = await supabase
                .from("messages")
                .select("id, role, content, created_at, attachments, reasoning, chat_id")
                .eq("chat_id", chatIdToFetch)
                .order("created_at", { ascending: true });
              if (error) {
                toast({
                  title: "Error fetching messages",
                  description: formatToastError(error),
                  variant: "destructive",
                });
              } else {
                setMessages(() => (data ?? []).map(parseAssistantMessage));
              }
            }
            setIsLoading(false);
          },
          onError: (e) => {
            toast({
              title: "Error editing message",
              description: formatToastError(e),
              variant: "destructive",
            });
            // Remove blanked assistant message if present
            setMessages(prev => {
              const idx = prev.findIndex((m, i) =>
                m.id === msgId && prev[i + 1] && prev[i + 1].role === "assistant"
              );
              if (idx !== -1 && prev[idx + 1]) {
                const cp = [...prev];
                cp.splice(idx + 1, 1);
                return cp;
              }
              return prev.filter(m => m.id !== assistantMsgId);
            });
            setIsLoading(false);
          }
        });
        return true;
      } catch (e: any) {
        toast({
          title: "Failed to edit message",
          description: formatToastError(e),
          variant: "destructive",
        });
        setIsLoading(false);
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantMsgId)
        );
        return false;
      }
    },
    [session, messages, currentChatId]
  );

  // REPLACE THE OLD handleSendMessage, redoAfterEdit, etc. from here...

  // === sendMessage handler now refreshes sidebar on every DB sync ===
  const { triggerSidebarRefresh } = useSidebarSync(user?.id);

  // Add navigation
  const navigate = useNavigate();

  // Updated handleSendMessage to accept auto-navigation after chat creation
  const handleSendMessage = useCallback(
    async (
      modelOverride?: string,
      webSearch?: boolean,
      attachedFiles?: UploadedFile[],
      inputOverride?: string,
      chatIdOverride?: string
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

      await sendMessageStreaming({
        inputValue: contentToSend,
        user,
        currentChatId: chatIdOverride ?? currentChatId,
        selectedModel: modelOverride || selectedModel,
        webSearchEnabled: typeof webSearch === "boolean" ? webSearch : webSearchEnabled,
        setCurrentChatId,
        setSidebarRefreshKey,
        setMessages,
        setIsLoading,
        attachedFiles: attachedFiles || [],
        // Always trigger sidebar refresh after each message is sent and synced.
        onFirstMessageDone: () => {
          setSidebarRefreshKey(Date.now());
          if (triggerSidebarRefresh) triggerSidebarRefresh();
        },
        // NEW: Auto-navigate to /chat/{chatId} after first message creates a chat
        onNewChatId: (chatId: string) => {
          navigate(`/chat/${chatId}`);
        },
      });
    },
    [
      inputValue,
      user,
      currentChatId,
      selectedModel,
      webSearchEnabled,
      triggerSidebarRefresh,
      setSidebarRefreshKey,
      setInputValue,
      setIsLoading,
      setCurrentChatId,
      setMessages,
      navigate // added to dependency array
    ]
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
    session, user, userProfile, profileLoading, // added
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
