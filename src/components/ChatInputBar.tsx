import React, { useRef, useState, useImperativeHandle, forwardRef } from "react";
import { ChevronDown, ArrowUp, Paperclip, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import modelsJson from "@/data/models.json";
import { LLMModel } from "@/types/llm-model";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock } from "lucide-react";
import { Eye, ImageIcon, FileText, LucideFile, File, Upload } from "lucide-react";
import { useFileUpload, UploadedFile } from "@/hooks/useFileUpload"; // NEW

const MODEL_LIST: LLMModel[] = (modelsJson as any).data;

const iconsByModality: Record<string, React.ReactNode> = {
  text: <Eye className="h-5 w-5" aria-label="Text" />,
  image: <ImageIcon className="h-5 w-5" aria-label="Image" />,
  file: <FileText className="h-5 w-5" aria-label="File" />,
};
function getModalityIcons(inputs: string[]) {
  return inputs.map((m) => (
    <span key={m} className="inline-block mr-1 text-green-300 opacity-80">
      {iconsByModality[m] || <LucideFile className="h-5 w-5" aria-label={m} />}
    </span>
  ));
}
function prettyNum(num?: number | null) {
  if (!num) return "?";
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toLocaleString()}k`;
  return num.toLocaleString();
}

interface ChatInputBarProps {
  inputValue: string;
  setInputValue: (v: string) => void;
  onSend: (model: string, webSearchEnabled: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
  user?: any;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  attachedFiles?: UploadedFile[];
  setAttachedFiles?: (files: UploadedFile[]) => void;
}

const MAX_FILES = 5; // Allow up to 5 files

export interface ChatInputBarRef {
  focus: () => void;
}

const ChatInputBar = forwardRef<ChatInputBarRef, ChatInputBarProps>(({
  inputValue,
  setInputValue,
  onSend,
  isLoading,
  disabled,
  user,
  selectedModel,
  setSelectedModel,
  webSearchEnabled,
  setWebSearchEnabled,
  attachedFiles = [],
  setAttachedFiles = () => {},
}, ref) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileLimitError, setFileLimitError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState("");

  // FIX: Add useFileUpload destructure here
  const { upload: uploadFile, uploading, error: uploadError } = useFileUpload();

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textareaRef.current) textareaRef.current.focus();
    },
  }));

  // Attaching files (images, pdf)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileLimitError(null);
    const files = e.target.files;
    let newFiles: UploadedFile[] = [...attachedFiles];
    if (files) {
      for (let i = 0; i < files.length; ++i) {
        const file = files[i];
        // Accept images/pdf only
        if (!/^(image\/(png|jpeg|webp)|application\/pdf)$/.test(file.type)) continue;
        if (newFiles.length >= MAX_FILES) {
          setFileLimitError(`You can attach up to ${MAX_FILES} files per message.`);
          break;
        }
        const uploaded = await uploadFile(file);
        if (uploaded) {
          newFiles = [...newFiles, uploaded];
        }
      }
      setAttachedFiles(newFiles.slice(0, MAX_FILES));
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (i: number) => {
    setAttachedFiles(attachedFiles.filter((_, idx) => idx !== i));
    setFileLimitError(null);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputValue.trim() && !isLoading && user) onSend(selectedModel, webSearchEnabled);
  };

  // Add model dropdown logic here
  // Apply filter by model name
  const filteredList = MODEL_LIST.filter((m) =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );
  const currentModel = MODEL_LIST.find(m => m.id === selectedModel) || MODEL_LIST[0];

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    setFileLimitError(null);
    const files = e.dataTransfer.files;
    let newFiles: UploadedFile[] = [...attachedFiles];

    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      if (!/^(image\/(png|jpeg|webp)|application\/pdf)$/.test(file.type)) continue;
      if (newFiles.length >= MAX_FILES) {
        setFileLimitError(`You can attach up to ${MAX_FILES} files per message.`);
        break;
      }
      const uploaded = await uploadFile(file);
      if (uploaded) {
        newFiles = [...newFiles, uploaded];
      }
    }
    setAttachedFiles(newFiles.slice(0, MAX_FILES));
  };

  return (
    <div
      className={cn(
        "pointer-events-auto bg-[#1a1625]/90 rounded-t-2xl border border-[#2b2741] shadow-2xl max-w-3xl mx-auto p-3 pb-2 backdrop-blur-lg",
        dragActive && "ring-2 ring-pink-400 ring-offset-2"
      )}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* DRAG AND DROP OVERLAY */}
      {dragActive && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ pointerEvents: "none" }}
        >
          <div className="w-full flex justify-center animate-in fade-in zoom-in-90 pointer-events-none select-none">
            <div className="bg-pink-700/90 text-white rounded-2xl shadow-lg px-8 py-3 mt-40 text-lg font-bold flex items-center gap-2">
              <Upload className="w-6 h-6" /> Drop files here to attach!
            </div>
          </div>
        </div>
      )}

      <form
        className="flex flex-col gap-2 w-full"
        onSubmit={handleSend}
        autoComplete="off"
      >
        {/* Textarea + actions row */}
        <div className="flex flex-row items-end gap-3 w-full">
          <textarea
            ref={textareaRef}
            className="w-full resize-none bg-transparent text-base leading-6 text-white outline-none placeholder:text-white/50 px-1 py-1 min-h-[48px] scrollbar-none"
            placeholder="Type your message here..."
            value={inputValue}
            disabled={isLoading || disabled || !user}
            rows={1}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); handleSend();
              }
            }}
            aria-label="Message input"
          />

          {/* Attachments preview (small chips) */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedFiles.map((file, i) => (
                <div
                  key={file.url}
                  className="flex items-center bg-blue-900/60 text-xs text-white rounded px-2 py-1"
                >
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="w-4 h-4 mr-1" />
                  ) : (
                    <FileText className="w-4 h-4 mr-1" />
                  )}
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate max-w-[80px] underline"
                  >
                    {file.name}
                  </a>
                  <button
                    type="button"
                    className="ml-1 text-white/70 hover:text-rose-400"
                    title="Remove"
                    onClick={() => removeFile(i)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Send button */}
          <Button
            type="submit"
            className={cn(
              "rounded-lg bg-pink-700/90 shadow font-semibold hover:bg-pink-600/90 w-10 h-10 p-0 flex items-center justify-center transition-colors",
              (!inputValue.trim() || isLoading || disabled || !user) && `opacity-60 cursor-not-allowed`
            )}
            disabled={!inputValue.trim() || isLoading || disabled || !user}
            aria-label="Send message"
            variant="ghost"
          >
            <ArrowUp className="size-5 text-pink-50" />
          </Button>
        </div>
        {/* Model/file/search row */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-0.5">
            {/* Model selector using Popover */}
            <Popover open={isDropdownOpen} onOpenChange={setDropdownOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center text-sm bg-transparent font-medium hover:bg-white/10 rounded-md px-2 py-1.5 gap-2 text-white transition border-none focus-visible:ring-1 focus-visible:ring-accent"
                  onClick={() => setDropdownOpen(!isDropdownOpen)}
                  aria-label="Select model"
                  style={{ minWidth: 0 }}
                >
                  <span className="truncate max-w-[180px]">
                    {currentModel.name}
                  </span>
                  <ChevronDown className="ml-1 w-4 h-4 text-white/70" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="p-0 w-[420px] sm:w-[480px] bg-[#181421] border-[#433A60] rounded-2xl shadow-xl z-50"
                style={{ overflow: "visible" }}
              >
                {/* NEW: Add search input for filtering models */}
                <div className="p-3 pb-0 sticky top-0 z-10 bg-[#181421]">
                  <input
                    type="text"
                    value={modelSearch}
                    autoFocus
                    onChange={e => setModelSearch(e.target.value)}
                    placeholder="Search model name…"
                    className="w-full px-3 py-2 rounded-lg border border-[#393160] bg-[#28253b] text-white text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-pink-400 transition"
                  />
                </div>
                {/* ScrollArea shows all models and is the only scrollable area */}
                <ScrollArea className="max-h-[420px] overflow-y-auto pt-0">
                  <div>
                    {filteredList.length === 0 ? (
                      <div className="text-center text-sm text-zinc-400 py-8">No models found.</div>
                    ) : (
                      filteredList.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModel(m.id);
                            setDropdownOpen(false);
                          }}
                          className={
                            `flex items-center gap-3 py-2 px-3 w-full rounded-lg cursor-pointer group border-l-4 transition-all
                             ${selectedModel === m.id
                              ? "border-pink-400 bg-[#231c30] text-pink-100 font-bold"
                              : "border-transparent hover:bg-[#222032] text-blue-100"}`
                          }
                          style={{ minHeight: "44px" }}
                          tabIndex={0}
                        >
                          <span className="flex-1 text-left truncate">{m.name}
                            {m.top_provider.is_moderated && (
                              <Lock className="inline-block ml-2 w-4 h-4 text-pink-400" aria-label="Moderated" />
                            )}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {getModalityIcons(m.architecture.input_modalities)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            {/* Search toggle */}
            <div className="ml-2 flex items-center gap-2 select-none">
              <Globe className="h-5 w-5 text-blue-200" />
              <span className="text-xs text-white/80">Web Search</span>
              <Switch
                aria-label="Toggle web search"
                checked={webSearchEnabled}
                onCheckedChange={setWebSearchEnabled}
              />
            </div>
            {/* File attachment */}
            <button
              type="button"
              aria-label="Attach file"
              className="ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-transparent text-zinc-300 hover:bg-white/10 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || attachedFiles.length >= MAX_FILES}
            >
              <Paperclip className="h-5 w-5" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={attachedFiles.length >= MAX_FILES}
              />
            </button>
            {uploading && (
              <span className="ml-2 text-xs text-blue-300">Uploading…</span>
            )}
            {uploadError && (
              <span className="ml-2 text-xs text-rose-400">{uploadError}</span>
            )}

            {file && (
              <span className="ml-2 text-xs text-white/70 truncate max-w-[120px]">
                {file.name}
              </span>
            )}
          </div>
          {/* Info for not logged in */}
          {!user && (
            <span className="ml-auto text-xs text-amber-300/80 pr-3">
              Please log in to chat.
            </span>
          )}
        </div>
        {fileLimitError && (
          <div className="px-1 pt-1 text-xs text-rose-400 font-semibold">{fileLimitError}</div>
        )}
      </form>
    </div>
  );
});

export default ChatInputBar;

// After this change, src/components/ChatInputBar.tsx is getting quite long.
// Consider asking me to refactor this file into smaller, more maintainable files!
