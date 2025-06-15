import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UploadedFile } from "@/hooks/useFileUpload";
import { Message } from "@/hooks/useChat";
import { processMessageStream } from "./useMessageStreamer";
import { formatToastError } from "./formatToastError";

const CHAT_HANDLER_URL = "https://tahxsobdcnbbqqonkhup.functions.supabase.co/chat-handler";

// Helper: parse assistant messages
const parseAssistantMessage = (msg: any) => {
  // No longer parse msg.content as JSON. Just use as plain text.
  let attachedFiles: UploadedFile[] = [];
  if (msg.attachments && Array.isArray(msg.attachments)) {
    attachedFiles = msg.attachments.map((f: any) => ({
      name: f.name,
      type: f.type,
      url: f.url,
      originalFile: undefined,
    }));
  }
  return {
    ...msg,
    content: msg.content,
    reasoning: msg.reasoning, // just use directly
    attachedFiles,
  };
};

// Streaming function
export async function sendMessageStreaming({
  inputValue,
  user,
  currentChatId,
  selectedModel,
  webSearchEnabled,
  setCurrentChatId,
  setSidebarRefreshKey,
  setMessages,
  setIsLoading,
  attachedFiles = [],
  onFirstMessageDone, // NEW: callback after first message is fully synced
  onNewChatId, // <--- ADDED! callback with new chatId
}: {
  inputValue: string,
  user: any,
  currentChatId: string | null,
  selectedModel: string,
  webSearchEnabled: boolean,
  setCurrentChatId: (id: string) => void,
  setSidebarRefreshKey: (key: number) => void,
  setMessages: (fn: (prev: Message[]) => Message[]) => void,
  setIsLoading: (is: boolean) => void,
  attachedFiles?: UploadedFile[],
  onFirstMessageDone?: () => void, // NEW
  onNewChatId?: (chatId: string) => void, // <--- ADDED
}) {
  // Prepare local user message
  const userMessage: Message = {
    id: Date.now().toString(),
    role: "user",
    content: inputValue,
    attachedFiles,
  };

  // Optimistically add user message in UI only (NOT in DB)
  setMessages((prevMessages) => [...prevMessages, userMessage]);
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
    // Do NOT insert the user message in DB here!
    // Let edge function handle creation/writing to DB

    const response = await fetch(CHAT_HANDLER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: currentChatId,
        userMessageContent: userMessage.content,
        userId: user.id,
        model: selectedModel,
        webSearchEnabled,
        attachedFiles
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();

    let initialChatId: string | null = null;

    // We'll detect the first "chatId" in the SSE stream and use it:
    await processMessageStream(reader, {
      onReasoning: (chunk) => {
        streamedReasoning = chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, reasoning: streamedReasoning }
              : msg
          )
        );
      },
      onContent: (chunk) => {
        streamedContent += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: streamedContent }
              : msg
          )
        );
      },
      onDone: async ({ content, reasoning, chatId }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content,
                  reasoning,
                }
              : msg
          )
        );
        // If a new chatId was created, set it and trigger navigation:
        if (chatId && !currentChatId) {
          setCurrentChatId(chatId);
          if (onNewChatId) {
            onNewChatId(chatId);
          }
        }
        const chatToFetch = chatId || currentChatId;
        if (chatToFetch) {
          const fetchData = await supabase
            .from('messages')
            .select('id, role, content, created_at, attachments, reasoning, chat_id')
            .eq('chat_id', chatToFetch)
            .order('created_at', { ascending: true });

          if (fetchData.error) {
            toast({ title: "Error fetching messages", description: fetchData.error.message, variant: "destructive" });
          } else {
            setMessages(() =>
              (fetchData.data ?? []).map(parseAssistantMessage)
            );
           // --- REFRESH SIDEBAR AFTER FIRST MESSAGE ARRIVED (and DB is up-to-date) ---
           if (onFirstMessageDone) onFirstMessageDone();
          }
        }
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: formatToastError(err),
          variant: "destructive",
        });
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id && m.id !== assistantMsgId));
      }
    });
  } catch (err: any) {
    toast({ title: "Error sending message", description: err?.message || "Could not connect to chat service.", variant: "destructive" });
    // Remove optimistic messages (user and assistant)
    setMessages(prev => prev.filter(msg => msg.id !== userMessage.id && msg.id !== assistantMsgId));
  } finally {
    setIsLoading(false);
  }
}

// Export parseAssistantMessage in case needed outside
export { parseAssistantMessage };
