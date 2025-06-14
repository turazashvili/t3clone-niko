
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="pointer-events-auto px-3 py-2 gap-2 rounded-full shadow-lg border border-accent bg-[#19101c]/90 text-accent-foreground
            hover:bg-accent/60 hover:text-primary transition-all
            backdrop-blur-md
            "
            size="sm"
            title="Copy public link"
            onClick={handleShare}
            aria-label="Share chat"
            type="button"
            style={{
              minWidth: 40,
              minHeight: 40,
              fontWeight: 500,
              fontSize: "1rem",
              boxShadow: "0 4px 24px 0 rgba(140,28,191,0.08)",
            }}
          >
            <Copy size={18} />
            <span className="font-medium">{copied ? "Copied!" : "Share"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>Copy public link to this chat</span>
        </TooltipContent>
      </Tooltip>
      {isPublic === false && (
        <span className="text-xs mt-2 text-destructive-foreground/90 bg-destructive/10 border border-destructive/20 px-2 py-1 rounded-sm animate-pulse shadow-lg pointer-events-auto">
          This chat is <b>not public</b>, so others won't be able to view it.
        </span>
      )}
    </TooltipProvider>
  );
};

export default ShareChatButton;
