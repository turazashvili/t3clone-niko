
/**
 * Shared utility for client-side SSE stream handling to update message state in real time.
 */

import { Message } from "./useChat";

export interface StreamEventHandlers {
  /** Called per reasoning chunk */
  onReasoning?: (msg: string) => void;
  /** Called per content chunk */
  onContent?: (msg: string) => void;
  /** Called on 'done', with content/reasoning */
  onDone?: (final: { content: string; reasoning: string }) => void;
  /** Called on error, with error object/string */
  onError?: (err: string | Error) => void;
}

/**
 * Process a stream of server-sent events (SSE) for a message, updating state chunk-by-chunk.
 */
export async function processMessageStream(reader: ReadableStreamDefaultReader<Uint8Array>, handlers: StreamEventHandlers) {
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
      // Chat handler uses double newline; message-edit uses both double and single newline patterns
      // Try to catch all events, even if they lack double \n\n
      let eventBlock = "";
      let eventEnd = buffer.indexOf("\n\n");
      if (eventEnd === -1) eventEnd = buffer.indexOf("\n");
      if (eventEnd === -1) break;
      eventBlock = buffer.slice(0, eventEnd).trim();
      buffer = buffer.slice(eventEnd + (buffer[eventEnd+1]==="\n" ? 2 : 1)); // skip one or two newlines

      if (!eventBlock) continue;
      // Parse event type/data
      let event: string = "message";
      let data = "";
      for (let line of eventBlock.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event === "reasoning" && handlers.onReasoning) {
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
