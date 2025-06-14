
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ShareChatButtonProps {
  chatId?: string | null;
  isPublic?: boolean; // optional, can be passed in for better UX
}

const ShareChatButton: React.FC<ShareChatButtonProps> = ({ chatId, isPublic }) => {
  const [copied, setCopied] = useState(false);

  if (!chatId) return null;

  const shareUrl = `${window.location.origin}/chat/${chatId}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Anyone with this link can view the chat if it's public.",
        variant: "default"
      });
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="px-3 py-2 gap-2 rounded-lg shadow-sm border border-accent bg-background text-accent-foreground hover:bg-accent hover:text-primary transition-all"
              size="sm"
              title="Copy public link"
              onClick={handleShare}
              aria-label="Share chat"
              type="button"
            >
              <Copy size={18} />
              <span className="font-medium">{copied ? "Copied!" : "Share"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Copy public link to this chat</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {isPublic === false && (
        <span className="text-xs mt-1 text-destructive-foreground/90 bg-destructive/10 border border-destructive/20 px-2 py-1 rounded-sm animate-pulse">
          This chat is <b>not public</b>, so others won't be able to view it.
        </span>
      )}
    </div>
  );
};

export default ShareChatButton;

