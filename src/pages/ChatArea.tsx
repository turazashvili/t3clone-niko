
import React, { useRef, useEffect, useState } from "react";
import ChatMessage from "@/components/ChatMessage";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
}

// Strong deduplication: Remove any duplicate user (or assistant) messages by id.
// (If two have the same id, only one will render, period.)
const dedupeMessages = (messages: Message[]) => {
  // Use a Map keyed by message id for *all* messages
  const byId = new Map<string, Message>();
  for (const msg of messages) {
    // Last one wins (newest for each id)
    byId.set(msg.id, msg);
  }
  return Array.from(byId.values());
};

const SCROLL_THRESHOLD = 80; // px, how close to bottom still counts as "at bottom"

const ChatArea: React.FC<ChatAreaProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const scrollContainerRef = useRef<null | HTMLDivElement>(null);

  // Track whether user is at the bottom (windowed threshold)
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Track previous message count and loading state
  const prevMsgLen = useRef<number>(messages.length);
  const prevIsLoading = useRef<boolean>(isLoading);

  // Track previous last message role to detect user sends
  const prevLastMessageRole = useRef<string | undefined>(undefined);

  // Function to scroll to the bottom (with diagnostics)
  const scrollToBottom = () => {
    const sc = scrollContainerRef.current;
    if (sc) {
      // Diagnostics
      console.log("[ChatArea] scrollToBottom called");
      console.log("  scrollTop before:", sc.scrollTop, "  clientHeight:", sc.clientHeight, "  scrollHeight:", sc.scrollHeight);
      sc.scrollTop = sc.scrollHeight;
      setTimeout(() => {
        // After render
        if (scrollContainerRef.current) {
          console.log("  scrollTop after:", scrollContainerRef.current.scrollTop);
        }
      }, 100);
    } else {
      console.log("[ChatArea] scrollToBottom: no scrollContainerRef");
    }
  };

  // Monitor scroll position to update isAtBottom state
  useEffect(() => {
    const sc = scrollContainerRef.current;
    if (!sc) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = sc;
      const atBottom =
        scrollHeight - (scrollTop + clientHeight) <= SCROLL_THRESHOLD;
      setIsAtBottom(atBottom);
    };

    sc.addEventListener("scroll", handleScroll);
    // Check immediately (user might land mid-scroll on load)
    handleScroll();

    return () => sc.removeEventListener("scroll", handleScroll);
  }, []);

  // Modified effect for scrolling behavior
  useEffect(() => {
    const sc = scrollContainerRef.current;
    if (!sc) return;

    // Always scroll to bottom if user just sent a message (isLoading went from true to false and message count increased)
    if (
      prevIsLoading.current === true &&
      isLoading === false &&
      messages.length > prevMsgLen.current
    ) {
      sc.scrollTop = sc.scrollHeight; // direct jump, always
      prevMsgLen.current = messages.length;
      prevIsLoading.current = isLoading;
      return;
    }

    // For other (assistant, system etc) incoming messages, scroll only if user is at (or near) bottom
    if (
      messages.length > prevMsgLen.current &&
      isAtBottom
    ) {
      sc.scrollTop = sc.scrollHeight;
    }
    prevMsgLen.current = messages.length;
    prevIsLoading.current = isLoading;
    // eslint-disable-next-line
  }, [messages, isLoading, isAtBottom]);

  // Scroll to bottom if a new user message is added
  useEffect(() => {
    // Whenever the last message is from the user AND it is new, scroll to bottom
    if (
      messages.length > 0 &&
      messages[messages.length - 1].role === "user" &&
      prevLastMessageRole.current !== "user"
    ) {
      console.log("[ChatArea] Detected new user message. Trigger scrollToBottom.");
      scrollToBottom();
    }
    prevLastMessageRole.current =
      messages.length > 0 ? messages[messages.length - 1].role : undefined;
  }, [messages]);

  // Debug logging: print all IDs before and after dedupe
  useEffect(() => {
    const deduped = dedupeMessages(messages);
    console.log("[ChatArea] messages.length:", messages.length, "IDs:", messages.map(m => m.id));
    console.log("[ChatArea] deduped.length:", deduped.length, "deduped IDs:", deduped.map(m => m.id));
  }, [messages]);

  // Dedupe by id before rendering
  const dedupedMessages = dedupeMessages(messages);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto pt-4 sm:pt-8 pb-24 overscroll-y-contain"
      style={{ outline: "none", WebkitOverflowScrolling: "touch", minHeight: 0 }}
      tabIndex={0}
    >
      <div className="
        mx-auto px-2 sm:px-4 space-y-4 w-full max-w-full md:max-w-3xl
      ">
        {dedupedMessages.map((msg) => (
          // Ensure always unique key!
          <ChatMessage key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatArea;

