
import React, { useRef, useEffect } from "react";
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

const ChatArea: React.FC<ChatAreaProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    // Use a centered, fixed-width container for messages to match input bar
    <div className="flex-1 overflow-y-auto pt-8 pb-24">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        {messages.map((msg, index) => (
          <ChatMessage key={msg.id || index} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatArea;
