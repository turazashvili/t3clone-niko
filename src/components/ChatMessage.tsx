
import React, { useState } from "react";
import { Bot, User as UserIcon, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  msg: {
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    created_at?: string;
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ msg }) => {
  const [reasonOpen, setReasonOpen] = useState(false);

  // If assistant message includes reasoning, show collapsed reasoning panel above answer
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xl p-3 rounded-xl flex items-start gap-2 ${
        msg.role === 'user' 
          ? 'bg-accent text-white rounded-br-none' 
          : 'bg-[#271d37] text-white/90 rounded-bl-none'
      }`}>
        {msg.role === 'assistant' && <Bot size={20} className="text-white/70 mt-0.5 shrink-0" />}
        <div className="flex flex-col w-full">
          {/* Reasoning section for assistant */}
          {msg.role === "assistant" && msg.reasoning && (
            <Collapsible open={reasonOpen} onOpenChange={setReasonOpen} className="mb-2">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-blue-200 font-semibold bg-[#232240] hover:bg-[#2f2b50] rounded px-3 py-2 mb-1 transition w-full">
                  <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${reasonOpen ? "rotate-180" : ""}`} />
                  Model’s thinking (reasoning)
                  <span className="ml-auto text-[10px] opacity-60">(Click to {reasonOpen ? "hide" : "show"})</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="text-xs bg-[#181638]/60 rounded p-2">
                <ReactMarkdown>{msg.reasoning}</ReactMarkdown>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Main message content */}
          <p className="whitespace-pre-wrap text-base">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </p>
        </div>
        {msg.role === 'user' && <UserIcon size={20} className="text-white/70 mt-0.5 shrink-0" />}
      </div>
    </div>
  );
};

export default ChatMessage;
