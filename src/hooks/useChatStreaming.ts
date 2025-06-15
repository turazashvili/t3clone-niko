
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
  // NO local/optimistic message insertion here!
  setIsLoading(true);

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

    // We'll detect the first "chatId" in the SSE stream and use it:
    await processMessageStream(reader, {
      onChatId: (chatId) => {
        if (!currentChatId && chatId) {
          setCurrentChatId(chatId);
          if (onNewChatId) onNewChatId(chatId);
        }
      },
      // Don't update UI for content or reasoning! Only update after DB synces.
      onReasoning: (_chunk) => {},
      onContent: (_chunk) => {},
      onDone: async ({ chatId }) => {
        // Refetch from DB to ensure UI is correct/consistent (optional safety)
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
        }
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: formatToastError(err),
          variant: "destructive",
        });
        // Don't remove any messages (nothing was optimistically added)
      }
    });
  } catch (err: any) {
    toast({ title: "Error sending message", description: err?.message || "Could not connect to chat service.", variant: "destructive" });
    // Don't remove any messages (nothing was optimistically added)
  } finally {
    setIsLoading(false);
  }
}

// Export parseAssistantMessage in case needed outside
export { parseAssistantMessage };
