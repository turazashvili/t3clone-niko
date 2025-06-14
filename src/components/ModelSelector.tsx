
import React, { useEffect, useState } from "react";
import modelsJson from "@/data/models.json";
import { Eye, Globe, FileText, ImageIcon, File as LucideFile, Plus, Lock } from "lucide-react";
import { LLMModel } from "@/types/llm-model";

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

// Short utility to pretty context length/tokens
function prettyNum(num?: number | null) {
  if (!num) return "?";
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toLocaleString()}k`;
  return num.toLocaleString();
}

const modelsList: LLMModel[] = (modelsJson as any).data;

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, setSelectedModel }) => {
  const [search, setSearch] = useState("");

  // Filter models by search
  const filteredList = modelsList.filter(
    model =>
      model.name.toLowerCase().includes(search.toLowerCase())
      || model.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl bg-[#181421] border border-[#33274c] shadow-xl max-w-md w-full px-2 py-2">
      <input
        type="text"
        className="w-full mb-3 text-sm px-3 py-2 rounded bg-[#201732] text-blue-100 border border-[#33274c] focus:outline-none"
        placeholder="Search models..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="">
        {filteredList.map((m) => (
          <div
            key={m.id}
            onClick={() => setSelectedModel(m.id)}
            className={
              `flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer group border-l-4 
               ${selectedModel === m.id
                ? "border-pink-400 bg-[#231c30] text-pink-100 font-bold"
                : "border-transparent hover:bg-[#222032] text-blue-100"}`
            }
          >
            {/* Model Name */}
            <span className="flex-1">
              {m.name}
              {m.top_provider.is_moderated && <Lock className="inline-block ml-2 w-4 h-4 text-pink-400" aria-label="Moderated" />}
            </span>
            {/* Capabilities */}
            <div className="flex items-center gap-0.5">
              {getModalityIcons(m.architecture.input_modalities)}
            </div>
            {/* Context window/tokens */}
            <span className="ml-2 min-w-[50px] text-xs text-blue-300 opacity-60 mr-1">
              Ctx: {prettyNum(m.context_length)}
            </span>
            <span className="min-w-[40px] text-xs text-violet-300 opacity-70">
              Max: {prettyNum(m.top_provider.max_completion_tokens)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;
