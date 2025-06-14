
import React from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuItem, DropdownMenuGroup, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { RefreshCcw } from "lucide-react";
import modelsJson from "@/data/models.json";
import { Button } from "@/components/ui/button";

// Utility: Group models by provider
const groupModelsByProvider = () => {
  // We'll expect each model in models.json to have a `provider`, `id`, and `name`
  // Example: { id: "...", name: "...", provider: "OpenAI" }
  const byProvider: Record<string, { id: string, name: string }[]> = {};
  (modelsJson as any).data.forEach((m: any) => {
    if (!m.provider) return;
    if (!byProvider[m.provider]) byProvider[m.provider] = [];
    byProvider[m.provider].push({ id: m.id, name: m.name });
  });
  return byProvider;
};

interface ModelRetryDropdownProps {
  onRetry: (modelId: string) => void;
  currentModel: string;
  children?: React.ReactNode;
}

const ModelRetryDropdown: React.FC<ModelRetryDropdownProps> = ({ onRetry, currentModel, children }) => {
  const modelGroups = groupModelsByProvider();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ? children : (
          <Button variant="ghost" size="icon" className="p-1 rounded-md hover:bg-accent/50">
            <RefreshCcw size={20} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 min-w-[200px] rounded-xl z-50 border bg-[#191525] text-white p-1">
        <DropdownMenuItem
          className="flex items-center gap-2 text-pink-400 font-medium"
          onClick={() => onRetry(currentModel)}
        >
          <RefreshCcw size={16} className="mr-2" /> Retry same
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuLabel className="opacity-70 px-2">or switch model</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {Object.keys(modelGroups).map((provider) => (
          <DropdownMenuSub key={provider}>
            <DropdownMenuSubTrigger className="group text-pink-300 hover:bg-[#221832]/50 flex items-center">
              <span>{provider}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-[#191525]">
              {modelGroups[provider].map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => onRetry(m.id)} className="hover:bg-[#232240] flex items-center">
                  {m.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ModelRetryDropdown;
