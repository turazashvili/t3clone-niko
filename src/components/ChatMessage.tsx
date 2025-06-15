
import React, { useState } from "react";
import { Bot, ChevronDown, File as FileIcon, Image as ImageIcon } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import js from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { UploadedFile } from "@/hooks/useFileUpload";
import AttachmentViewerDialog from "./AttachmentViewerDialog";
import MessageActionsBar from "./MessageActionsBar";
import { useChat } from "@/hooks/useChat";
import DotLoader from "./DotLoader";

// Register languages we'll use regularly (more can be added)
SyntaxHighlighter.registerLanguage("js", js);
SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("go", go);
SyntaxHighlighter.registerLanguage("golang", go); // Sometimes code blocks use 'golang'
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("ruby", ruby);

interface ChatMessageProps {
  msg: {
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    created_at?: string;
    attachedFiles?: UploadedFile[];
    chat_id?: string;
  };
}

const isImageType = (fileType: string) => fileType.startsWith("image/");

const ChatMessage: React.FC<ChatMessageProps> = ({ msg }) => {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);

  const handleAttachmentClick = (file: UploadedFile) => {
    setSelectedFile(file);
    setViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setSelectedFile(null);
  };

  const {
    handleSendMessage,
    setMessages,
    messages,
    selectedModel,
    currentChatId,
    deleteMessagesAfter,
    editMessage,
    isLoading,
  } = useChat();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);

  const lastEmptyAssistantId = React.useMemo(() => {
    const assistants = messages.filter(m => m.role === "assistant" && (!m.content || m.content.trim() === ""));
    return assistants.length > 0 ? assistants[assistants.length - 1].id : undefined;
  }, [messages]);

  const handleRetry = async (modelId: string) => {
    const idx = messages.findIndex(m => m.id === msg.id);
    if (idx !== -1) {
      setMessages(messages.slice(0, idx + 1));
    }
    await editMessage(msg.id, msg.content, modelId);
  };

  const handleEditClick = () => {
    setEditValue(msg.content);
    setIsEditing(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editValue.trim() === msg.content.trim()) {
      setIsEditing(false);
      return;
    }
    await editMessage(msg.id, editValue.trim());
    setIsEditing(false);
  };

  const handleEditCancel = () => setIsEditing(false);

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
      <div
        className={
          msg.role === "user"
            ? "w-full flex justify-end"
            : "w-full flex justify-start"
        }
      >
        <div
          className={
            msg.role === "user"
              ? [
                  "max-w-fit",
                  "self-end",
                  "px-2",    // reduced horizontal padding
                  "py-2",    // reduced vertical padding
                  "rounded-xl",
                  "flex",
                  "flex-col",
                  "items-end",
                  "gap-1",
                  "relative",
                  // Vibrant user bubble
                  "bg-[#AB21B4]", // vivid purple (adjust to match screenshot)
                  "text-white",
                  "rounded-br-none",
                  "text-right",
                  "shadow-sm"
                ].join(" ")
              : [
                  "w-full",
                  "max-w-3xl",
                  "mx-auto",
                  "px-4",
                  "p-3",
                  "rounded-xl",
                  "flex",
                  "flex-col",
                  "items-start",
                  "gap-2",
                  "relative",
                  "bg-[#271d37]",
                  "text-white/90",
                  "rounded-bl-none",
                  "shadow-sm"
                ].join(" ")
          }
        >
          {msg.role === 'assistant' && <Bot size={18} className="text-white/70 mt-0.5 shrink-0" />}
          <div className={`flex flex-col w-full ${msg.role === "user" ? "items-end" : ""}`}>
            {/* Reasoning (assistant only) */}
            {msg.role === "assistant" && msg.reasoning && (
              <Collapsible open={reasonOpen} onOpenChange={setReasonOpen} className="mb-2">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-xs text-blue-200 font-semibold bg-[#232240] hover:bg-[#2f2b50] rounded px-3 py-2 mb-1 transition w-full">
                    <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${reasonOpen ? "rotate-180" : ""}`} />
                    Model's thinking (reasoning)
                    <span className="ml-auto text-[10px] opacity-60">(Click to {reasonOpen ? "hide" : "show"})</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="text-xs bg-[#181638]/60 rounded p-2">
                  <ReactMarkdown
                    components={{
                      p: (props) => (
                        <p className={`my-1 leading-relaxed ${msg.role === "user" ? "text-right" : ""}`} {...props} />
                      ),
                      hr: (props) => (
                        <hr className="my-3 border-white/10" {...props} />
                      ),
                      code({node, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || "");
                        // For block code
                        // @ts-ignore
                        if (!props.inline && match) {
                          return (
                            <SyntaxHighlighter
                              style={atomDark}
                              language={match[1]}
                              PreTag="div"
                              className="my-2 rounded-lg text-sm"
                              {...props}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          );
                        }
                        return (
                          <code className="rounded bg-[#312a4b] px-1.5 py-0.5 text-xs" {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {msg.reasoning}
                  </ReactMarkdown>
                </CollapsibleContent>
              </Collapsible>
            )}
            {/* Main message content or loader */}
            {isEditing ? (
              <form onSubmit={handleEditSubmit} className={`flex flex-col w-full gap-1 ${msg.role === "user" ? "items-end" : ""}`}>
                <textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  rows={2}
                  className={`w-full rounded p-1 bg-white/10 text-white ${msg.role === "user" ? "text-right" : ""} text-sm`}
                  autoFocus
                  style={{ minHeight: 32 }}
                />
                <div className="flex gap-1 mt-0.5">
                  <button type="submit" className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs">Save</button>
                  <button type="button" onClick={handleEditCancel} className="bg-gray-400 text-white px-2 py-1 rounded hover:bg-gray-500 text-xs">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className={`w-full min-h-[1.1rem] ${msg.role === "user" ? "text-right" : ""} text-sm leading-snug break-words`}>
                  {/* Show loader if this is the last assistant with empty content (streaming) */}
                  {(msg.role === "assistant" && (!msg.content || msg.content.trim() === "") && msg.id === lastEmptyAssistantId) ? (
                    <DotLoader />
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: (props) => (
                          <p className={`my-0.5 leading-relaxed ${msg.role === "user" ? "text-right" : ""} text-sm`} {...props} />
                        ),
                        hr: (props) => (
                          <hr className="my-2 border-white/10" {...props} />
                        ),
                        code({node, className, children, ...props}) {
                          const match = /language-(\w+)/.exec(className || "");
                          // @ts-ignore
                          if (!props.inline && match) {
                            return (
                              <SyntaxHighlighter
                                style={atomDark}
                                language={match[1]}
                                PreTag="div"
                                className="my-2 rounded-lg text-xs"
                                {...props}
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            );
                          }
                          return (
                            <code className="rounded bg-[#312a4b] px-1.5 py-0.5 text-xs" {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
                {Array.isArray(msg.attachedFiles) && msg.attachedFiles.length > 0 && (
                  <div className={`mt-2 flex flex-wrap gap-2 items-center ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.attachedFiles.map((file, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        {isImageType(file.type) ? (
                          <button
                            type="button"
                            onClick={() => handleAttachmentClick(file)}
                            className="block group bg-transparent border-none outline-none p-0"
                            tabIndex={0}
                          >
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-16 h-16 object-cover rounded shadow border border-white/10 group-hover:scale-105 transition"
                            />
                            <div className="text-xs text-white/70 text-center mt-1 truncate max-w-[70px]">
                              <ImageIcon size={12} className="inline-block mr-1 align-text-bottom" />
                              {file.name}
                            </div>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAttachmentClick(file)}
                            className="flex items-center gap-1 text-xs text-blue-200 hover:underline px-2 py-1 rounded bg-white/10"
                            tabIndex={0}
                          >
                            <FileIcon size={12} />
                            {file.name}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {/* Buttons for user message, now compact */}
          {msg.role === 'user' && !isEditing && (
            <div className="w-full flex justify-end mt-1 -mb-1">
              <div className="flex items-center gap-1">
                <MessageActionsBar
                  messageContent={msg.content}
                  onRetry={handleRetry}
                  currentModel={selectedModel}
                  onEdit={handleEditClick}
                />
              </div>
            </div>
          )}
          <AttachmentViewerDialog open={viewerOpen} file={selectedFile} onClose={handleCloseViewer} />
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;

