
import { useCallback } from "react";
import { MODELS_LIST } from "./useChatCore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UploadedFile } from "@/hooks/useFileUpload";
import { Message } from "@/types/chat";
import { sendMessageStreaming, parseAssistantMessage } from "@/hooks/useChatStreaming";
import { useMessagesRealtime } from "./useMessagesRealtime";
import { processMessageStream } from "./useMessageStreamer";
import { formatToastError } from "./formatToastError";
import { useChatCore } from "./useChatCore";

export function useChatActions(core: ReturnType<typeof useChatCore>) {
  const {
    session,
    user,
    currentChatId, setCurrentChatId,
    messages, setMessages,
    inputValue, setInputValue,
    isLoading, setIsLoading,
    sidebarRefreshKey, setSidebarRefreshKey,
    selectedModel, webSearchEnabled,
  } = core;

  useMessagesRealtime(currentChatId, setMessages);

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
      setMessages(
        (data ?? []).map((raw) => {
          const parsed = parseAssistantMessage(raw);
          return { ...parsed, chat_id: raw.chat_id };
        })
      );
    }
    setIsLoading(false);
  }, [setMessages, setIsLoading]);

  const handleSendMessage = useCallback(
    async (
      modelOverride?: string,
      webSearch?: boolean,
      attachedFiles?: UploadedFile[],
      inputOverride?: string,
      chatIdOverride?: string
    ) => {
      const contentToSend = inputOverride !== undefined ? inputOverride : inputValue;
      if (!contentToSend.trim()) return;
      if (!user) {
        toast({ title: "Authentication Required", description: "Please log in to start chatting.", variant: "default" });
        core.setLoginOpen(true);
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
      });
    },
    [inputValue, user, currentChatId, selectedModel, webSearchEnabled, setInputValue, setIsLoading, setSidebarRefreshKey, setMessages, setCurrentChatId]
  );

  const handleNewChat = useCallback(() => {
    setCurrentChatId(null);
    setMessages([]);
    setInputValue("");
    setSidebarRefreshKey(Date.now());
  }, [setCurrentChatId, setMessages, setInputValue, setSidebarRefreshKey]);

  const loadChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    fetchChatMessages(chatId);
  }, [setCurrentChatId, fetchChatMessages]);

  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error signing out", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Signed out successfully" });
    }
  }, []);

  const deleteMessagesAfter = useCallback(
    async (messageId: string) => {
      const idx = messages.findIndex(msg => msg.id === messageId);
      if (idx === -1 || !currentChatId) return;
      const afterMessages = messages.slice(idx + 1);
      const afterMsgIds = afterMessages.map(m => m.id);

      setMessages(messages.slice(0, idx + 1));

      if (afterMsgIds.length > 0) {
        const { error } = await supabase
          .from("messages")
          .delete()
          .in("id", afterMsgIds);
        if (error) {
          toast({ title: "Failed to delete previous messages in DB", description: error.message, variant: "destructive" });
        }
      }
    },
    [messages, currentChatId, setMessages]
  );

  const editMessage = useCallback(
    async (msgId: string, newContent: string, modelOverride?: string) => {
      if (!session) {
        toast({ title: "Not authenticated", description: "Please log in.", variant: "destructive" });
        core.setLoginOpen(true);
        return false;
      }
      setIsLoading(true);
      const assistantMsgId = Date.now().toString() + "_assistantEdit";
      let streamedContent = "";
      let streamedReasoning = "";

      setMessages(prev => {
        const userIdx = prev.findIndex(m => m.id === msgId);
        if (userIdx === -1) return prev;
        const hasAssistant = prev[userIdx + 1]?.role === "assistant";
        if (hasAssistant) {
          return prev.map((msg, idx) =>
            idx === userIdx + 1
              ? { ...msg, content: "", reasoning: "" }
              : msg
          );
        } else {
          const cp = [...prev];
          cp.splice(userIdx + 1, 0, {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            reasoning: "",
          });
          return cp;
        }
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
              const userIdx = prev.findIndex(m => m.id === msgId);
              const hasAssistant = userIdx !== -1 && prev[userIdx + 1]?.role === "assistant";
              if (hasAssistant) {
                return prev.map((msg, idx) =>
                  idx === userIdx + 1 ? { ...msg, reasoning: streamedReasoning } : msg
                );
              }
              const aIdx = prev.findIndex(m => m.id === assistantMsgId);
              if (aIdx !== -1) {
                return prev.map((msg, idx) =>
                  idx === aIdx ? { ...msg, reasoning: streamedReasoning } : msg
                );
              }
              return prev;
            });
          },
          onContent: (chunk) => {
            streamedContent += chunk;
            setMessages(prev => {
              const userIdx = prev.findIndex(m => m.id === msgId);
              const hasAssistant = userIdx !== -1 && prev[userIdx + 1]?.role === "assistant";
              if (hasAssistant) {
                return prev.map((msg, idx) =>
                  idx === userIdx + 1 ? { ...msg, content: streamedContent } : msg
                );
              }
              const aIdx = prev.findIndex(m => m.id === assistantMsgId);
              if (aIdx !== -1) {
                return prev.map((msg, idx) =>
                  idx === aIdx ? { ...msg, content: streamedContent } : msg
                );
              }
              return prev;
            });
          },
          onDone: async ({ content, reasoning }) => {
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
            setMessages(prev => {
              const userIdx = prev.findIndex(m => m.id === msgId);
              const hasAssistant = userIdx !== -1 && prev[userIdx + 1]?.role === "assistant";
              if (hasAssistant) {
                const cp = [...prev];
                cp.splice(userIdx + 1, 1);
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
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        return false;
      }
    },
    [session, messages, currentChatId, setMessages, setIsLoading]
  );

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
      // Placeholder for redoAfterEdit logic if needed in the future
    },
    [deleteMessagesAfter, handleSendMessage]
  );

  return {
    handleSendMessage,
    handleNewChat,
    loadChat,
    handleSignOut,
    deleteMessagesAfter,
    editMessage,
    redoAfterEdit,
    fetchChatMessages,
  };
}
