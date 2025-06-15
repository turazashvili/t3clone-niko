
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
const dedupeMessages = (messages: Message[]) => {
  const byId = new Map<string, Message>();
  for (const msg of messages) {
    byId.set(msg.id, msg);
  }
  return Array.from(byId.values());
};

const SCROLL_THRESHOLD = 80;

const ChatArea: React.FC<ChatAreaProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const scrollContainerRef = useRef<null | HTMLDivElement>(null);

  // Track whether user is at the bottom (windowed threshold)
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMsgLen = useRef<number>(messages.length);
  const prevIsLoading = useRef<boolean>(isLoading);

  // Scroll-to-bottom function with diagnostics
  const scrollToBottom = () => {
    const sc = scrollContainerRef.current;
    if (sc) {
      console.log("[ChatArea] scrollToBottom called");
      sc.scrollTop = sc.scrollHeight;
      setTimeout(() => {
        if (scrollContainerRef.current) {
          console.log("  scrollTop after:", scrollContainerRef.current.scrollTop);
        }
      }, 100);
    }
  };

  // Monitor scroll position to maintain isAtBottom state
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
    handleScroll();
    return () => sc.removeEventListener("scroll", handleScroll);
  }, []);

  // Always scroll on new message if user is at (or near) the bottom
  useEffect(() => {
    const sc = scrollContainerRef.current;
    if (!sc) return;

    const messageIncreased = messages.length > prevMsgLen.current;
    // Always scroll to bottom on user send (user isLoading -> false and messageIncreased)
    if (
      prevIsLoading.current === true &&
      isLoading === false &&
      messageIncreased
    ) {
      // Message just sent (user input), force scroll
      console.log("[ChatArea] after user send: force scrollToBottom");
      scrollToBottom();
    } else if (messageIncreased && isAtBottom) {
      // New incoming message (assistant, etc), scroll if we were at bottom
      console.log("[ChatArea] new message while at bottom: scrollToBottom");
      scrollToBottom();
    }
    prevMsgLen.current = messages.length;
    prevIsLoading.current = isLoading;
  }, [messages, isLoading, isAtBottom]);

  // Always scroll whenever the component mounts (first render)
  useEffect(() => {
    console.log("[ChatArea] mount, scroll to bottom");
    scrollToBottom();
    // eslint-disable-next-line
  }, []);

  // Debug logging: print all IDs before and after dedupe
  useEffect(() => {
    const deduped = dedupeMessages(messages);
    console.log("[ChatArea] messages.length:", messages.length, "IDs:", messages.map(m => m.id));
    console.log("[ChatArea] deduped.length:", deduped.length, "deduped IDs:", deduped.map(m => m.id));
  }, [messages]);

  const dedupedMessages = dedupeMessages(messages);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto pt-4 sm:pt-8 pb-24 overscroll-y-contain"
      style={{ outline: "none", WebkitOverflowScrolling: "touch", minHeight: 0 }}
      tabIndex={0}
    >
      <div className="mx-auto px-2 sm:px-4 space-y-4 w-full max-w-full md:max-w-3xl">
        {dedupedMessages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatArea;
