
import React from "react";
import { MODEL_LIST } from "@/hooks/useChat";

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, setSelectedModel }) => (
  <select
    className="rounded-lg px-3 py-2 mr-2 font-medium bg-[#232240] text-blue-100 focus:outline-none"
    value={selectedModel}
    onChange={e => setSelectedModel(e.target.value)}
  >
    {MODEL_LIST.map((m) => (
      <option key={m.value} value={m.value}>{m.label}</option>
    ))}
  </select>
);

export default ModelSelector;
