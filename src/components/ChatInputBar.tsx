import React, { useRef, useState } from "react";
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
import { Eye, ImageIcon, FileText, LucideFile } from "lucide-react";

const MODEL_LIST: LLMModel[] = (modelsJson as any).data;

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
}

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

const ChatInputBar: React.FC<ChatInputBarProps> = ({
  inputValue,
  setInputValue,
  onSend,
  isLoading,
  disabled,
  user,
  selectedModel,
  setSelectedModel,
  webSearchEnabled,
  setWebSearchEnabled
}) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputValue.trim() && !isLoading && user) onSend(selectedModel, webSearchEnabled);
  };

  // Add model dropdown logic here
  const filteredList = MODEL_LIST; // Can add search if needed
  const currentModel = MODEL_LIST.find(m => m.id === selectedModel) || MODEL_LIST[0];

  return (
    <div className="pointer-events-auto bg-[#1a1625]/90 rounded-t-2xl border border-[#2b2741] shadow-2xl max-w-3xl mx-auto p-3 pb-2 backdrop-blur-lg">
      <form
        className="flex flex-col gap-2 w-full"
        onSubmit={handleSend}
        autoComplete="off"
      >
        {/* Textarea + actions row */}
        <div className="flex flex-row items-end gap-3 w-full">
          <textarea
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
                >
                  <span className="truncate max-w-[120px]">
                    {currentModel.name}
                  </span>
                  <ChevronDown className="ml-1 w-4 h-4 text-white/70" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="p-0 w-[340px] sm:w-[380px] bg-[#181421] border-[#433A60] rounded-2xl shadow-xl z-50 max-h-[340px] overflow-hidden"
              >
                {/* Add a ScrollArea with 320px max height for scrolling inner content */}
                <ScrollArea className="max-h-[320px]">
                  <div>
                    {filteredList.length === 0 && (
                      <div className="text-center text-sm text-zinc-400 py-8">No models found.</div>
                    )}
                    {filteredList.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setDropdownOpen(false);
                        }}
                        className={
                          `flex items-center gap-3 py-2 px-2 w-full rounded-lg cursor-pointer group border-l-4 transition-all
                           ${selectedModel === m.id
                            ? "border-pink-400 bg-[#231c30] text-pink-100 font-bold"
                            : "border-transparent hover:bg-[#222032] text-blue-100"}`
                        }
                        style={{ minHeight: "40px" }}
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
                        <span className="ml-2 min-w-[45px] text-xs text-blue-300 opacity-60 mr-1">
                          Ctx: {prettyNum(m.context_length)}
                        </span>
                        <span className="min-w-[38px] text-xs text-violet-300 opacity-70">
                          Max: {prettyNum(m.top_provider.max_completion_tokens)}
                        </span>
                      </button>
                    ))}
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
            >
              <Paperclip className="h-5 w-5" />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFile(e.target.files[0]);
                  }
                }}
              />
            </button>
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
      </form>
    </div>
  );
};

export default ChatInputBar;
