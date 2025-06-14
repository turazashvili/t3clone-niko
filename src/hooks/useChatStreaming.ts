
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UploadedFile } from "@/hooks/useFileUpload";
import { Message } from "@/hooks/useChat";

const CHAT_HANDLER_URL = "https://tahxsobdcnbbqqonkhup.functions.supabase.co/chat-handler";

// Helper: parse assistant messages (copy from useChat)
const parseAssistantMessage = (msg: any) => {
  if (msg.role === "assistant") {
    try {
      const { content, reasoning } = JSON.parse(msg.content);
      return { ...msg, content, reasoning };
    } catch {
      return { ...msg, content: msg.content, reasoning: undefined };
    }
  }
  let attachedFiles: UploadedFile[] = [];
  if (msg.attachments && Array.isArray(msg.attachments)) {
    attachedFiles = msg.attachments.map((f: any) => ({
      name: f.name,
      type: f.type,
      url: f.url,
      originalFile: undefined,
    }));
  }
  return { ...msg, attachedFiles };
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
  setIsLoading,
  attachedFiles = [],
  // setMessages is now optional and should NOT be used for inserting/removing user/assistant messages!
  setMessages,
}: {
  inputValue: string,
  user: any,
  currentChatId: string | null,
  selectedModel: string,
  webSearchEnabled: boolean,
  setCurrentChatId: (id: string) => void,
  setSidebarRefreshKey: (key: number) => void,
  setIsLoading: (is: boolean) => void,
  attachedFiles?: UploadedFile[],
  setMessages?: (fn: (prev: Message[]) => Message[]) => void, // <-- now optional
}) {
  // REMOVE ALL OPTIMISTIC UPDATES! No UI update, solely backend-driven.
  // const userMessage: Message = { ... };
  // No local setMessages here

  setIsLoading(true);

  let streamingNewChatId: string | null = null;

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
        } 
        // NO other event should cause a setMessages mutation!
        // "reasoning", "content", "done", "error" -- all handled server-side and updated in DB, so frontend will get it via Realtime!
      }
    }
  } catch (err: any) {
    toast({ title: "Error sending message", description: err?.message || "Could not connect to chat service.", variant: "destructive" });
    // No optimistic deletions
  } finally {
    setIsLoading(false);
  }
}

// Export parseAssistantMessage in case needed outside
export { parseAssistantMessage };
