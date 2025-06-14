
import React, { useState } from "react";
import { Bot, User as UserIcon, ChevronDown, File as FileIcon, Image as ImageIcon } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import { UploadedFile } from "@/hooks/useFileUpload";

interface ChatMessageProps {
  msg: {
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    created_at?: string;
    attachedFiles?: UploadedFile[];
  };
}

const isImageType = (fileType: string) => fileType.startsWith("image/");

const ChatMessage: React.FC<ChatMessageProps> = ({ msg }) => {
  const [reasonOpen, setReasonOpen] = useState(false);

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

          {/* Attachments preview (below main content) */}
          {Array.isArray(msg.attachedFiles) && msg.attachedFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 items-center">
              {msg.attachedFiles.map((file, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  {isImageType(file.type) ? (
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="block group">
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-24 h-24 object-cover rounded shadow border border-white/10 group-hover:scale-105 transition"
                      />
                      <div className="text-xs text-white/70 text-center mt-1 truncate max-w-[90px]">
                        <ImageIcon size={14} className="inline-block mr-1 align-text-bottom" />
                        {file.name}
                      </div>
                    </a>
                  ) : (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-200 hover:underline px-2 py-1 rounded bg-white/10"
                    >
                      <FileIcon size={14} />
                      {file.name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {msg.role === 'user' && <UserIcon size={20} className="text-white/70 mt-0.5 shrink-0" />}
      </div>
    </div>
  );
};

export default ChatMessage;

