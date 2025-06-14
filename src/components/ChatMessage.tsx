import React, { useState } from "react";
import { Bot, User as UserIcon, ChevronDown, File as FileIcon, Image as ImageIcon } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import { UploadedFile } from "@/hooks/useFileUpload";
import AttachmentViewerDialog from "./AttachmentViewerDialog";
import MessageActionsBar from "./MessageActionsBar";
import { useChat } from "@/hooks/useChat";

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

  // Add context/hook for main chat handlers
  const {
    handleSendMessage,
    setMessages,
    messages,
    selectedModel,
    currentChatId,
    deleteMessagesAfter,
    editMessage,
  } = useChat();

  // Add UI editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);

  // Handle Retry (modelId: string)
  const handleRetry = async (modelId: string) => {
    console.log("handleRetry called", { modelId, msg, currentChatId });
    await deleteMessagesAfter(msg.id);
    // Instead of using currentChatId (which may be null), use msg.chat_id if available
    await handleSendMessage(modelId, undefined, msg.attachedFiles, msg.content, msg.chat_id);
  };

  // Enhanced handleEdit: open inline editor, allow submit
  const handleEditClick = () => {
    setEditValue(msg.content);
    setIsEditing(true);
  };

  // On edit submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editValue.trim() === msg.content.trim()) {
      setIsEditing(false);
      return;
    }
    // 1. Update the message in the DB
    const ok = await editMessage(msg.id, editValue.trim());
    if (!ok) return;

    // 2. Delete messages after this one
    await deleteMessagesAfter(msg.id);

    // 3. Re-run handleSendMessage for this message (simulate as if just sent)
    // We pass in same model, webSearch/attachments, override text
    await handleSendMessage(selectedModel, undefined, msg.attachedFiles, editValue.trim(), msg.chat_id);

    setIsEditing(false);
  };

  // Cancel edit
  const handleEditCancel = () => setIsEditing(false);

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xl p-3 rounded-xl flex flex-col items-start gap-2 relative ${
        msg.role === 'user' 
          ? 'bg-accent text-white rounded-br-none'
          : 'bg-[#271d37] text-white/90 rounded-bl-none'
      }`}>
        {msg.role === 'assistant' && <Bot size={20} className="text-white/70 mt-0.5 shrink-0" />}

        <div className="flex flex-col w-full">
          {/* Reasoning */}
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
          {/* Attachments */}
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="flex flex-col w-full gap-2">
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                rows={2}
                className="w-full rounded p-2 bg-white/10 text-white"
                autoFocus
              />
              <div className="flex gap-2 mt-1">
                <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Save</button>
                <button type="button" onClick={handleEditCancel} className="bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-500">Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-base">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </p>
              {Array.isArray(msg.attachedFiles) && msg.attachedFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3 items-center">
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
                            className="w-24 h-24 object-cover rounded shadow border border-white/10 group-hover:scale-105 transition"
                          />
                          <div className="text-xs text-white/70 text-center mt-1 truncate max-w-[90px]">
                            <ImageIcon size={14} className="inline-block mr-1 align-text-bottom" />
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
                          <FileIcon size={14} />
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
        {/* Buttons for user message */}
        {msg.role === 'user' && !isEditing && (
          <div className="absolute bottom-1 right-2">
            <MessageActionsBar
              messageContent={msg.content}
              onRetry={handleRetry}
              currentModel={selectedModel}
              onEdit={handleEditClick}
            />
          </div>
        )}
        {msg.role === 'user' && <UserIcon size={20} className="text-white/70 mt-0.5 shrink-0" />}
        {/* Attachment Viewer Dialog (modal, one per ChatMessage instance) */}
        <AttachmentViewerDialog open={viewerOpen} file={selectedFile} onClose={handleCloseViewer} />
      </div>
    </div>
  );
};

export default ChatMessage;
