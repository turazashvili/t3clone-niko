
import React, { useState } from "react";
import { RefreshCcw, Edit, Copy } from "lucide-react";
import ModelRetryDropdown from "./ModelRetryDropdown";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface MessageActionsBarProps {
  messageContent: string;
  onRetry: (modelId: string) => void;
  currentModel: string;
  onEdit: () => void;
}

const MessageActionsBar: React.FC<MessageActionsBarProps> = ({
  messageContent, onRetry, currentModel, onEdit,
}) => {
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopying(true);
      toast({ title: "Copied to clipboard!" });
      setTimeout(() => setCopying(false), 1000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="flex space-x-2 items-center justify-end pb-0.5 pr-1">
      <ModelRetryDropdown currentModel={currentModel} onRetry={onRetry} />
      <Button variant="ghost" size="icon" className="p-1 rounded-md hover:bg-accent/50" aria-label="Edit" onClick={onEdit}>
        <Edit size={20} />
      </Button>
      <Button variant="ghost" size="icon" className="p-1 rounded-md hover:bg-accent/50" aria-label="Copy" onClick={handleCopy}>
        <Copy size={20} />
      </Button>
    </div>
  );
};

export default MessageActionsBar;
