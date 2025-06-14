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

const MODEL_LIST = [
  { label: "Gemini 2.5 Pro", value: "google/gemini-2.5-pro-preview" },
  { label: "GPT-4o Mini", value: "openai/o4-mini" },
  { label: "GPT-4.1", value: "openai/gpt-4.1" },
  { label: "OpenAI o1 Pro", value: "openai/o1-pro" },
  { label: "Claude Opus 4", value: "anthropic/claude-opus-4" },
  { label: "Claude Sonnet 4", value: "anthropic/claude-sonnet-4" },
  { label: "DeepSeek R1", value: "deepseek/deepseek-r1-0528" },
];

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
            {/* Model selector */}
            <DropdownMenu open={isDropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center text-sm bg-transparent font-medium hover:bg-white/10 rounded-md px-2 py-1.5 gap-2 text-white transition border-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  <span>
                    {MODEL_LIST.find(m => m.value === selectedModel)?.label ||
                      MODEL_LIST[0].label}
                  </span>
                  <ChevronDown className="ml-1 w-4 h-4 text-white/70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[60] min-w-[180px] bg-[#201732] text-white border-[#433A60] rounded-xl shadow-xl py-1 px-0">
                {MODEL_LIST.map((m) => (
                  <DropdownMenuItem
                    key={m.value}
                    onSelect={() => {
                      setSelectedModel(m.value);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "cursor-pointer px-4 py-2 hover:bg-pink-900/30 rounded-lg text-base",
                      m.value === selectedModel ? "font-semibold bg-pink-800/15" : ""
                    )}
                  >
                    {m.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
