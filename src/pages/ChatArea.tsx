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

const dedupeMessages = (messages: Message[]) => {
  const seen = new Map<string, Message>();
  for (const msg of messages) {
    seen.set(msg.id, msg); // last occurrence wins
  }
  return Array.from(seen.values());
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

  // Dedupe messages by id before rendering
  const dedupedMessages = dedupeMessages(messages);

  // Chat area is scrollable div
  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto pt-4 sm:pt-8 pb-24 overscroll-y-contain"
      style={{ outline: "none", WebkitOverflowScrolling: "touch" }}
      tabIndex={0}
    >
      <div className="
        mx-auto px-2 sm:px-4 space-y-4 w-full max-w-full md:max-w-3xl
      ">
        {dedupedMessages.map((msg, index) => (
          <ChatMessage key={msg.id || index} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatArea;
