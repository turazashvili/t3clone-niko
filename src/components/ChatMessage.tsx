
import React from "react";
import { Bot, User as UserIcon } from "lucide-react";

interface ChatMessageProps {
  msg: {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at?: string;
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ msg }) => (
  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
    <div className={`max-w-xl p-3 rounded-xl flex items-start gap-2 ${
      msg.role === 'user' 
        ? 'bg-accent text-white rounded-br-none' 
        : 'bg-[#271d37] text-white/90 rounded-bl-none'
    }`}>
      {msg.role === 'assistant' && <Bot size={20} className="text-white/70 mt-0.5 shrink-0" />}
      <p className="whitespace-pre-wrap">{msg.content}</p>
      {msg.role === 'user' && <UserIcon size={20} className="text-white/70 mt-0.5 shrink-0" />}
    </div>
  </div>
);

export default ChatMessage;
