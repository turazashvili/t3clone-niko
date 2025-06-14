
import React, { useState } from "react";
import modelsJson from "@/data/models.json";
import { Eye, FileText, ImageIcon, File as LucideFile, Lock, ChevronDown } from "lucide-react";
import { LLMModel } from "@/types/llm-model";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
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

const modelsList: LLMModel[] = (modelsJson as any).data;

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, setSelectedModel }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredList = modelsList.filter(
    model =>
      model.name.toLowerCase().includes(search.toLowerCase())
      || model.id.toLowerCase().includes(search.toLowerCase())
  );

  const currentModel = modelsList.find(m => m.id === selectedModel) || modelsList[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between min-w-[190px] max-w-xs bg-[#201732] border border-[#33274c] rounded-2xl px-2 py-2 text-left text-blue-100 hover:bg-[#271b34] transition-colors group"
          aria-label="Select model"
        >
          <span className="flex-1 text-base font-medium flex items-center gap-2 truncate">
            {currentModel.name}
            {currentModel.top_provider.is_moderated && (
              <Lock className="inline-block w-4 h-4 text-pink-400" aria-label="Moderated" />
            )}
          </span>
          <ChevronDown className="ml-2 w-5 h-5 text-blue-200" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[340px] sm:w-[380px] bg-[#181421] border-[#33274c] rounded-2xl shadow-xl z-50">
        <div className="p-3 border-b border-[#33274c]">
          <input
            type="text"
            className="w-full mb-1 text-sm px-3 py-2 rounded bg-[#201732] text-blue-100 border border-[#33274c] focus:outline-none"
            placeholder="Search models..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        {/* Scrollable area */}
        <ScrollArea className="max-h-[370px]">
          <div className="px-2 py-2">
            {filteredList.length === 0 && (
              <div className="text-center text-sm text-zinc-400 py-8">No models found.</div>
            )}
            {filteredList.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedModel(m.id);
                  setOpen(false);
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
                <span className="flex-1 text-left">{m.name}
                  {m.top_provider.is_moderated && (
                    <Lock className="inline-block ml-2 w-4 h-4 text-pink-400" aria-label="Moderated" />
                  )}
                </span>
                <div className="flex items-center gap-0.5">
                  {getModalityIcons(m.architecture.input_modalities)}
                </div>
                <span className="ml-2 min-w-[50px] text-xs text-blue-300 opacity-60 mr-1">
                  Ctx: {prettyNum(m.context_length)}
                </span>
                <span className="min-w-[40px] text-xs text-violet-300 opacity-70">
                  Max: {prettyNum(m.top_provider.max_completion_tokens)}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default ModelSelector;
