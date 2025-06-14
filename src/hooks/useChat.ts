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

function isUuidV4(id: string): boolean {
  // Matches UUID v4, e.g., 01234567-89ab-cdef-0123-456789abcdef
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

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
      setMessages(
        (data ?? [])
          .map((raw) => {
            const role: "user" | "assistant" =
              raw.role === "user" || raw.role === "assistant" ? raw.role : "assistant";
            const parsed = parseAssistantMessage(raw);
            return { ...parsed, chat_id: raw.chat_id, role };
          })
          .filter((msg) => isUuidV4(msg.id)) // Only keep real DB messages (ignore optimistic)
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
    async (msgId: string, newContent: string, modelOverride?: string) => {
      if (!session) {
        toast({ title: "Not authenticated", description: "Please log in.", variant: "destructive" });
        setLoginOpen(true);
        return false;
      }
      setIsLoading(true);

      const userMsgIdx = messages.findIndex(m => m.id === msgId);
      if (userMsgIdx === -1) {
        setIsLoading(false);
        toast({ title: "Edit error", description: "Message to edit not found.", variant: "destructive" });
        return false;
      }

      setMessages(prevMsgs =>
        prevMsgs.map((msg, i) =>
          msg.id === msgId ? { ...msg, content: newContent } : msg
        )
      );

      const assistantReplyId = `edit-assistant-${Date.now()}`;
      setMessages(prevMsgs => [
        ...prevMsgs.slice(0, userMsgIdx + 1),
        {
          id: assistantReplyId,
          role: "assistant",
          content: "",
          reasoning: "",
          chat_id: messages[userMsgIdx].chat_id,
        },
      ]);

      try {
        const resp = await fetch("https://tahxsobdcnbbqqonkhup.functions.supabase.co/message-edit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: msgId,
            newContent,
            modelOverride,
          }),
        });
        if (!resp.ok) {
          let msg = "Unknown error";
          try {
            const errObj = await resp.json();
            msg = errObj?.error || JSON.stringify(errObj);
          } catch {}
          toast({ title: "Edit Failed", description: msg, variant: "destructive" });
          setIsLoading(false);
          return false;
        }
        if (!resp.body) {
          toast({ title: "Edit Failed", description: "No response body from server.", variant: "destructive" });
          setIsLoading(false);
          return false;
        }

        // Handle SSE streaming
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamedContent = "";
        let streamedReasoning = "";
        let done = false;

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          if (doneReading) {
            done = true;
            continue;
          }
          buffer += decoder.decode(value, { stream: true });

          while (true) {
            const eventEnd = buffer.indexOf("\n\n");
            if (eventEnd === -1) break;
            const rawEvent = buffer.slice(0, eventEnd);
            buffer = buffer.slice(eventEnd + 2);

            let event = "message";
            let data = "";
            for (let line of rawEvent.split("\n")) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data += line.slice(5).trim();
            }

            if (event === "reasoning") {
              try {
                const parsed = JSON.parse(data);
                streamedReasoning = parsed.reasoning || "";
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantReplyId
                      ? { ...msg, reasoning: streamedReasoning }
                      : msg
                  )
                );
              } catch { }
            } else if (event === "content") {
              try {
                const parsed = JSON.parse(data);
                streamedContent += parsed.content || "";
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantReplyId
                      ? { ...msg, content: streamedContent }
                      : msg
                  )
                );
              } catch { }
            } else if (event === "done") {
              try {
                // On done, force a DB fetch for all messages for this chat
                const chatToFetch = messages[userMsgIdx].chat_id;
                if (chatToFetch) {
                  const { data, error } = await supabase
                    .from('messages')
                    .select('id, role, content, created_at, attachments, reasoning, chat_id')
                    .eq('chat_id', chatToFetch)
                    .order('created_at', { ascending: true });
                  if (!error && data) {
                    setMessages(
                      data.map((raw) => {
                        const role: "user" | "assistant" =
                          raw.role === "user" || raw.role === "assistant" ? raw.role : "assistant";
                        return {
                          ...raw,
                          role,
                          attachedFiles: (raw.attachments && Array.isArray(raw.attachments))
                            ? raw.attachments.map((f: any) => ({
                              name: f.name,
                              type: f.type,
                              url: f.url,
                              originalFile: undefined,
                            })) : [],
                        };
                      })
                    );
                  }
                }
              } catch { }
              done = true;
            } else if (event === "error") {
              try {
                const parsed = JSON.parse(data);
                toast({ title: "Edit Error", description: parsed.error || "Unknown error from server", variant: "destructive" });
                // Remove streaming assistant from UI
                setMessages((prev) => prev.filter((m) => m.id !== assistantReplyId));
                done = true;
              } catch { }
            }
          }
        }
        setIsLoading(false);
        return true;
      } catch (e: any) {
        toast({ title: "Edit error", description: e?.message || "Network error", variant: "destructive" });
        setIsLoading(false);
        // Remove assistant streaming placeholder if present
        setMessages((prev) => prev.filter((m) => m.id !== assistantReplyId));
        return false;
      }
    },
    [session, messages]
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
