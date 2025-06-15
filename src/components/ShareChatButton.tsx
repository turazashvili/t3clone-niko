import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface ShareChatButtonProps {
  chatId?: string | null;
  isPublic?: boolean;
}

const ShareChatButton: React.FC<ShareChatButtonProps> = ({ chatId, isPublic }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publicState, setPublicState] = useState(isPublic);

  if (!chatId) return null;

  const shareUrl = `${window.location.origin}/chat/${chatId}`;

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);

    // If already public, just copy link
    if (publicState) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({
          title: "Link copied!",
          description: "Anyone with this link can view the chat.",
        });
        setTimeout(() => setCopied(false), 1400);
      } catch {
        toast({
          title: "Failed to copy",
          description: "Please copy the link manually.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Otherwise, make chat public first
    const { error } = await supabase
      .from("chats")
      .update({ is_public: true })
      .eq("id", chatId);

    if (error) {
      toast({
        title: "Failed to make public",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    setPublicState(true);
    toast({
      title: "Chat is now public!",
      description: "Anyone with the link can view this chat.",
      variant: "default"
    });

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this public link.",
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
    setLoading(false);
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
              title={publicState ? "Copy public link" : "Make public & copy link"}
              onClick={handleShare}
              aria-label={publicState ? "Share chat" : "Make public and share chat"}
              type="button"
              disabled={loading}
              data-testid="share-chat-btn"
            >
              <Copy size={18} />
              <span className="font-medium">
                {loading ? "Making Public..." : (copied ? "Copied!" : (publicState ? "Share" : "Make Public & Share"))}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>
              {publicState
                ? "Copy public link to this chat"
                : "Make this chat public and copy the link"}
            </span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {publicState === false && (
        <span className="text-xs mt-1 text-destructive-foreground/90 bg-destructive/10 border border-destructive/20 px-2 py-1 rounded-sm animate-pulse">
          This chat is <b>not public</b>, so others won't be able to view it.
        </span>
      )}
    </div>
  );
};

export default ShareChatButton;
