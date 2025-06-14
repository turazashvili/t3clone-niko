import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UploadedFile } from "@/hooks/useFileUpload";
import { Message } from "@/hooks/useChat";

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
  attachedFiles?: UploadedFile[]
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
        if (event === "chatId" && data) {
          streamingNewChatId = data;
          if (!currentChatId) {
            setCurrentChatId(data);
            setSidebarRefreshKey(Date.now());
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

            // Always refetch from DB and replace ALL messages to prevent mismatch/duplicates
            const chatToFetch = streamingNewChatId || currentChatId;
            if (chatToFetch) {
              const fetchData = await supabase
                .from('messages')
                .select('id, role, content, created_at, attachments, reasoning')
                .eq('chat_id', chatToFetch)
                .order('created_at', { ascending: true });

              if (fetchData.error) {
                toast({ title: "Error fetching messages", description: fetchData.error.message, variant: "destructive" });
              } else {
                setMessages(() =>
                  (fetchData.data ?? []).map(parseAssistantMessage)
                );
              }
            }
          } catch {}
          done = true;
        } else if (event === "error") {
          try {
            const parsed = JSON.parse(data);
            toast({ title: "Error", description: parsed.error || "Unknown error from server", variant: "destructive" });
            setMessages((prev) => prev.filter((m) => m.id !== userMessage.id && m.id !== assistantMsgId));
            done = true;
          } catch {}
        }
      }
    }
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
