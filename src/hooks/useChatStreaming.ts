import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UploadedFile } from "@/hooks/useFileUpload";
import { Message } from "@/hooks/useChat";
import { processMessageStream } from "./useMessageStreamer";
import { formatToastError } from "./formatToastError";

const CHAT_HANDLER_URL = "https://tahxsobdcnbbqqonkhup.functions.supabase.co/chat-handler";

// Helper: parse assistant messages
const parseAssistantMessage = (msg: any) => {
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
    reasoning: msg.reasoning,
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
  onFirstMessageDone,
  onNewChatId,
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
  onFirstMessageDone?: () => void,
  onNewChatId?: (chatId: string) => void,
}) {
  setIsLoading(true);

  // Prepare a "temporary" assistant message id (prefixed, not a UUID)
  const optimisticAssistantId = `${Date.now()}_assistant`;

  try {
    const response = await fetch(CHAT_HANDLER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: currentChatId,
        userMessageContent: inputValue,
        userId: user.id,
        model: selectedModel,
        webSearchEnabled,
        attachedFiles
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();

    // Insert a temporary assistant message for streaming
    setMessages(prev => [
      ...prev,
      {
        id: optimisticAssistantId,
        role: "assistant",
        content: "",
        reasoning: "",
        attachedFiles: [],
        optimistic: true,
      }
    ]);

    let streamedContent = "";
    let streamedReasoning = "";

    await processMessageStream(reader, {
      onChatId: (chatId) => {
        if (!currentChatId && chatId) {
          setCurrentChatId(chatId);
          if (onNewChatId) onNewChatId(chatId);
        }
      },
      onReasoning: (chunk) => {
        streamedReasoning = chunk;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === optimisticAssistantId
              ? { ...msg, reasoning: streamedReasoning }
              : msg
          )
        );
      },
      onContent: (chunk) => {
        streamedContent += chunk;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === optimisticAssistantId
              ? { ...msg, content: streamedContent }
              : msg
          )
        );
      },
      onDone: async ({ chatId }) => {
        // Remove the optimistic message and refetch from DB
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
            if (onFirstMessageDone) onFirstMessageDone();
          }
        } else {
          // Always remove the optimistic assistant if somehow chatToFetch isn't available
          setMessages(prev => prev.filter(msg => msg.id !== optimisticAssistantId));
        }
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: formatToastError(err),
          variant: "destructive",
        });
        // Remove the optimistic assistant message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticAssistantId));
      }
    });
  } catch (err: any) {
    toast({ title: "Error sending message", description: err?.message || "Could not connect to chat service.", variant: "destructive" });
    // Remove the optimistic message on error
    setMessages(prev => prev.filter(msg => msg.id !== optimisticAssistantId));
  } finally {
    setIsLoading(false);
  }
}

// Export parseAssistantMessage in case needed outside
export { parseAssistantMessage };
