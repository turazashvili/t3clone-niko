
/**
 * Shared utility for client-side SSE stream handling to update message state in real time.
 */

import { Message } from "./useChat";

export interface StreamEventHandlers {
  onReasoning?: (msg: string) => void;
  onContent?: (msg: string) => void;
  /** Called on 'done', with content/reasoning/chatId */
  onDone?: (final: { content: string; reasoning: string; chatId?: string }) => void;
  /** Called on new chatId event */
  onChatId?: (chatId: string) => void;
  /** Called on error, with error object/string */
  onError?: (err: string | Error) => void;
}

/**
 * Process a stream of server-sent events (SSE) for a message, updating state chunk-by-chunk.
 */
export async function processMessageStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: StreamEventHandlers
) {
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
      let eventBlock = "";
      let eventEnd = buffer.indexOf("\n\n");
      if (eventEnd === -1) eventEnd = buffer.indexOf("\n");
      if (eventEnd === -1) break;
      eventBlock = buffer.slice(0, eventEnd).trim();
      buffer = buffer.slice(eventEnd + (buffer[eventEnd + 1] === "\n" ? 2 : 1));
      if (!eventBlock) continue;

      // Parse event type/data
      let event: string = "message";
      let data = "";
      for (let line of eventBlock.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event === "chatId" && handlers.onChatId) {
        // chatId event contains raw id, no JSON structure
        handlers.onChatId(data);
      } else if (event === "reasoning" && handlers.onReasoning) {
        try {
          const parsed = JSON.parse(data);
          handlers.onReasoning(parsed.reasoning || "");
        } catch {}
      } else if (event === "content" && handlers.onContent) {
        try {
          const parsed = JSON.parse(data);
          handlers.onContent(parsed.content || "");
        } catch {}
      } else if (event === "done" && handlers.onDone) {
        try {
          const parsed = JSON.parse(data);
          handlers.onDone({
            content: parsed.content,
            reasoning: parsed.reasoning,
            chatId: parsed.chatId || parsed.chat_id, // support both
          });
        } catch {}
        done = true;
      } else if (event === "error" && handlers.onError) {
        try {
          const parsed = JSON.parse(data);
          handlers.onError(parsed.error || "Unknown error");
        } catch {
          handlers.onError(data || "Unknown error");
        }
        done = true;
      }
    }
  }
}
